COPY workspace (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number)
FROM '/docker-entrypoint-initdb.d/workspace.csv'
CSV;
