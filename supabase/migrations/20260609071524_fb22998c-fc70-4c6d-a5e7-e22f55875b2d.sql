CREATE POLICY "No updates to payments" ON public.payments FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No client inserts to token_counters" ON public.token_counters FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "No client updates to token_counters" ON public.token_counters FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes from token_counters" ON public.token_counters FOR DELETE TO authenticated USING (false);

REVOKE EXECUTE ON FUNCTION public.next_token_number(text) FROM PUBLIC, anon, authenticated;