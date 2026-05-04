-- Monthly Passes table
CREATE TABLE public.monthly_passes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pass_id TEXT NOT NULL UNIQUE,
  vehicle_number TEXT NOT NULL,
  owner_name TEXT,
  owner_mobile TEXT NOT NULL,
  num_wheels INTEGER NOT NULL,
  pricing_category TEXT NOT NULL,
  daily_rate INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  pass_start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  pass_expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Paid',
  payment_mode TEXT NOT NULL DEFAULT 'Cash',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_monthly_passes_vehicle ON public.monthly_passes(vehicle_number);
CREATE INDEX idx_monthly_passes_mobile ON public.monthly_passes(owner_mobile);
CREATE INDEX idx_monthly_passes_expiry ON public.monthly_passes(pass_expiry_date);

-- Prevent duplicate ACTIVE passes for same vehicle
CREATE UNIQUE INDEX idx_monthly_passes_unique_active
  ON public.monthly_passes(vehicle_number)
  WHERE is_active = true;

ALTER TABLE public.monthly_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view monthly passes"
  ON public.monthly_passes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert monthly passes"
  ON public.monthly_passes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update monthly passes"
  ON public.monthly_passes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete monthly passes"
  ON public.monthly_passes FOR DELETE TO authenticated USING (true);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_monthly_passes_updated_at
  BEFORE UPDATE ON public.monthly_passes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add monthly pass linkage to active vehicles
ALTER TABLE public.active_vehicles
  ADD COLUMN IF NOT EXISTS monthly_pass_id UUID REFERENCES public.monthly_passes(id),
  ADD COLUMN IF NOT EXISTS is_monthly_pass BOOLEAN NOT NULL DEFAULT false;