package workspace

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/replicatedhq/chartsmith/pkg/persistence"
	"github.com/replicatedhq/chartsmith/pkg/workspace/types"
)

func GetConversion(ctx context.Context, id string) (*types.Conversion, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, workspace_id, chat_message_ids, created_at, status, chart_yaml, values_yaml FROM workspace_conversion WHERE id = $1`

	var c types.Conversion
	var valuesYAML sql.NullString
	var chartYAML sql.NullString
	if err := conn.QueryRow(ctx, query, id).Scan(&c.ID, &c.WorkspaceID, &c.ChatMessageIDs, &c.CreatedAt, &c.Status, &chartYAML, &valuesYAML); err != nil {
		return nil, err
	}

	c.ValuesYAML = valuesYAML.String
	c.ChartYAML = chartYAML.String

	return &c, nil
}

func SetConversionStatus(ctx context.Context, id string, status types.ConversionStatus) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET status = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, status, id); err != nil {
		return err
	}

	return nil
}

// ListFilesToConvert returns all files that were in the original archive
// that have not been converted yet
func ListFilesToConvert(ctx context.Context, id string) ([]types.ConversionFile, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT id, conversion_id, file_path, file_content, file_status FROM workspace_conversion_file WHERE conversion_id = $1 AND file_path IS NOT NULL AND file_content IS NOT NULL AND converted_files IS NULL`
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

func ListConvertedFiles(ctx context.Context, id string) (map[string]string, error) {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `SELECT converted_files FROM workspace_conversion_file WHERE conversion_id = $1`
	rows, err := conn.Query(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	files := map[string]string{}
	for rows.Next() {
		var convertedFiles sql.NullString
		if err := rows.Scan(&convertedFiles); err != nil {
			return nil, err
		}

		rowFiles := map[string]string{}
		if err := json.Unmarshal([]byte(convertedFiles.String), &rowFiles); err != nil {
			return nil, err
		}

		for k, v := range rowFiles {
			files[k] = v
		}
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

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET chart_yaml = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, content, conversionID); err != nil {
		return err
	}

	return nil
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

	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET values_yaml = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, content, conversionID); err != nil {
		return err
	}

	return nil
}

func UpdateValuesYAMLForConversion(ctx context.Context, id string, valuesYAML string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	query := `UPDATE workspace_conversion SET values_yaml = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, valuesYAML, id); err != nil {
		return err
	}

	return nil
}

func UpdateConvertedContentForFileConversion(ctx context.Context, id string, convertedFiles map[string]string) error {
	conn := persistence.MustGetPooledPostgresSession()
	defer conn.Release()

	marshalled, err := json.Marshal(convertedFiles)
	if err != nil {
		return fmt.Errorf("failed to marshal converted files: %w", err)
	}

	query := `UPDATE workspace_conversion_file SET converted_files = $1 WHERE id = $2`
	if _, err := conn.Exec(ctx, query, string(marshalled), id); err != nil {
		return err
	}

	return nil
}
