
-- Track payments collected during temporary exit on the active session
ALTER TABLE public.active_vehicles
  ADD COLUMN IF NOT EXISTS temp_exit_payment_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temp_exit_payment_mode text,
  ADD COLUMN IF NOT EXISTS temp_exit_payment_at timestamp with time zone;

-- Mirror temp-exit info on the final history row for receipts/audit
ALTER TABLE public.vehicle_history
  ADD COLUMN IF NOT EXISTS temp_exit_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS return_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS temp_exit_payment_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS temp_exit_payment_mode text,
  ADD COLUMN IF NOT EXISTS temp_exit_payment_at timestamp with time zone;

-- Configurable rest hours allowed on a temporary exit
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS temp_exit_rest_hours integer NOT NULL DEFAULT 4;
