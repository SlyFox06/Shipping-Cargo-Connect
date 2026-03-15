-- Add email notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_booking_updates boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_container_updates boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_message_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_refund_updates boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_security_alerts boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS email_marketing boolean DEFAULT false;

-- Ensure booking status is just 'cancelled' with cancelled_by tracking who did it
-- The trigger already handles 'cancelled%' pattern so it will work