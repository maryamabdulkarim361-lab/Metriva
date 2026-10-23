-- ==============================================================================
-- AI Database Assistant: Least-Privilege Database Role Provisioning
-- ==============================================================================
-- This script provisions an isolated, unprivileged, read-only database user
-- specifically restricted to executing analytics queries on approved tables.
-- ==============================================================================

-- 1. Create a dedicated read-only role with no superuser or creation privileges
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_analytics_readonly') THEN
        CREATE ROLE app_analytics_readonly WITH LOGIN PASSWORD 'change_this_to_a_strong_password_in_prod';
    END IF;
END
$$;

-- 2. Revoke default public schema creation and execution privileges
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM app_analytics_readonly;

-- 3. Grant basic connection and schema usage
GRANT CONNECT ON DATABASE aidb TO app_analytics_readonly;
GRANT USAGE ON SCHEMA public TO app_analytics_readonly;

-- 4. Grant SELECT ONLY on allowed business analytics tables
GRANT SELECT ON TABLE customers TO app_analytics_readonly;
GRANT SELECT ON TABLE products TO app_analytics_readonly;
GRANT SELECT ON TABLE orders TO app_analytics_readonly;
GRANT SELECT ON TABLE order_items TO app_analytics_readonly;
GRANT SELECT ON TABLE payments TO app_analytics_readonly;
GRANT SELECT ON TABLE website_events TO app_analytics_readonly;

-- 5. Expose ONLY safe, non-sensitive columns on the users table (EXCLUDE password_hash)
GRANT SELECT (id, name, email, created_at) ON TABLE users TO app_analytics_readonly;

-- 6. Strictly prohibit access to Django system/auth tables
REVOKE ALL PRIVILEGES ON TABLE auth_permission FROM app_analytics_readonly;
REVOKE ALL PRIVILEGES ON TABLE auth_group FROM app_analytics_readonly;
REVOKE ALL PRIVILEGES ON TABLE django_migrations FROM app_analytics_readonly;
REVOKE ALL PRIVILEGES ON TABLE django_session FROM app_analytics_readonly;
REVOKE ALL PRIVILEGES ON TABLE django_content_type FROM app_analytics_readonly;

-- 7. Restrict execution of dangerous functions and file operations
REVOKE ALL ON FUNCTION pg_read_file(text) FROM PUBLIC, app_analytics_readonly;
REVOKE ALL ON FUNCTION pg_read_file(text, bigint, bigint) FROM PUBLIC, app_analytics_readonly;
REVOKE ALL ON FUNCTION pg_ls_dir(text) FROM PUBLIC, app_analytics_readonly;
REVOKE ALL ON FUNCTION pg_stat_file(text) FROM PUBLIC, app_analytics_readonly;

-- 8. Enforce engine-level statement timeout and read-only defaults for this role
ALTER ROLE app_analytics_readonly SET statement_timeout = '10000'; -- 10 seconds
ALTER ROLE app_analytics_readonly SET default_transaction_read_only = 'on';

