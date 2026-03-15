-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "System can insert payments" ON payments;
DROP POLICY IF EXISTS "System can update payments" ON payments;

-- Allow edge functions (with service role) to insert payments
CREATE POLICY "Edge functions can insert payments"
ON payments
FOR INSERT
WITH CHECK (true);

-- Allow edge functions to update payment status
CREATE POLICY "Edge functions can update payments"
ON payments
FOR UPDATE
USING (true);

-- Keep existing SELECT policy for users to view their own payments
-- (This policy already exists and is correct)

-- Add policy for traders to view payments for their bookings
CREATE POLICY "Traders can view payments for their bookings"
ON payments
FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT id FROM bookings WHERE trader_id = auth.uid()
  )
);

-- Add policy for providers to view payments for their bookings
CREATE POLICY "Providers can view payments for their bookings"
ON payments
FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);