-- Create chatbot_logs table for AI assistant analytics
CREATE TABLE IF NOT EXISTS public.chatbot_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  query TEXT NOT NULL,
  response_started TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own chatbot logs
CREATE POLICY "Users can view own chatbot logs"
ON public.chatbot_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert chatbot logs
CREATE POLICY "System can insert chatbot logs"
ON public.chatbot_logs
FOR INSERT
WITH CHECK (true);

-- Admins can view all chatbot logs
CREATE POLICY "Admins can view all chatbot logs"
ON public.chatbot_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_user_id ON public.chatbot_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_created_at ON public.chatbot_logs(created_at DESC);

-- Add distance_km field to bookings for dynamic pricing
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS distance_km NUMERIC DEFAULT 0;

-- Create notification for new chat messages (update existing notifications table)
-- Add index on chat_messages for better real-time performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_at ON public.chat_messages(read_at) WHERE read_at IS NULL;