-- ============================================================
-- Social Bot Schema
-- Run once in Supabase SQL editor
-- ============================================================

-- Bot rules: keyword triggers → auto-reply actions
create table if not exists social_bot_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    text not null,          -- FB page id or IG user id
  platform      text not null,          -- 'facebook' | 'instagram'
  name          text not null,
  trigger_type  text not null default 'keyword', -- 'keyword' | 'any' | 'dm_any'
  keywords      text[] not null default '{}',    -- matched case-insensitively
  match_mode    text not null default 'any',      -- 'any' | 'all'
  scope         text not null default 'comment',  -- 'comment' | 'dm' | 'both'
  -- actions
  reply_comment text,          -- public reply to comment (null = don't reply in comments)
  reply_dm      text,          -- DM to send to the commenter (null = skip)
  like_comment  boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table social_bot_rules enable row level security;
create policy "user owns bot rules" on social_bot_rules
  for all using (auth.uid() = user_id);

-- Conversation log: every incoming event + what the bot did
create table if not exists social_bot_conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform      text not null,
  account_id    text not null,
  event_type    text not null,      -- 'comment' | 'dm'
  sender_id     text,               -- FB user id who triggered
  sender_name   text,
  post_id       text,               -- FB post id (for comments)
  comment_id    text,               -- FB comment id
  message_in    text,               -- what they said
  rule_id       uuid references social_bot_rules(id) on delete set null,
  rule_name     text,               -- snapshot in case rule is deleted
  action_taken  text,               -- 'replied_comment' | 'sent_dm' | 'liked' | 'none'
  reply_sent    text,               -- what we actually sent
  raw_payload   jsonb,              -- full webhook payload for debugging
  created_at    timestamptz not null default now()
);

alter table social_bot_conversations enable row level security;
create policy "user owns conversations" on social_bot_conversations
  for all using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_bot_rules_user    on social_bot_rules(user_id);
create index if not exists idx_bot_rules_account on social_bot_rules(user_id, account_id, platform, is_active);
create index if not exists idx_bot_convs_user    on social_bot_conversations(user_id, created_at desc);
create index if not exists idx_bot_convs_account on social_bot_conversations(account_id, created_at desc);
