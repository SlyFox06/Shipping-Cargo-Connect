-- Add new booking status values to support full workflow
DO $$ 
BEGIN
  -- Add 'in_transit' status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'booking_status' AND e.enumlabel = 'in_transit') THEN
    ALTER TYPE booking_status ADD VALUE 'in_transit';
  END IF;
  
  -- Add 'delivered' status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'booking_status' AND e.enumlabel = 'delivered') THEN
    ALTER TYPE booking_status ADD VALUE 'delivered';
  END IF;
END $$;

-- Enable realtime for bookings table
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- Enable realtime for containers table
ALTER PUBLICATION supabase_realtime ADD TABLE containers;

-- Enable realtime for providers table
ALTER PUBLICATION supabase_realtime ADD TABLE providers;