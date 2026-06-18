ALTER TABLE public.active_vehicles DROP CONSTRAINT active_vehicles_payment_mode_check;
ALTER TABLE public.active_vehicles ALTER COLUMN payment_mode DROP NOT NULL;
ALTER TABLE public.active_vehicles ADD CONSTRAINT active_vehicles_payment_mode_check CHECK (payment_mode IS NULL OR payment_mode = ANY (ARRAY['Cash'::text,'UPI'::text,'Card'::text,'Monthly Pass'::text,'Due'::text]));