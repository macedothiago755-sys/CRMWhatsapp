-- Down-migration for 0002_crm_phase2.
-- Destructive — never run against production without explicit, logged
-- confirmation (docs/architecture/environment-strategy.md §3). This purges any
-- consent/session/RBAC-assignment data that depends on what this migration
-- created, not just the reference rows themselves — reverting the migration
-- reasonably implies removing everything that depended on it existing.

begin;

-- Dependent application data first (FKs would otherwise block the reference-
-- data deletes below).
delete from consent.consent_history;
delete from consent.customer_consent;
delete from security.user_role;

delete from consent.consent_purpose where key in ('transactional', 'marketing', 'ai_processing', 'analytics');

delete from security.role_permission;
delete from security.permission;
delete from security.role;

drop table if exists security.session;
alter table security.app_user drop column if exists password_hash;
drop table if exists crm.customer_merge_candidate;

commit;
