package types

import "time"

type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Name    string `json:"name"`
}

type Workspace struct {
	ID            string    `json:"id"`
	CreatedAt     time.Time `json:"created_at"`
	LastUpdatedAt time.Time `json:"last_updated_at"`
	Name          string    `json:"name"`

	Files []File `json:"files"`
}

type GVK struct {
	ID             string
	WorkspaceID    string
	GVK            string
	RevisionNumber int
	FilePath       string
	CreatedAt      time.Time
	Content        string
	Summary        *string
	Embeddings     []float64
}
