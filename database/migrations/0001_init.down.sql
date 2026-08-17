-- Down-migration for 0001_init. Drops all objects created by the up-migration.
-- Destructive — never run against production without explicit, logged confirmation
-- (see docs/architecture/environment-strategy.md §Migration Safety).

begin;

drop view if exists analytics.commerce_event;
drop view if exists analytics.customer_event;

drop schema if exists analytics cascade;
drop schema if exists campaign cascade;
drop schema if exists consent cascade;
drop schema if exists knowledge cascade;
drop schema if exists commerce cascade;
drop schema if exists ai cascade;
drop schema if exists conversation cascade;
drop schema if exists crm cascade;
drop schema if exists security cascade;

drop function if exists public.set_updated_at();

commit;
