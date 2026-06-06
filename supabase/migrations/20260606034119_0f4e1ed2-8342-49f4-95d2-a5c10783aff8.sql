DROP POLICY IF EXISTS "Anyone can manage deleted vehicles" ON public.deleted_vehicles;
REVOKE ALL ON public.deleted_vehicles FROM anon;
CREATE POLICY "Authenticated users can manage deleted vehicles" ON public.deleted_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);