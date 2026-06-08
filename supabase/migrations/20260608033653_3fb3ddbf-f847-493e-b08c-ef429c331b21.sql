
CREATE TABLE public.token_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.token_counters TO authenticated;
GRANT ALL ON public.token_counters TO service_role;

ALTER TABLE public.token_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read token counters"
ON public.token_counters FOR SELECT TO authenticated USING (true);

ALTER TABLE public.active_vehicles ADD COLUMN IF NOT EXISTS token_number text;
ALTER TABLE public.vehicle_history ADD COLUMN IF NOT EXISTS token_number text;

CREATE OR REPLACE FUNCTION public.next_token_number(_prefix text DEFAULT 'AIIPL')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year integer := EXTRACT(YEAR FROM now())::int;
  _next integer;
BEGIN
  INSERT INTO public.token_counters (year, last_number)
  VALUES (_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.token_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO _next;

  RETURN _prefix || '-' || _year::text || '-' || lpad(_next::text, 5, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_token_number(text) TO authenticated;
