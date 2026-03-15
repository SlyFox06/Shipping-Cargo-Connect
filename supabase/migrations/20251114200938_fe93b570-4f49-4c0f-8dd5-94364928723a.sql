-- Add weather prediction fields to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS weather_risk text CHECK (weather_risk IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS predicted_delay_hours integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS route_risk_score numeric DEFAULT 0;

-- Create weather predictions table for historical tracking
CREATE TABLE IF NOT EXISTS weather_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  container_id uuid REFERENCES containers(id) ON DELETE CASCADE,
  route_key text NOT NULL,
  prediction_date timestamptz DEFAULT now(),
  
  -- Weather factors
  wind_speed_kmh numeric,
  wave_height_m numeric,
  storm_probability numeric,
  visibility_km numeric,
  rainfall_mm numeric,
  temperature_c numeric,
  
  -- Risk scores
  wind_factor numeric,
  wave_factor numeric,
  storm_factor numeric,
  visibility_factor numeric,
  rainfall_factor numeric,
  historical_delay_factor numeric,
  
  -- Final prediction
  overall_risk_score numeric,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high')),
  predicted_delay_hours integer,
  
  -- Route checkpoints
  route_checkpoints jsonb DEFAULT '[]'::jsonb,
  
  -- Metadata
  weather_alerts jsonb DEFAULT '[]'::jsonb,
  safe_sailing_window jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_weather_predictions_booking ON weather_predictions(booking_id);
CREATE INDEX IF NOT EXISTS idx_weather_predictions_container ON weather_predictions(container_id);
CREATE INDEX IF NOT EXISTS idx_weather_predictions_route ON weather_predictions(route_key);
CREATE INDEX IF NOT EXISTS idx_weather_predictions_date ON weather_predictions(prediction_date);

-- Enable RLS
ALTER TABLE weather_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view weather predictions for their bookings"
ON weather_predictions FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE trader_id = auth.uid() 
    OR provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "System can manage weather predictions"
ON weather_predictions FOR ALL
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_weather_predictions_updated_at
BEFORE UPDATE ON weather_predictions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();