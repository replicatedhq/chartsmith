COPY workspace_revision (workspace_id, revision_number, created_at, plan_id, created_by_user_id, created_type, is_complete)
FROM '/docker-entrypoint-initdb.d/workspace_revision.csv'
CSV;
