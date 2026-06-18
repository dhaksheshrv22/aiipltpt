DELETE FROM payments WHERE vehicle_number LIKE 'TEST-FLOW%' OR vehicle_number LIKE 'TEST%';
DELETE FROM active_vehicles WHERE vehicle_number LIKE 'TEST-FLOW%' OR vehicle_number LIKE 'TEST%';
DELETE FROM vehicle_history WHERE vehicle_number LIKE 'TEST-FLOW%' OR vehicle_number LIKE 'TEST%';
DELETE FROM deleted_vehicles WHERE vehicle_number LIKE 'TEST-FLOW%' OR vehicle_number LIKE 'TEST%';