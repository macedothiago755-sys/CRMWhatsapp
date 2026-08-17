-- Migration: 0002_crm_phase2
-- Description: Phase 2 (CRM) support — identity merge review queue, admin
-- sessions, and reference/lookup data (RBAC catalog, consent purposes).
-- Reversible: see 0002_crm_phase2.down.sql
--
-- The RBAC and consent-purpose rows below are reference/lookup data every
-- environment needs (docs/architecture/data-architecture.md §3: "enum-like
-- columns... are lookup tables"), not synthetic test data — that's why they
-- live in a migration rather than database/seeds/.

begin;

-- ---------------------------------------------------------------------------
-- crm.customer_merge_candidate — ambiguous identity matches are never
-- auto-merged (docs/architecture/domain-model.md §3); they land here for
-- manual review instead.
-- ---------------------------------------------------------------------------
create table crm.customer_merge_candidate (
  id uuid primary key default gen_random_uuid(),
  candidate_customer_ids uuid[] not null,
  matched_identity_type text not null,
  matched_identity_value text not null,
  status text not null default 'pending' check (status in ('pending', 'merged', 'rejected')),
  resolved_by uuid references security.app_user(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_merge_candidate_status on crm.customer_merge_candidate(status);

-- ---------------------------------------------------------------------------
-- security.app_user — add password_hash for local email/password admin auth
-- (docs/security/security-architecture.md §1: argon2id, never reversible
-- encryption). Nullable because a future SSO-backed user may have no local
-- password at all.
-- ---------------------------------------------------------------------------
alter table security.app_user add column password_hash text;

-- ---------------------------------------------------------------------------
-- security.session — server-side, revocable admin sessions
-- (docs/security/security-architecture.md §1).
-- ---------------------------------------------------------------------------
create table security.session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references security.app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index idx_session_user on security.session(user_id);
create index idx_session_expires_at on security.session(expires_at);

-- ---------------------------------------------------------------------------
-- RBAC reference data — see packages/security/src/rbac.ts (the typed
-- catalog this mirrors) and docs/security/security-architecture.md §2.
-- ---------------------------------------------------------------------------
insert into security.role (key, name, description) values
  ('SUPER_ADMIN', 'Super Admin', 'Full platform access, including security and RBAC administration.'),
  ('ADMIN', 'Admin', 'Full operational access excluding security/RBAC administration.'),
  ('MARKETING', 'Marketing', 'Campaigns, audiences, and analytics access.'),
  ('CRM_MANAGER', 'CRM Manager', 'Full customer data read/write, consent management.'),
  ('CUSTOMER_SERVICE', 'Customer Service', 'Conversation handling and read access to customer data.'),
  ('ANALYST', 'Analyst', 'Read-only access to analytics and customer data.'),
  ('VIEWER', 'Viewer', 'Read-only access across the admin application.');

insert into security.permission (key, description) values
  ('customer.read', 'View customer records.'),
  ('customer.write', 'Create and update customer records.'),
  ('customer.delete', 'Delete/anonymize customer records (LGPD erasure).'),
  ('conversation.read', 'View conversations.'),
  ('conversation.manage', 'Manage/assign/resolve conversations.'),
  ('campaign.create', 'Create campaigns.'),
  ('campaign.send', 'Send campaigns.'),
  ('ai.prompt.read', 'View AI prompts.'),
  ('ai.prompt.write', 'Create/edit AI prompt versions.'),
  ('knowledge.publish', 'Publish knowledge document versions.'),
  ('analytics.read', 'View analytics and reports.');

-- SUPER_ADMIN and ADMIN: every permission.
insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r cross join security.permission p
where r.key in ('SUPER_ADMIN', 'ADMIN');

insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r join security.permission p
  on p.key in ('campaign.create', 'campaign.send', 'analytics.read', 'customer.read')
where r.key = 'MARKETING';

insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r join security.permission p
  on p.key in ('customer.read', 'customer.write', 'customer.delete', 'conversation.read', 'analytics.read')
where r.key = 'CRM_MANAGER';

insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r join security.permission p
  on p.key in ('customer.read', 'conversation.read', 'conversation.manage')
where r.key = 'CUSTOMER_SERVICE';

insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r join security.permission p
  on p.key in ('customer.read', 'conversation.read', 'analytics.read', 'ai.prompt.read')
where r.key = 'ANALYST';

insert into security.role_permission (role_id, permission_id)
select r.id, p.id from security.role r join security.permission p
  on p.key in ('customer.read', 'conversation.read', 'analytics.read')
where r.key = 'VIEWER';

-- ---------------------------------------------------------------------------
-- Consent purposes — see docs/security/security-architecture.md §7.
-- ---------------------------------------------------------------------------
insert into consent.consent_purpose (key, name, description, required) values
  ('transactional', 'Transactional messaging', 'Order/service messages required to fulfill a purchase or support request.', true),
  ('marketing', 'Marketing messaging', 'Promotional messages, campaigns, and offers.', false),
  ('ai_processing', 'AI processing', 'Use of conversation data by the AI orchestrator to personalize responses.', false),
  ('analytics', 'Analytics', 'Use of customer data in aggregate/behavioral analytics.', false);

commit;
