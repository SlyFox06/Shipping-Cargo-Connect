-- Fix search_path for the conversation timestamp function
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_timestamp();