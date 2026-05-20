ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS upi_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS upi_payee_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS credit_limit_amount integer NOT NULL DEFAULT 0;