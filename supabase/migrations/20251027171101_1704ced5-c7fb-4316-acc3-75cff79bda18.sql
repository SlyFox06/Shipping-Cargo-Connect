-- Add suspended field to profiles table for user management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false NOT NULL;

-- Create index for better performance when filtering suspended users
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON public.profiles(suspended);