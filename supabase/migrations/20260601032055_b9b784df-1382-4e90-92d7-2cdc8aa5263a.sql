-- Allow deleting payments (needed when deleting a wrong vehicle entry)
CREATE POLICY "Authenticated users can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (true);

-- Fresh app: clear all operational data
TRUNCATE TABLE public.payments, public.active_vehicles, public.vehicle_history, public.monthly_passes RESTART IDENTITY;
