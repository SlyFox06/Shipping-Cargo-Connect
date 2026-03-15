-- Add cancellation and refund fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_by text CHECK (cancelled_by IN ('trader', 'provider')),
ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'not_applicable',
ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_reason text,
ADD COLUMN IF NOT EXISTS refund_processed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS refund_percentage numeric DEFAULT 0;

-- Add new booking statuses for cancellations
COMMENT ON COLUMN public.bookings.status IS 'Booking status: pending, confirmed, in_transit, delivered, cancelled, cancelled_by_trader, cancelled_by_provider';

-- Create function to restore container space on cancellation
CREATE OR REPLACE FUNCTION restore_container_space_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Only restore space if booking was previously confirmed and is now cancelled
  IF (OLD.status IN ('confirmed', 'pending') AND NEW.status LIKE 'cancelled%') THEN
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

-- Create trigger for space restoration
DROP TRIGGER IF EXISTS restore_space_on_booking_cancel ON public.bookings;
CREATE TRIGGER restore_space_on_booking_cancel
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION restore_container_space_on_cancel();

-- Create function to calculate refund amount
CREATE OR REPLACE FUNCTION calculate_refund_amount(
  p_booking_id uuid,
  p_cancelled_by text
)
RETURNS TABLE(
  refund_amount numeric,
  refund_percentage numeric,
  refund_status text
) AS $$
DECLARE
  v_booking RECORD;
  v_hours_since_confirmation numeric;
  v_hours_until_departure numeric;
  v_refund_pct numeric := 0;
  v_refund_amt numeric := 0;
  v_refund_status text := 'not_applicable';
BEGIN
  -- Get booking details
  SELECT b.*, c.departure_date, b.booking_date
  INTO v_booking
  FROM bookings b
  JOIN containers c ON b.container_id = c.id
  WHERE b.id = p_booking_id;

  -- Cannot refund if in transit or delivered
  IF v_booking.status IN ('in_transit', 'delivered') THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 'not_applicable'::text;
    RETURN;
  END IF;

  -- Provider cancellation = full refund
  IF p_cancelled_by = 'provider' THEN
    v_refund_pct := 100;
    v_refund_amt := v_booking.price_usd;
    v_refund_status := 'refunded_by_provider';
  
  -- Trader cancellation before confirmation = full refund
  ELSIF p_cancelled_by = 'trader' AND v_booking.status = 'pending' THEN
    v_refund_pct := 100;
    v_refund_amt := v_booking.price_usd;
    v_refund_status := 'refunded_full';
  
  -- Trader cancellation after confirmation
  ELSIF p_cancelled_by = 'trader' AND v_booking.status = 'confirmed' THEN
    -- Calculate hours since confirmation
    v_hours_since_confirmation := EXTRACT(EPOCH FROM (NOW() - v_booking.updated_at)) / 3600;
    
    -- Calculate hours until departure
    v_hours_until_departure := EXTRACT(EPOCH FROM (v_booking.departure_date - NOW())) / 3600;
    
    -- No refund if within 24 hours of departure
    IF v_hours_until_departure < 24 THEN
      v_refund_pct := 0;
      v_refund_amt := 0;
      v_refund_status := 'not_applicable';
    
    -- 0-24 hours after confirmation = 90% refund
    ELSIF v_hours_since_confirmation <= 24 THEN
      v_refund_pct := 90;
      v_refund_amt := v_booking.price_usd * 0.90;
      v_refund_status := 'refunded_partial';
    
    -- 1-3 days after confirmation = 75% refund
    ELSIF v_hours_since_confirmation <= 72 THEN
      v_refund_pct := 75;
      v_refund_amt := v_booking.price_usd * 0.75;
      v_refund_status := 'refunded_partial';
    
    -- 3+ days after confirmation = 50% refund
    ELSE
      v_refund_pct := 50;
      v_refund_amt := v_booking.price_usd * 0.50;
      v_refund_status := 'refunded_partial';
    END IF;
  END IF;

  RETURN QUERY SELECT 
    ROUND(v_refund_amt, 2),
    v_refund_pct,
    v_refund_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;