
-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant only to authenticated + service_role
REVOKE ALL ON FUNCTION public.next_token_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_token_number(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.next_receipt_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.process_vehicle_exit(uuid, timestamptz, numeric, numeric, integer, integer, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_vehicle_exit(uuid, timestamptz, numeric, numeric, integer, integer, text, integer, text) TO authenticated, service_role;

-- Trigger helper — should never be callable via API
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
