
-- 1. Sequential receipt counter (reuse token logic; receipts share token sequence)
-- (next_token_number already exists; we'll alias)
CREATE OR REPLACE FUNCTION public.next_receipt_number(_prefix text DEFAULT 'AIIPL')
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.next_token_number(_prefix); $$;

-- 2. Transactional exit RPC
CREATE OR REPLACE FUNCTION public.process_vehicle_exit(
  _vehicle_id uuid,
  _exit_time timestamptz,
  _total_hours numeric,
  _billable_days numeric,
  _gross_amount integer,
  _balance_amount integer,
  _exit_payment_mode text,
  _amount_paying integer,
  _final_payment_status text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v active_vehicles%ROWTYPE;
  _history_id uuid;
BEGIN
  SELECT * INTO v FROM active_vehicles WHERE id = _vehicle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found or already exited'; END IF;

  INSERT INTO vehicle_history(
    vehicle_number, driver_mobile, num_wheels, pricing_category, daily_rate,
    entry_time, exit_time, total_hours, total_days_billed, gross_amount,
    advance_paid_amount, balance_amount, payment_mode, exit_payment_mode,
    final_payment_status, token_number
  ) VALUES (
    v.vehicle_number, v.driver_mobile, v.num_wheels, v.pricing_category, v.daily_rate,
    v.entry_time, _exit_time, _total_hours, _billable_days, _gross_amount,
    COALESCE(v.advance_amount,0), _balance_amount, v.payment_mode, _exit_payment_mode,
    _final_payment_status, v.token_number
  ) RETURNING id INTO _history_id;

  IF _amount_paying > 0 THEN
    INSERT INTO payments(history_vehicle_id, vehicle_number, payment_type, amount, payment_mode, notes)
    VALUES (_history_id, v.vehicle_number, 'Exit', _amount_paying, _exit_payment_mode,
      CASE WHEN _balance_amount > 0 THEN 'Partial — ' || _balance_amount || ' pending' ELSE NULL END);
  END IF;

  UPDATE payments SET history_vehicle_id = _history_id WHERE vehicle_id = _vehicle_id;
  DELETE FROM active_vehicles WHERE id = _vehicle_id;
  RETURN _history_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_receipt_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_vehicle_exit(uuid, timestamptz, numeric, numeric, integer, integer, text, integer, text) TO authenticated;

-- 3. Purge legacy TEST records (orphan from 2026-06-01)
DELETE FROM public.payments WHERE vehicle_number = 'TEST';
DELETE FROM public.vehicle_history WHERE vehicle_number = 'TEST';
