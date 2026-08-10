package embedding

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"hash/fnv"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/replicatedhq/chartsmith/pkg/persistence"
)

const (
	embeddingDimensions = 1024
	embeddingVersion    = "feature-hash-v1"
)

func Version() string {
	return embeddingVersion
}

var (
	ErrEmptyContent = errors.New("content is empty")
	tokenPattern    = regexp.MustCompile(`[A-Za-z0-9_./:-]+`)
)

// Embeddings creates a local, deterministic feature-hashing vector and caches
// it in PostgreSQL. pgvector remains responsible for storage and cosine search;
// no external embedding API or key is required.
func Embeddings(content string) (string, error) {
	if content == "" {
		return "", nil
	}

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	cacheInput := embeddingVersion + "\x00" + content
	contentSHA256 := sha256.Sum256([]byte(cacheInput))
	cacheKey := fmt.Sprintf("%x", contentSHA256)
	query := `select embeddings from content_cache where content_sha256 = $1`
	row := conn.QueryRow(context.Background(), query, cacheKey)
	var cachedEmbeddings string
	if err := row.Scan(&cachedEmbeddings); err != nil {
		if err != pgx.ErrNoRows {
			return "", fmt.Errorf("error scanning embeddings: %v", err)
		}
	} else {
		return cachedEmbeddings, nil
	}

	newEmbeddings := vectorize(content)
	query = `insert into content_cache (content_sha256, embeddings) values ($1, $2) on conflict (content_sha256) do update set embeddings = $2`
	if _, err := conn.Exec(context.Background(), query, cacheKey, newEmbeddings); err != nil {
		return "", fmt.Errorf("error inserting embeddings: %v", err)
	}

	return newEmbeddings, nil
}

func vectorize(content string) string {
	vector := make([]float64, embeddingDimensions)
	tokens := tokenPattern.FindAllString(strings.ToLower(content), -1)

	for i, token := range tokens {
		addFeature(vector, "word:"+token, 1)
		if i > 0 {
			addFeature(vector, "pair:"+tokens[i-1]+" "+token, 0.75)
		}
		if len(token) >= 3 {
			for j := 0; j <= len(token)-3; j++ {
				addFeature(vector, "tri:"+token[j:j+3], 0.2)
			}
		}
	}

	// Content such as a template consisting mostly of punctuation should still
	// receive a usable vector.
	if len(tokens) == 0 {
		addFeature(vector, "raw:"+content, 1)
	}

	var magnitude float64
	for _, value := range vector {
		magnitude += value * value
	}
	magnitude = math.Sqrt(magnitude)
	if magnitude > 0 {
		for i := range vector {
			vector[i] /= magnitude
		}
	}

	values := make([]string, len(vector))
	for i, value := range vector {
		values[i] = strconv.FormatFloat(value, 'f', 6, 64)
	}
	return "[" + strings.Join(values, ",") + "]"
}

func addFeature(vector []float64, feature string, weight float64) {
	h := fnv.New64a()
	_, _ = h.Write([]byte(feature))
	value := h.Sum64()
	index := int(value % uint64(len(vector)))
	if value&(uint64(1)<<63) != 0 {
		weight = -weight
	}
	vector[index] += weight
}
