-- Handle cascading for container deletion
-- Update conversations to mark container as deleted instead of cascade delete
ALTER TABLE public.conversations 
DROP CONSTRAINT IF EXISTS conversations_container_id_fkey;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_container_id_fkey
FOREIGN KEY (container_id)
REFERENCES public.containers(id)
ON DELETE SET NULL;

-- Update bookings to prevent deletion if active bookings exist
-- This is handled in application logic, but we add a comment for clarity
COMMENT ON TABLE public.bookings IS 'Container deletion blocked if active bookings exist (status: confirmed, in_transit, delivered)';

-- Add index for faster cascade checks
CREATE INDEX IF NOT EXISTS idx_bookings_container_status 
ON public.bookings(container_id, status);

CREATE INDEX IF NOT EXISTS idx_conversations_container 
ON public.conversations(container_id);