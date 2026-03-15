-- Add space and weight tracking columns to containers
ALTER TABLE containers 
ADD COLUMN IF NOT EXISTS total_volume_m3 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS available_volume_m3 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS total_weight_capacity_kg NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS available_weight_kg NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS utilization_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_per_m3 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS shared_booking_enabled BOOLEAN DEFAULT TRUE;

-- Add volume and weight tracking to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS booked_volume_m3 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS booked_weight_kg NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS price_per_m3 NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS space_utilization_percent NUMERIC(5,2);

-- Create function to update container utilization after booking
CREATE OR REPLACE FUNCTION update_container_utilization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  container_rec RECORD;
BEGIN
  -- Get container details
  SELECT * INTO container_rec FROM containers WHERE id = NEW.container_id;
  
  -- Update available space and weight
  UPDATE containers 
  SET 
    available_volume_m3 = GREATEST(0, total_volume_m3 - (
      SELECT COALESCE(SUM(booked_volume_m3), 0) 
      FROM bookings 
      WHERE container_id = NEW.container_id 
      AND status != 'cancelled'
    )),
    available_weight_kg = GREATEST(0, total_weight_capacity_kg - (
      SELECT COALESCE(SUM(booked_weight_kg), 0) 
      FROM bookings 
      WHERE container_id = NEW.container_id 
      AND status != 'cancelled'
    )),
    utilization_rate = CASE 
      WHEN total_volume_m3 > 0 THEN
        LEAST(100, ((total_volume_m3 - GREATEST(0, total_volume_m3 - (
          SELECT COALESCE(SUM(booked_volume_m3), 0) 
          FROM bookings 
          WHERE container_id = NEW.container_id 
          AND status != 'cancelled'
        ))) / total_volume_m3) * 100)
      ELSE 0
    END,
    status = CASE 
      WHEN (total_volume_m3 - (
        SELECT COALESCE(SUM(booked_volume_m3), 0) 
        FROM bookings 
        WHERE container_id = NEW.container_id 
        AND status != 'cancelled'
      )) <= 0 OR (total_weight_capacity_kg - (
        SELECT COALESCE(SUM(booked_weight_kg), 0) 
        FROM bookings 
        WHERE container_id = NEW.container_id 
        AND status != 'cancelled'
      )) <= 0 
      THEN 'unavailable'
      ELSE 'available'
    END
  WHERE id = NEW.container_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update utilization
DROP TRIGGER IF EXISTS trigger_update_container_utilization ON bookings;
CREATE TRIGGER trigger_update_container_utilization
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_container_utilization();

-- Initialize volume and weight for existing containers (based on dimensions)
UPDATE containers 
SET 
  total_volume_m3 = ROUND((length_ft * 0.3048) * (width_ft * 0.3048) * (height_ft * 0.3048), 2),
  available_volume_m3 = ROUND((length_ft * 0.3048) * (width_ft * 0.3048) * (height_ft * 0.3048), 2),
  total_weight_capacity_kg = capacity_kg,
  available_weight_kg = capacity_kg,
  price_per_m3 = ROUND(base_rate_per_sqft * 10.764, 2), -- Convert sq ft to m3 pricing
  shared_booking_enabled = TRUE
WHERE total_volume_m3 IS NULL;