-- Add multi-leg transport fields to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS drop_address TEXT,
ADD COLUMN IF NOT EXISTS final_delivery_date DATE,
ADD COLUMN IF NOT EXISTS transport_legs JSONB DEFAULT '[]'::jsonb;

-- Create index for faster transport_legs queries
CREATE INDEX IF NOT EXISTS idx_bookings_transport_legs ON bookings USING GIN (transport_legs);

-- Create function to initialize transport legs when booking is created
CREATE OR REPLACE FUNCTION initialize_transport_legs()
RETURNS TRIGGER AS $$
DECLARE
  container_rec RECORD;
BEGIN
  -- Get container details
  SELECT origin, destination, available_from, departure_date 
  INTO container_rec 
  FROM containers 
  WHERE id = NEW.container_id;
  
  -- Initialize 3-leg transport plan
  NEW.transport_legs := jsonb_build_array(
    jsonb_build_object(
      'leg_number', 1,
      'leg_type', 'pickup_truck',
      'description', 'Pickup from origin address',
      'status', 'pending',
      'location', NEW.pickup_address,
      'scheduled_date', NEW.pickup_date,
      'completed_date', NULL,
      'updated_at', NOW()
    ),
    jsonb_build_object(
      'leg_number', 2,
      'leg_type', 'sea_shipping',
      'description', 'Port-to-port vessel shipping',
      'status', 'pending',
      'origin_port', container_rec.origin,
      'destination_port', container_rec.destination,
      'scheduled_departure', container_rec.available_from,
      'scheduled_arrival', container_rec.departure_date,
      'completed_date', NULL,
      'updated_at', NOW()
    ),
    jsonb_build_object(
      'leg_number', 3,
      'leg_type', 'delivery_truck',
      'description', 'Final delivery to destination address',
      'status', 'pending',
      'location', NEW.drop_address,
      'scheduled_date', NEW.final_delivery_date,
      'completed_date', NULL,
      'updated_at', NOW()
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-initialize transport legs
DROP TRIGGER IF EXISTS init_transport_legs_trigger ON bookings;
CREATE TRIGGER init_transport_legs_trigger
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION initialize_transport_legs();

-- Create function to update individual transport leg status
CREATE OR REPLACE FUNCTION update_transport_leg_status(
  p_booking_id UUID,
  p_leg_number INTEGER,
  p_status TEXT,
  p_completed_date TIMESTAMP DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_legs JSONB;
  v_leg JSONB;
  v_updated_legs JSONB := '[]'::jsonb;
BEGIN
  -- Get current transport legs
  SELECT transport_legs INTO v_legs FROM bookings WHERE id = p_booking_id;
  
  -- Update the specific leg
  FOR v_leg IN SELECT * FROM jsonb_array_elements(v_legs)
  LOOP
    IF (v_leg->>'leg_number')::integer = p_leg_number THEN
      v_leg := jsonb_set(v_leg, '{status}', to_jsonb(p_status));
      v_leg := jsonb_set(v_leg, '{updated_at}', to_jsonb(NOW()));
      
      IF p_completed_date IS NOT NULL THEN
        v_leg := jsonb_set(v_leg, '{completed_date}', to_jsonb(p_completed_date));
      END IF;
    END IF;
    
    v_updated_legs := v_updated_legs || v_leg;
  END LOOP;
  
  -- Update the booking
  UPDATE bookings 
  SET transport_legs = v_updated_legs,
      updated_at = NOW()
  WHERE id = p_booking_id;
  
  RETURN v_updated_legs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;