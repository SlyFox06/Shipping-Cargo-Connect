-- Fix database relationships for proper cascading and joins

-- Ensure bookings can join with profiles properly (trader_id foreign key)
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_trader_id_fkey;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_trader_id_fkey 
FOREIGN KEY (trader_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Ensure containers can be safely deleted (cascade to bookings)
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_container_id_fkey;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_container_id_fkey 
FOREIGN KEY (container_id) 
REFERENCES public.containers(id) 
ON DELETE CASCADE;

-- Ensure providers link properly
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_provider_id_fkey;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_provider_id_fkey 
FOREIGN KEY (provider_id) 
REFERENCES public.providers(id) 
ON DELETE CASCADE;