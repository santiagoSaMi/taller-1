CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
BEGIN
    RETURN COALESCE(current_setting('request.jwt.claim.role', true), 'service_role');
END;
$$ LANGUAGE plpgsql;