
-- Migration: 20251021130047
-- Create user role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'provider', 'trader');

-- Create transport mode enum
CREATE TYPE public.transport_mode AS ENUM ('sea', 'air', 'rail', 'road');

-- Create container type enum
CREATE TYPE public.container_type AS ENUM ('standard_20', 'standard_40', 'high_cube_40', 'refrigerated_20', 'refrigerated_40', 'open_top', 'flat_rack');

-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create providers table
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  transport_mode transport_mode NOT NULL,
  company_registration TEXT,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_bookings INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create containers table
CREATE TABLE public.containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  container_type container_type NOT NULL,
  transport_mode transport_mode NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  capacity_kg DECIMAL(10,2) NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  available_from DATE NOT NULL,
  available_until DATE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT NOT NULL UNIQUE,
  trader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  container_id UUID NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  cargo_description TEXT NOT NULL,
  cargo_weight_kg DECIMAL(10,2) NOT NULL,
  status booking_status DEFAULT 'confirmed',
  price_usd DECIMAL(10,2) NOT NULL,
  booking_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  pickup_date DATE,
  delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for providers
CREATE POLICY "Providers can view own data"
  ON public.providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view verified providers"
  ON public.providers FOR SELECT
  USING (verified = true);

CREATE POLICY "Providers can update own data"
  ON public.providers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Providers can insert own data"
  ON public.providers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all providers"
  ON public.providers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for containers
CREATE POLICY "Anyone authenticated can view containers"
  ON public.containers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Providers can insert own containers"
  ON public.containers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = provider_id
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Providers can update own containers"
  ON public.containers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = provider_id
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Providers can delete own containers"
  ON public.containers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = provider_id
      AND providers.user_id = auth.uid()
    )
  );

-- RLS Policies for bookings
CREATE POLICY "Traders can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = trader_id);

CREATE POLICY "Providers can view their bookings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = provider_id
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Traders can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = trader_id AND public.has_role(auth.uid(), 'trader'));

CREATE POLICY "Traders can update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = trader_id);

CREATE POLICY "Providers can update their bookings"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers
      WHERE providers.id = provider_id
      AND providers.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- Create function to generate booking numbers
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_containers_updated_at
  BEFORE UPDATE ON public.containers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Insert user role from metadata
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data->>'role')::app_role);
    
    -- If provider, create provider record
    IF NEW.raw_user_meta_data->>'role' = 'provider' THEN
      INSERT INTO public.providers (user_id, transport_mode)
      VALUES (NEW.id, 'sea');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert admin user role (will be created on first signup with admin@gmail.com)
-- The admin user will need to be created manually through signup;

-- Migration: 20251021130108
-- Fix search_path for generate_booking_number function
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

-- Migration: 20251022053310
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- Currency enum
CREATE TYPE currency_type AS ENUM ('USD', 'EUR', 'GBP', 'INR');

-- Refund status enum
CREATE TYPE refund_status AS ENUM ('requested', 'approved', 'rejected', 'completed');

-- Transaction type enum
CREATE TYPE transaction_type AS ENUM ('payment', 'refund', 'payout', 'commission');

-- Shipment milestone enum
CREATE TYPE milestone_type AS ENUM (
  'booking_confirmed',
  'container_assigned',
  'cargo_loaded',
  'in_transit',
  'at_destination_port',
  'customs_clearance',
  'out_for_delivery',
  'delivered'
);

-- Milestone status enum
CREATE TYPE milestone_status AS ENUM ('pending', 'completed', 'delayed');

-- Notification type enum
CREATE TYPE notification_type AS ENUM ('booking', 'payment', 'chat', 'milestone', 'container', 'system');

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  pdf_path TEXT,
  subtotal NUMERIC NOT NULL,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  issued_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_date TIMESTAMP WITH TIME ZONE,
  emailed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  stripe_refund_id TEXT,
  amount NUMERIC NOT NULL,
  reason TEXT,
  status refund_status NOT NULL DEFAULT 'requested',
  requested_by UUID NOT NULL,
  approved_by UUID,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type transaction_type NOT NULL,
  amount NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  description TEXT,
  reference_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create provider_payouts table
CREATE TABLE IF NOT EXISTS public.provider_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  amount NUMERIC NOT NULL,
  currency currency_type NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_date TIMESTAMP WITH TIME ZONE,
  processed_date TIMESTAMP WITH TIME ZONE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipment_milestones table
