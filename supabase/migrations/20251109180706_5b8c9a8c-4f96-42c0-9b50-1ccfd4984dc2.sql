-- Add currency support to containers table
ALTER TABLE public.containers
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'
CHECK (currency IN ('USD', 'EUR', 'INR', 'GBP', 'AED', 'CAD', 'AUD'));

-- Add comment
COMMENT ON COLUMN public.containers.currency IS 'Currency for pricing (USD, EUR, INR, GBP, AED, CAD, AUD)';