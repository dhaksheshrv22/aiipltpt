
CREATE TABLE public.deleted_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL,
  vehicle_number text NOT NULL,
  driver_mobile text,
  entry_time timestamptz,
  vehicle_data jsonb NOT NULL,
  payments_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_reason text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deleted_vehicles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deleted_vehicles TO anon;
GRANT ALL ON public.deleted_vehicles TO service_role;
ALTER TABLE public.deleted_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage deleted vehicles" ON public.deleted_vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_deleted_vehicles_deleted_at ON public.deleted_vehicles(deleted_at DESC);
