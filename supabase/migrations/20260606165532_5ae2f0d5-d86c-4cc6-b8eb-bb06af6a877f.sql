
-- SHIFTS
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_name text NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert shifts" ON public.shifts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update shifts" ON public.shifts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete shifts" ON public.shifts FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CASH RECONCILIATIONS
CREATE TABLE public.cash_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recon_date date NOT NULL DEFAULT (now()::date),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  operator_name text NOT NULL,
  expected_cash numeric NOT NULL DEFAULT 0,
  counted_cash numeric NOT NULL DEFAULT 0,
  variance numeric NOT NULL DEFAULT 0,
  notes text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_reconciliations TO authenticated;
GRANT ALL ON public.cash_reconciliations TO service_role;
ALTER TABLE public.cash_reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read recon" ON public.cash_reconciliations FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert recon" ON public.cash_reconciliations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update recon" ON public.cash_reconciliations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete recon" ON public.cash_reconciliations FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_recon_updated BEFORE UPDATE ON public.cash_reconciliations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ALTERATIONS
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS cash_variance_threshold numeric NOT NULL DEFAULT 100;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.active_vehicles ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.vehicle_history ADD COLUMN IF NOT EXISTS shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL;
