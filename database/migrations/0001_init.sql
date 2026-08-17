-- Migration: 0001_init
-- Description: Foundational schema for Polar AI Commerce — all bounded contexts.
-- Reversible: see 0001_init.down.sql
-- Notes:
--   * One schema per bounded context (crm, conversation, ai, commerce, knowledge,
--     campaign, consent, analytics, security). Cross-schema FKs are allowed (same
--     database) but cross-schema *code* access must go through the owning package.
--   * updated_at is maintained by trigger, not application code.
--   * Soft delete (deleted_at) only on entities with a real lifecycle; consent and
--     audit tables are append-only/never soft-deleted.

begin;

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;     -- pgvector, for knowledge.embedding

create schema if not exists crm;
create schema if not exists conversation;
create schema if not exists ai;
create schema if not exists commerce;
create schema if not exists knowledge;
create schema if not exists campaign;
create schema if not exists consent;
create schema if not exists analytics;
create schema if not exists security;

-- ---------------------------------------------------------------------------
-- Shared helper: updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =============================================================================
-- SECURITY (created early: referenced by audit_log and by "actor" columns)
-- =============================================================================

create table security.role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- SUPER_ADMIN, ADMIN, MARKETING, CRM_MANAGER, CUSTOMER_SERVICE, ANALYST, VIEWER
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table security.permission (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- e.g. customer.read, campaign.send
  description text,
  created_at timestamptz not null default now()
);

