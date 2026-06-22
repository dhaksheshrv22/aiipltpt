
-- Allow monthly-pass payment types
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type = ANY (ARRAY['Advance','Exit','Partial','Monthly Pass','Monthly Pass Renewal','Monthly Pass Adjustment']));

-- Backfill: rename any 'Advance' rows that were really monthly-pass imports
UPDATE public.payments
SET payment_type = 'Monthly Pass'
WHERE payment_type = 'Advance'
  AND notes ILIKE '%monthly pass%';

-- For every Paid monthly pass missing a matching pass payment, insert one
INSERT INTO public.payments (vehicle_number, payment_type, amount, payment_mode, notes)
SELECT mp.vehicle_number, 'Monthly Pass', mp.amount, mp.payment_mode, 'Backfilled — pass ' || mp.pass_id
FROM public.monthly_passes mp
WHERE mp.payment_status = 'Paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.vehicle_number = mp.vehicle_number
      AND p.payment_type IN ('Monthly Pass','Monthly Pass Renewal','Monthly Pass Adjustment')
  );
