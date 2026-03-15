-- Add index for better chat performance if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_chat_messages_booking_created'
  ) THEN
    CREATE INDEX idx_chat_messages_booking_created 
    ON public.chat_messages(booking_id, created_at DESC);
  END IF;
END $$;