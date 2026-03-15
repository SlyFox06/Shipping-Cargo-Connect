-- Add cargo categorization and safety features to bookings
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS cargo_category TEXT,
ADD COLUMN IF NOT EXISTS safety_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS weight_distribution JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_split_booking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS parent_booking_id UUID REFERENCES bookings(id),
ADD COLUMN IF NOT EXISTS split_cargo_details JSONB DEFAULT '[]';

-- Create container performance tracking table
CREATE TABLE IF NOT EXISTS container_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  route_key TEXT NOT NULL,
  total_bookings INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  total_delay_days INTEGER DEFAULT 0,
  average_delay_days NUMERIC DEFAULT 0,
  utilization_average NUMERIC DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(container_id, route_key)
);

-- Create delay predictions table
CREATE TABLE IF NOT EXISTS delay_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  risk_score TEXT NOT NULL CHECK (risk_score IN ('low', 'medium', 'high')),
  predicted_delay_days INTEGER DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0,
  factors JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add performance fields to containers
ALTER TABLE containers
ADD COLUMN IF NOT EXISTS hazmat_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS fragile_handling BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS insurance_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS performance_score NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE container_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE delay_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for container_performance
CREATE POLICY "Anyone can view performance data"
ON container_performance FOR SELECT
USING (true);

CREATE POLICY "System can manage performance data"
ON container_performance FOR ALL
USING (true);

-- RLS Policies for delay_predictions
CREATE POLICY "Users can view predictions for their bookings"
ON delay_predictions FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE trader_id = auth.uid() 
    OR provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
  )
);

CREATE POLICY "System can manage predictions"
ON delay_predictions FOR ALL
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_container_performance_route ON container_performance(route_key);
CREATE INDEX IF NOT EXISTS idx_container_performance_container ON container_performance(container_id);
CREATE INDEX IF NOT EXISTS idx_delay_predictions_container ON delay_predictions(container_id);
CREATE INDEX IF NOT EXISTS idx_bookings_cargo_category ON bookings(cargo_category);

-- Create function to update performance metrics
CREATE OR REPLACE FUNCTION update_container_performance()
RETURNS TRIGGER AS $$
DECLARE
  route_key TEXT;
  perf_record RECORD;
BEGIN
  -- Create route key
  route_key := (SELECT origin || '_to_' || destination FROM containers WHERE id = NEW.container_id);
  
  -- Get or create performance record
  SELECT * INTO perf_record FROM container_performance 
  WHERE container_id = NEW.container_id AND route_key = route_key;
  
  IF perf_record IS NULL THEN
    INSERT INTO container_performance (container_id, route_key, total_bookings, on_time_deliveries)
    VALUES (NEW.container_id, route_key, 1, 0);
  ELSE
    -- Update on booking completion
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
      UPDATE container_performance
      SET 
        total_bookings = total_bookings + 1,
        on_time_deliveries = CASE 
          WHEN NEW.delivery_date <= NEW.final_delivery_date THEN on_time_deliveries + 1
          ELSE on_time_deliveries
        END,
        total_delay_days = total_delay_days + GREATEST(0, EXTRACT(DAY FROM (NEW.delivery_date - NEW.final_delivery_date))::INTEGER),
        average_delay_days = (total_delay_days + GREATEST(0, EXTRACT(DAY FROM (NEW.delivery_date - NEW.final_delivery_date)))) / NULLIF(total_bookings + 1, 0),
        utilization_average = (utilization_average * total_bookings + COALESCE(NEW.space_utilization_percent, 0)) / NULLIF(total_bookings + 1, 0),
        last_updated = NOW()
      WHERE container_id = NEW.container_id AND route_key = route_key;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for performance tracking
DROP TRIGGER IF EXISTS track_container_performance ON bookings;
CREATE TRIGGER track_container_performance
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION update_container_performance();