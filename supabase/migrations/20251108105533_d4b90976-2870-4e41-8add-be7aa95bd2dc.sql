-- Add unread counters and last message tracking to conversations
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_message_preview TEXT,
ADD COLUMN IF NOT EXISTS unread_trader_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unread_provider_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flag_reason TEXT,
ADD COLUMN IF NOT EXISTS flagged_by_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET 
    updated_at = NOW(),
    last_message_preview = LEFT(NEW.message, 100),
    unread_trader_count = CASE 
      WHEN NEW.sender_id = trader_id THEN unread_trader_count
      ELSE unread_trader_count + 1
    END,
    unread_provider_count = CASE 
      WHEN NEW.sender_id = provider_id THEN unread_provider_count
      ELSE unread_provider_count + 1
    END
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for message updates
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON chat_messages;
CREATE TRIGGER trigger_update_conversation_on_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message();

-- Add RLS policy for admins to view all conversations
CREATE POLICY "Admins can view all conversations"
ON conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add RLS policy for admins to view all messages
CREATE POLICY "Admins can view all messages"
ON chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);