alter table if exists social_app_credentials
  add column if not exists config_id text not null default '';