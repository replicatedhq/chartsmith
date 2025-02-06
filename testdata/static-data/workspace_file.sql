COPY workspace_file (id, revision_number, chart_id, workspace_id, file_path, content, embeddings)
FROM '/docker-entrypoint-initdb.d/workspace_file.csv'
CSV;
