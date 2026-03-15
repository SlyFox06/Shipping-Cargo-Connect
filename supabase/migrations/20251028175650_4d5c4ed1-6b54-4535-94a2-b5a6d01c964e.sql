-- Add dimension and pricing fields to containers
ALTER TABLE public.containers
ADD COLUMN IF NOT EXISTS length_ft numeric,
ADD COLUMN IF NOT EXISTS width_ft numeric,
ADD COLUMN IF NOT EXISTS height_ft numeric,
ADD COLUMN IF NOT EXISTS base_rate_per_sqft numeric DEFAULT 10.00;

-- Add country fields for origin and destination
ALTER TABLE public.containers
ADD COLUMN IF NOT EXISTS origin_country text,
ADD COLUMN IF NOT EXISTS origin_city text,
ADD COLUMN IF NOT EXISTS destination_country text,
ADD COLUMN IF NOT EXISTS destination_city text;

-- Migrate existing origin/destination data to city fields
UPDATE public.containers
SET origin_city = origin,
    destination_city = destination
WHERE origin_city IS NULL AND destination_city IS NULL;

-- Add default dimensions for existing containers (20ft standard container)
UPDATE public.containers
SET length_ft = 20,
    width_ft = 8,
    height_ft = 8.5,
    base_rate_per_sqft = 10.00
WHERE length_ft IS NULL;

-- Create function to calculate container price based on dimensions
CREATE OR REPLACE FUNCTION calculate_container_price(
  p_length_ft numeric,
  p_width_ft numeric,
  p_base_rate_per_sqft numeric
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ROUND((p_length_ft * p_width_ft * p_base_rate_per_sqft)::numeric, 2);
END;
$$;

COMMENT ON FUNCTION calculate_container_price IS 'Calculate total container price based on floor area (length × width) and base rate per square foot';