-- Fix search path for calculate_container_price function
DROP FUNCTION IF EXISTS calculate_container_price(numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION calculate_container_price(
  p_length_ft numeric,
  p_width_ft numeric,
  p_base_rate_per_sqft numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ROUND((p_length_ft * p_width_ft * p_base_rate_per_sqft)::numeric, 2);
END;
$$;

COMMENT ON FUNCTION calculate_container_price IS 'Calculate total container price based on floor area (length × width) and base rate per square foot';