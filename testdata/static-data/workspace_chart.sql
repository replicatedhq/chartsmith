COPY workspace_chart (id, workspace_id, name, revision_number)
FROM '/docker-entrypoint-initdb.d/workspace_chart.csv'
CSV;
