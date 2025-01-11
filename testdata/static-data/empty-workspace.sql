insert into chartsmith_user
  (id, email, name, image_url, created_at, last_login_at, last_active_at)
  values
  (1, 'test@example.com', 'Test User', 'https://ui-avatars.com/api/?name=Test User&background=6a77fb&color=fff', now(), now(), now());

insert into workspace
  (id, created_at, last_updated_at, name, created_by_user_id, created_type, current_revision_number)
  values
  ('empty-workspace', now(), now(), 'empty workspace', 1, 'manual', 0);

insert into workspace_chat
  (id, workspace_id, created_at, sent_by, prompt, response, is_complete, is_initial_message, is_applied, is_applying, is_ignored)
  values
  ('empty-workspace-chat', 'empty-workspace', now(), 1, '', '', false, true, false, false, false);

insert into workspace_revision
  (workspace_id, revision_number, created_at, chat_message_id, created_by_user_id, created_type, is_complete)
  values
  ('empty-workspace', 0, now(), 'empty-workspace-chat', 1, 'manual', false);

