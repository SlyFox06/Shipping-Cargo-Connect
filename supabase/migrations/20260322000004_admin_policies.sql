-- Migration: 20260322000004_admin_policies
-- Add missing RLS policies for admins to manage profiles and providers

-- 1. Profiles: Allow admins to manage all user profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Providers: Allow admins to manage all provider listings
DROP POLICY IF EXISTS "Admins can manage all providers" ON public.providers;
CREATE POLICY "Admins can manage all providers"
  ON public.providers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Containers: Ensure admins can manage all containers
DROP POLICY IF EXISTS "Admins can manage all containers" ON public.containers;
CREATE POLICY "Admins can manage all containers"
  ON public.containers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Bookings: Ensure admins can manage all bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
