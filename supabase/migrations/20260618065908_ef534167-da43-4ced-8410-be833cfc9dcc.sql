
DELETE FROM public.payments WHERE vehicle_number IN ('TEST-PAID-001','TEST-DUE-002');
DELETE FROM public.vehicle_history WHERE vehicle_number IN ('TEST-PAID-001','TEST-DUE-002');
DELETE FROM public.active_vehicles WHERE vehicle_number IN ('TEST-PAID-001','TEST-DUE-002') OR notes = '__TEST_VEHICLE__';