CREATE TABLE IF NOT EXISTS public.shipment_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  milestone milestone_type NOT NULL,
  status milestone_status NOT NULL DEFAULT 'pending',
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completed_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  gps_latitude NUMERIC,
  gps_longitude NUMERIC,
  notes TEXT,
  images TEXT[],
  signature_data TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_type TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON public.invoices(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

CREATE INDEX IF NOT EXISTS idx_provider_payouts_provider_id ON public.provider_payouts(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_payouts_status ON public.provider_payouts(status);

CREATE INDEX IF NOT EXISTS idx_shipment_milestones_booking_id ON public.shipment_milestones(booking_id);
CREATE INDEX IF NOT EXISTS idx_shipment_milestones_milestone ON public.shipment_milestones(milestone);
CREATE INDEX IF NOT EXISTS idx_shipment_milestones_status ON public.shipment_milestones(status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_booking_id ON public.chat_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON public.chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their bookings" ON public.payments
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings 
      WHERE trader_id = auth.uid() 
      OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "System can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update payments" ON public.payments
  FOR UPDATE USING (true);

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices for their bookings" ON public.invoices
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings 
      WHERE trader_id = auth.uid() 
      OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for refunds
CREATE POLICY "Users can view refunds for their payments" ON public.refunds
  FOR SELECT USING (
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      WHERE b.trader_id = auth.uid() 
      OR b.provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Traders can request refunds" ON public.refunds
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by AND
    payment_id IN (
      SELECT p.id FROM public.payments p
      JOIN public.bookings b ON p.booking_id = b.id
      WHERE b.trader_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update refunds" ON public.refunds
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for provider_payouts
CREATE POLICY "Providers can view own payouts" ON public.provider_payouts
  FOR SELECT USING (
    provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all payouts" ON public.provider_payouts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage payouts" ON public.provider_payouts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for shipment_milestones
CREATE POLICY "Users can view milestones for their bookings" ON public.shipment_milestones
  FOR SELECT USING (
    booking_id IN (
      SELECT id FROM public.bookings 
      WHERE trader_id = auth.uid() 
      OR provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Providers can update milestones for their bookings" ON public.shipment_milestones
  FOR ALL USING (
    booking_id IN (
      SELECT id FROM public.bookings 
      WHERE provider_id IN (SELECT id FROM public.providers WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages for their bookings" ON public.chat_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

CREATE POLICY "Users can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update own messages" ON public.chat_messages
  FOR UPDATE USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for email_logs
CREATE POLICY "Admins can view email logs" ON public.email_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_payouts_updated_at
  BEFORE UPDATE ON public.provider_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipment_milestones_updated_at
  BEFORE UPDATE ON public.shipment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
BEGIN
  new_number := 'INV-' || TO_CHAR(NOW(), 'YYYY-MM') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN new_number;
END;
$$;

-- Enable realtime for chat and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipment_milestones;

-- Migration: 20251022053330
-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('container-images', 'container-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('milestone-images', 'milestone-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']),
  ('chat-attachments', 'chat-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']),
  ('documents', 'documents', false, 10485760, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for container-images bucket
CREATE POLICY "Anyone can view container images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'container-images');

CREATE POLICY "Providers can upload container images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'container-images' AND
    auth.uid() IN (SELECT user_id FROM public.providers)
  );

CREATE POLICY "Providers can update own container images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'container-images' AND
    auth.uid() IN (SELECT user_id FROM public.providers)
  );

CREATE POLICY "Providers can delete own container images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'container-images' AND
    auth.uid() IN (SELECT user_id FROM public.providers)
  );

-- RLS policies for milestone-images bucket
CREATE POLICY "Anyone can view milestone images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'milestone-images');

CREATE POLICY "Providers can upload milestone images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'milestone-images' AND
    auth.uid() IN (SELECT user_id FROM public.providers)
  );

-- RLS policies for chat-attachments bucket
CREATE POLICY "Users can view chat attachments for their bookings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-attachments' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments' AND
    auth.uid() IS NOT NULL
  );

-- RLS policies for documents bucket
CREATE POLICY "Users can view documents for their bookings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents' AND
    auth.uid() IS NOT NULL
  );
