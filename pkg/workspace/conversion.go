package workspace

import (
	"context"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
	"github.com/tuvistavie/securerandom"
)

func GetConversation(ctx context.Context, id string) (*types.Conversion, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, workspace_id, chat_message_ids, created_at, status FROM workspace_conversion WHERE id = $1`

	var c types.Conversion
	if err := conn.QueryRow(ctx, query, id).Scan(&c.ID, &c.WorkspaceID, &c.ChatMessageIDs, &c.CreatedAt, &c.Status); err != nil {
		return nil, err
	}

	return &c, nil
}

func SetConversationStatus(ctx context.Context, id string, status types.ConversionStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET status = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, status, id); err != nil {
		return err
	}

	return nil
}

// ListFilesToConvert returns all files that were in the original archive
// This doesn't look at status, but it looks at if there was a file path and content
// this excludes injected files like Chart.yaml and values.yaml
func ListFilesToConvert(ctx context.Context, id string) ([]types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, conversion_id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1 AND file_path IS NOT NULL AND file_content IS NOT NULL`
	rows, err := conn.Query(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []types.ConversionFile
	for rows.Next() {
		var file types.ConversionFile
		if err := rows.Scan(&file.ID, &file.ConversionID, &file.FilePath, &file.FileContent, &file.FileStatus); err != nil {
			return nil, err
		}
		files = append(files, file)
	}

	return files, nil
}

func GetConversionFile(ctx context.Context, conversionID string, fileID string) (*types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, conversion_id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1 AND id = $2`

	var file types.ConversionFile
	if err := conn.QueryRow(ctx, query, conversionID, fileID).Scan(&file.ID, &file.ConversionID, &file.FilePath, &file.FileContent, &file.FileStatus); err != nil {
		return nil, err
	}

	return &file, nil
}

func SetConversionFileStatus(ctx context.Context, id string, status types.ConversionFileStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion_file SET file_status = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, status, id); err != nil {
		return err
	}

	return nil
}

func AddDefaultFilesToConversion(ctx context.Context, conversionID string) error {
	if err := addChartYAMLToConversion(ctx, conversionID); err != nil {
		return err
	}

	if err := addValuesYAMLToConversion(ctx, conversionID); err != nil {
		return err
	}

	return nil
}

func addChartYAMLToConversion(ctx context.Context, conversionID string) error {
	content := `apiVersion: v2
name: converted-chart
description: Converted chart
version: 0.0.0
appVersion: "0.0.0"

dependencies:
- name: replicated
  repository: oci://registry.replicated.com/library
  version: 1.0.0-beta.32
`

	return addFileToConversion(ctx, conversionID, "Chart.yaml", content)
}

func addValuesYAMLToConversion(ctx context.Context, conversionID string) error {
	content := `# Default values for converted-chart.

replicaCount: 1

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

#This section builds out the service account more information can be found here: https://kubernetes.io/docs/concepts/security/service-accounts/
serviceAccount:
  create: true
  automount: true
  annotations: {}
  name: ""

podAnnotations: {}
podLabels: {}

podSecurityContext: {}

securityContext: {}
service:
  type: ClusterIP
ingress:
  enabled: false

resources: {}
volumes: []
volumeMounts: []

nodeSelector: {}

tolerations: []

affinity: {}
`

	return addFileToConversion(ctx, conversionID, "values.yaml", content)
}

func addFileToConversion(ctx context.Context, conversionID string, filePath string, content string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	id, err := securerandom.Hex(6)
	if err != nil {
		return err
	}

	query := `INSERT INTO workspace_conversion_file (id, conversion_id, file_path, file_content, file_status, converted_file_path, converted_file_content) VALUES ($1, $2, NULL, NULL, $3, $4, $5)`
	if _, err := conn.Exec(ctx, query, id, conversionID, types.ConversionFileStatusPending, filePath, content); err != nil {
		return err
	}

	return nil
}

func GetValuesYAMLForConversion(ctx context.Context, conversionID string) (*types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, converted_file_path, converted_file_content FROM workspace_conversion_file WHERE conversion_id = $1 AND converted_file_path = 'values.yaml'`

	var file types.ConversionFile
	row := conn.QueryRow(ctx, query, conversionID)
	if err := row.Scan(&file.ID, &file.ConvertedFilePath, &file.ConvertedFileContent); err != nil {
		return nil, err
	}

	return &file, nil
}

func UpdateConvertedContentForFileConversion(ctx context.Context, id string, convertedFilePath string, convertedFileContent string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion_file SET converted_file_path = $1, converted_file_content = $2 WHERE id = $3`
	if _, err := conn.Exec(ctx, query, convertedFilePath, convertedFileContent, id); err != nil {
		return err
	}

	return nil
}
