-- Create saved analytics charts table
CREATE TABLE IF NOT EXISTS public.saved_analytics_charts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('trader', 'provider')),
  chart_type TEXT NOT NULL,
  chart_name TEXT NOT NULL,
  chart_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_analytics_charts ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved charts
CREATE POLICY "Users can view own saved charts"
ON public.saved_analytics_charts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own saved charts
CREATE POLICY "Users can insert own saved charts"
ON public.saved_analytics_charts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved charts
CREATE POLICY "Users can delete own saved charts"
ON public.saved_analytics_charts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all saved charts
CREATE POLICY "Admins can view all saved charts"
ON public.saved_analytics_charts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_saved_charts_user_id ON public.saved_analytics_charts(user_id);
CREATE INDEX idx_saved_charts_user_role ON public.saved_analytics_charts(user_role);

-- Add trigger for updated_at
CREATE TRIGGER update_saved_charts_updated_at
BEFORE UPDATE ON public.saved_analytics_charts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_analytics_charts;