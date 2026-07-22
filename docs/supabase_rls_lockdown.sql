-- Supabase security hardening for Tender AI.
--
-- Use this when the app talks to Supabase only through the FastAPI backend
-- DATABASE_URL, not through Supabase JS/PostgREST from the browser.
--
-- What this does:
-- 1. Enables Row Level Security on every existing public table.
-- 2. Removes table and sequence access from Supabase public API roles.
-- 3. Applies the same restrictions to future public tables/sequences.
--
-- It intentionally does NOT use FORCE ROW LEVEL SECURITY, so your backend
-- connection as the table owner/postgres role can continue to work.

DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            table_record.schemaname,
            table_record.tablename
        );

        EXECUTE format(
            'REVOKE ALL ON TABLE %I.%I FROM anon, authenticated',
            table_record.schemaname,
            table_record.tablename
        );
    END LOOP;
END $$;

DO $$
DECLARE
    sequence_record RECORD;
BEGIN
    FOR sequence_record IN
        SELECT sequence_schema, sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format(
            'REVOKE ALL ON SEQUENCE %I.%I FROM anon, authenticated',
            sequence_record.sequence_schema,
            sequence_record.sequence_name
        );
    END LOOP;
END $$;

REVOKE ALL ON SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM anon, authenticated;
