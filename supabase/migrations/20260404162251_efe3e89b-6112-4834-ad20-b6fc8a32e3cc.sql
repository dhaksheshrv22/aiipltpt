
-- Create active_vehicles table
CREATE TABLE public.active_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  driver_mobile TEXT NOT NULL,
  num_wheels INTEGER NOT NULL,
  pricing_category TEXT NOT NULL,
  daily_rate INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card')),
  advance_paid BOOLEAN DEFAULT false,
  advance_amount INTEGER DEFAULT 0,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Due')),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_exit TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.active_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active vehicles" ON public.active_vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert active vehicles" ON public.active_vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update active vehicles" ON public.active_vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete active vehicles" ON public.active_vehicles FOR DELETE TO authenticated USING (true);

-- Create vehicle_history table
CREATE TABLE public.vehicle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL,
  driver_mobile TEXT NOT NULL,
  num_wheels INTEGER NOT NULL,
  pricing_category TEXT NOT NULL,
  daily_rate INTEGER NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ NOT NULL,
  total_hours NUMERIC(10,2),
  total_days_billed NUMERIC(10,2),
  gross_amount INTEGER NOT NULL,
  advance_paid_amount INTEGER DEFAULT 0,
  balance_amount INTEGER NOT NULL,
  payment_mode TEXT NOT NULL,
  exit_payment_mode TEXT,
  final_payment_status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.vehicle_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vehicle history" ON public.vehicle_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert vehicle history" ON public.vehicle_history FOR INSERT TO authenticated WITH CHECK (true);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.active_vehicles(id) ON DELETE SET NULL,
  history_vehicle_id UUID,
  vehicle_number TEXT NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('Advance', 'Exit', 'Partial')),
  amount INTEGER NOT NULL,
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('Cash', 'UPI', 'Card')),
  paid_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name TEXT DEFAULT 'Heavy Vehicle Parking',
  max_stay_days INTEGER DEFAULT 7,
  advance_warning_hours INTEGER DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (true);

-- Insert default settings
INSERT INTO public.app_settings (facility_name, max_stay_days, advance_warning_hours) VALUES ('Heavy Vehicle Parking', 7, 24);
