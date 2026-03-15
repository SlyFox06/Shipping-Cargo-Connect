-- Add departure_date to containers table
ALTER TABLE containers ADD COLUMN IF NOT EXISTS departure_date DATE;

-- Add delivery_deadline to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_deadline DATE;

-- Update existing containers to set departure_date equal to available_until if not set
UPDATE containers 
SET departure_date = available_until 
WHERE departure_date IS NULL AND available_until IS NOT NULL;

-- Create function to automatically calculate delivery_deadline when booking is created
CREATE OR REPLACE FUNCTION calculate_delivery_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Set delivery_deadline to 2 days before container departure_date
  SELECT departure_date - INTERVAL '2 days' INTO NEW.delivery_deadline
  FROM containers
  WHERE id = NEW.container_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-calculate delivery_deadline on booking insert
DROP TRIGGER IF EXISTS set_delivery_deadline ON bookings;
CREATE TRIGGER set_delivery_deadline
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION calculate_delivery_deadline();