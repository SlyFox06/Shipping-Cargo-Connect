-- Fix the restore_container_space_on_cancel function to not use LIKE operator on enum
CREATE OR REPLACE FUNCTION restore_container_space_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore space if booking was previously confirmed and is now cancelled
  -- Changed from LIKE to = since status is an enum
  IF (OLD.status IN ('confirmed', 'pending') AND NEW.status = 'cancelled') THEN
    UPDATE containers
    SET 
      available_volume_m3 = available_volume_m3 + OLD.booked_volume_m3,
      available_weight_kg = available_weight_kg + OLD.booked_weight_kg,
      utilization_rate = CASE 
        WHEN total_volume_m3 > 0 THEN
          LEAST(100, (((total_volume_m3 - (available_volume_m3 + OLD.booked_volume_m3)) / total_volume_m3) * 100))
        ELSE 0
      END,
      status = CASE
        WHEN (available_volume_m3 + OLD.booked_volume_m3) > 0 THEN 'available'
        ELSE status
      END
    WHERE id = NEW.container_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;