create table security.role_permission (
  role_id uuid not null references security.role(id) on delete cascade,
  permission_id uuid not null references security.permission(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table security.app_user (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_app_user_updated_at before update on security.app_user
  for each row execute function public.set_updated_at();

create table security.user_role (
  user_id uuid not null references security.app_user(id) on delete cascade,
  role_id uuid not null references security.role(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table security.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references security.app_user(id),
  actor_type text not null check (actor_type in ('human','system','ai')),
  action text not null,                   -- e.g. customer.updated, prompt.updated
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_address text,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_audit_log_entity on security.audit_log(entity_type, entity_id);
create index idx_audit_log_actor on security.audit_log(actor_user_id);
create index idx_audit_log_occurred_at on security.audit_log(occurred_at);

-- =============================================================================
-- CRM
-- =============================================================================

create table crm.customer (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','blocked','merged')),
  merged_into_customer_id uuid references crm.customer(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger trg_customer_updated_at before update on crm.customer
  for each row execute function public.set_updated_at();
create index idx_customer_merged_into on crm.customer(merged_into_customer_id) where merged_into_customer_id is not null;

create table crm.customer_identity (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  identity_type text not null check (identity_type in ('whatsapp','phone','email','vtex_customer_id','external')),
  identity_value text not null,           -- normalized (E.164 phone, lowercase email, wa_id)
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (identity_type, identity_value)
);
create trigger trg_customer_identity_updated_at before update on crm.customer_identity
  for each row execute function public.set_updated_at();
create index idx_customer_identity_customer on crm.customer_identity(customer_id);

create table crm.customer_profile (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references crm.customer(id) on delete cascade,
  first_name text,
  last_name text,
  birth_date date,
  gender text,
  locale text default 'pt-BR',
  country text default 'BR',
  state text,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_customer_profile_updated_at before update on crm.customer_profile
  for each row execute function public.set_updated_at();

create table crm.customer_sport_profile (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  sport text not null,
  is_primary boolean not null default false,
  level text,                             -- beginner, intermediate, advanced
  frequency text,                         -- e.g. 3x_week
  goal text,                              -- e.g. performance, health, weight_loss
  experience text,
  distance_km numeric,
  routine text,
  source text not null default 'inferred' check (source in ('explicit','inferred','imported')),
  confidence numeric check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, sport)
);
create trigger trg_customer_sport_profile_updated_at before update on crm.customer_sport_profile
  for each row execute function public.set_updated_at();

create table crm.customer_preference (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  attribute text not null,
  value text not null,
  confidence numeric check (confidence between 0 and 1),
  source text not null check (source in ('explicit','inferred','imported')),
  source_conversation_id uuid,            -- FK added after conversation.conversation exists
  source_message_id uuid,                 -- FK added after conversation.message exists
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);
create trigger trg_customer_preference_updated_at before update on crm.customer_preference
  for each row execute function public.set_updated_at();
create index idx_customer_preference_customer on crm.customer_preference(customer_id);
create unique index uq_customer_preference_current on crm.customer_preference(customer_id, attribute) where is_current;

create table crm.customer_segment (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  definition jsonb,                       -- rule-based segment definition, null = static/manual
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_customer_segment_updated_at before update on crm.customer_segment
  for each row execute function public.set_updated_at();

create table crm.customer_segment_membership (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  segment_id uuid not null references crm.customer_segment(id) on delete cascade,
  added_at timestamptz not null default now(),
  removed_at timestamptz
);
create index idx_segment_membership_customer on crm.customer_segment_membership(customer_id);
create unique index uq_segment_membership_active on crm.customer_segment_membership(customer_id, segment_id) where removed_at is null;

create table crm.customer_tag (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (customer_id, tag)
);

create table crm.customer_timeline (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  description text,
  metadata jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_customer_timeline_customer on crm.customer_timeline(customer_id, occurred_at desc);

-- =============================================================================
-- CONVERSATION
-- =============================================================================

create table conversation.conversation (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id),
  channel text not null default 'whatsapp',
  status text not null default 'NEW' check (status in
    ('NEW','ACTIVE','QUALIFYING','RECOMMENDING','PURCHASING','CHECKOUT','POST_PURCHASE','RESOLVED',
     'ESCALATED','FAILED','BLOCKED')),
  assigned_agent_id uuid,                 -- FK added after ai.agent exists
  assigned_human_user_id uuid references security.app_user(id),
  started_at timestamptz not null default now(),
  last_message_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_conversation_updated_at before update on conversation.conversation
  for each row execute function public.set_updated_at();
create index idx_conversation_customer on conversation.conversation(customer_id);
create index idx_conversation_status on conversation.conversation(status);

create table conversation.message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversation.conversation(id) on delete cascade,
  customer_id uuid not null references crm.customer(id),
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null check (message_type in
    ('text','image','audio','video','document','interactive','template','location','sticker','contacts','unknown')),
  provider_message_id text unique,        -- Meta WhatsApp message id — dedupe key for webhook idempotency
  status text not null default 'received' check (status in ('received','sent','delivered','read','failed')),
  body_text text,
  payload jsonb not null default '{}'::jsonb,   -- normalized message payload
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_message_updated_at before update on conversation.message
  for each row execute function public.set_updated_at();
create index idx_message_conversation on conversation.message(conversation_id, created_at);
create index idx_message_customer on conversation.message(customer_id);

alter table crm.customer_preference
  add constraint fk_preference_conversation foreign key (source_conversation_id)
    references conversation.conversation(id),
  add constraint fk_preference_message foreign key (source_message_id)
    references conversation.message(id);

create table conversation.message_attachment (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references conversation.message(id) on delete cascade,
  media_type text not null,
  storage_url text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now()
);
create index idx_attachment_message on conversation.message_attachment(message_id);

create table conversation.conversation_intent (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversation.conversation(id) on delete cascade,
  message_id uuid references conversation.message(id),
  intent text not null,
  confidence numeric check (confidence between 0 and 1),
  source text not null default 'ai' check (source in ('ai','rules','human')),
  created_at timestamptz not null default now()
);
create index idx_conversation_intent_conversation on conversation.conversation_intent(conversation_id);

create table conversation.conversation_summary (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversation.conversation(id) on delete cascade,
  summary_text text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);
create index idx_conversation_summary_conversation on conversation.conversation_summary(conversation_id, version desc);

-- =============================================================================
-- AI
-- =============================================================================

create table ai.agent (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- sales, support, order, crm, insight
  name text not null,
  description text,
  allowed_tools text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_agent_updated_at before update on ai.agent
  for each row execute function public.set_updated_at();

alter table conversation.conversation
  add constraint fk_conversation_agent foreign key (assigned_agent_id) references ai.agent(id);

create table ai.prompt_version (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai.agent(id) on delete cascade,
  version text not null,                  -- e.g. v1, v2, v3
  content text not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references security.app_user(id),
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);
create index idx_prompt_version_agent on ai.prompt_version(agent_id, status);

create table ai.agent_execution (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references ai.agent(id),
  prompt_version_id uuid not null references ai.prompt_version(id),
  conversation_id uuid references conversation.conversation(id),
  customer_id uuid references crm.customer(id),
  model text not null,
  model_version text,
  knowledge_version text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  status text not null check (status in ('success','error','timeout')),
  error text,
  created_at timestamptz not null default now()
);
create index idx_agent_execution_conversation on ai.agent_execution(conversation_id);
create index idx_agent_execution_customer on ai.agent_execution(customer_id);
create index idx_agent_execution_created_at on ai.agent_execution(created_at);

create table ai.tool (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- e.g. get_customer, search_products
  description text,
  input_schema jsonb not null,
  output_schema jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_tool_updated_at before update on ai.tool
  for each row execute function public.set_updated_at();

create table ai.tool_execution (
  id uuid primary key default gen_random_uuid(),
  agent_execution_id uuid not null references ai.agent_execution(id) on delete cascade,
  tool_id uuid not null references ai.tool(id),
  input jsonb not null,
  output jsonb,
  status text not null check (status in ('success','error','denied','timeout')),
  error text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index idx_tool_execution_agent_execution on ai.tool_execution(agent_execution_id);
create index idx_tool_execution_tool on ai.tool_execution(tool_id);

-- =============================================================================
-- COMMERCE  (product_reference/cart before ai.recommendation FK)
-- =============================================================================

create table commerce.product_reference (
  id uuid primary key default gen_random_uuid(),
  vtex_sku_id text not null unique,
  vtex_product_id text not null,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_product_reference_updated_at before update on commerce.product_reference
  for each row execute function public.set_updated_at();

create table commerce.product_snapshot (
  id uuid primary key default gen_random_uuid(),
  product_reference_id uuid not null references commerce.product_reference(id) on delete cascade,
  price numeric,
  currency text default 'BRL',
  stock_available boolean,
  stock_quantity int,
  source text not null default 'VTEX',
  fetched_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_product_snapshot_reference on commerce.product_snapshot(product_reference_id, fetched_at desc);

create table commerce.cart (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id),
  vtex_cart_id text unique,
  status text not null default 'open' check (status in ('open','abandoned','converted','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cart_updated_at before update on commerce.cart
  for each row execute function public.set_updated_at();
create index idx_cart_customer on commerce.cart(customer_id, status);

create table commerce.cart_item (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references commerce.cart(id) on delete cascade,
  product_reference_id uuid not null references commerce.product_reference(id),
  quantity int not null check (quantity > 0),
  unit_price_snapshot numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cart_item_updated_at before update on commerce.cart_item
  for each row execute function public.set_updated_at();
create index idx_cart_item_cart on commerce.cart_item(cart_id);

create table commerce.order_reference (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id),
  vtex_order_id text not null unique,
  cart_id uuid references commerce.cart(id),
  status text not null,
  total numeric,
  currency text default 'BRL',
  placed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_order_reference_updated_at before update on commerce.order_reference
  for each row execute function public.set_updated_at();
create index idx_order_reference_customer on commerce.order_reference(customer_id);

create table ai.recommendation (
  id uuid primary key default gen_random_uuid(),
  agent_execution_id uuid references ai.agent_execution(id),
  customer_id uuid not null references crm.customer(id),
  product_reference_id uuid not null references commerce.product_reference(id),
  rank int,
  reason text,
  accepted boolean,
  created_at timestamptz not null default now()
);
create index idx_recommendation_customer on ai.recommendation(customer_id);

create table ai.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  agent_execution_id uuid references ai.agent_execution(id),
  recommendation_id uuid references ai.recommendation(id),
  customer_id uuid references crm.customer(id),
  feedback_type text not null check (feedback_type in ('thumbs_up','thumbs_down','correction','complaint')),
  comment text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- KNOWLEDGE
-- =============================================================================

create table knowledge.source (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('manual','imported','generated')),
  created_at timestamptz not null default now()
);

create table knowledge.document (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references knowledge.source(id),
  title text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_document_updated_at before update on knowledge.document
  for each row execute function public.set_updated_at();

create table knowledge.document_version (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge.document(id) on delete cascade,
  version int not null,
  content text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','PUBLISHED','ARCHIVED')),
  author text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);
create index idx_document_version_document on knowledge.document_version(document_id, status);

create table knowledge.chunk (
  id uuid primary key default gen_random_uuid(),
  document_version_id uuid not null references knowledge.document_version(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int,
  created_at timestamptz not null default now(),
  unique (document_version_id, chunk_index)
);

create table knowledge.embedding (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null unique references knowledge.chunk(id) on delete cascade,
  model text not null,
  vector vector(1536) not null,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- CONSENT
-- =============================================================================

create table consent.consent_purpose (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,               -- marketing, transactional, ai_processing, analytics
  name text not null,
  description text,
  required boolean not null default false
);

create table consent.customer_consent (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  purpose_id uuid not null references consent.consent_purpose(id),
  granted boolean not null,
  source text not null,
  version text not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, purpose_id)
);
create trigger trg_customer_consent_updated_at before update on consent.customer_consent
  for each row execute function public.set_updated_at();

create table consent.consent_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm.customer(id) on delete cascade,
  purpose_id uuid not null references consent.consent_purpose(id),
  action text not null check (action in ('granted','revoked')),
  source text not null,
  version text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_consent_history_customer on consent.consent_history(customer_id, occurred_at desc);

-- =============================================================================
-- CAMPAIGN
-- =============================================================================

create table campaign.audience (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment_id uuid references crm.customer_segment(id),
  definition jsonb,
  created_at timestamptz not null default now()
);

create table campaign.template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meta_template_name text not null,
  language text not null default 'pt_BR',
  category text,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_template_updated_at before update on campaign.template
  for each row execute function public.set_updated_at();

create table campaign.campaign (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text,
  status text not null default 'draft' check (status in ('draft','scheduled','running','completed','cancelled')),
  audience_id uuid not null references campaign.audience(id),
  template_id uuid not null references campaign.template(id),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_campaign_updated_at before update on campaign.campaign
  for each row execute function public.set_updated_at();

create table campaign.execution (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaign.campaign(id) on delete cascade,
  started_at timestamptz,
  finished_at timestamptz,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  created_at timestamptz not null default now()
);
create index idx_campaign_execution_campaign on campaign.execution(campaign_id);

create table campaign.delivery (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references campaign.execution(id) on delete cascade,
  customer_id uuid not null references crm.customer(id),
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed','opted_out')),
  provider_message_id text,
  converted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (execution_id, customer_id)
);
create trigger trg_delivery_updated_at before update on campaign.delivery
  for each row execute function public.set_updated_at();
create index idx_delivery_customer on campaign.delivery(customer_id);

-- =============================================================================
-- ANALYTICS  (append-only event log — see docs/architecture/event-model.md)
-- =============================================================================

create table analytics.event (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  dedupe_key text not null unique,        -- idempotency key, e.g. sha256(source + provider_id + type)
  customer_id uuid references crm.customer(id),
  conversation_id uuid references conversation.conversation(id),
  entity_type text,
  entity_id uuid,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_event_type on analytics.event(event_type, occurred_at);
create index idx_event_customer on analytics.event(customer_id, occurred_at);

-- Narrower, read-optimized projections. Implemented as views (not physical tables)
-- to avoid dual-write drift; see ADR-0010 and docs/architecture/event-model.md.
create view analytics.customer_event as
  select * from analytics.event where customer_id is not null;

create view analytics.commerce_event as
  select * from analytics.event
  where event_type like 'cart.%' or event_type like 'checkout.%' or event_type like 'order.%';

commit;
