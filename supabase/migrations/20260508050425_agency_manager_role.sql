-- Add 'agency_manager' to the app_role enum so users with this role can
-- access the /agency interface (Yacht Agency OS for Daniela / partner agencies).
--
-- Postgres requires `ALTER TYPE ... ADD VALUE` to run outside any transaction
-- that issues additional DDL on the same enum, so this migration is intentionally
-- a single statement and contains no other DDL.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agency_manager';
