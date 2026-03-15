-- Fix Issue 1: Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- Ensure profiles table has proper policies for user management
-- Add policy for admins to update any profile (for suspend functionality)
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- Ensure containers are visible to all authenticated users (already exists but verifying)
-- This helps with Issue 3: Trader search containers

-- Add index for better performance on provider lookups (helps Issue 2)
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON public.providers(user_id);
CREATE INDEX IF NOT EXISTS idx_containers_provider_id ON public.containers(provider_id);
CREATE INDEX IF NOT EXISTS idx_containers_status ON public.containers(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);