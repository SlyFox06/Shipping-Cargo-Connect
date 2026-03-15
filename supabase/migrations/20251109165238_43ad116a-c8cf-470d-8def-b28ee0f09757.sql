-- Create booking_documents table
CREATE TABLE IF NOT EXISTS booking_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  uploaded_role TEXT NOT NULL CHECK (uploaded_role IN ('trader', 'provider', 'admin')),
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_booking_documents_booking_id ON booking_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_uploaded_by ON booking_documents(uploaded_by);

-- Enable RLS
ALTER TABLE booking_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for booking_documents
CREATE POLICY "Users can view documents for their bookings"
ON booking_documents
FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT id FROM bookings 
    WHERE trader_id = auth.uid() 
    OR provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Traders can upload documents for their bookings"
ON booking_documents
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() 
  AND booking_id IN (
    SELECT id FROM bookings WHERE trader_id = auth.uid()
  )
);

CREATE POLICY "Providers can upload documents for their bookings"
ON booking_documents
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() 
  AND booking_id IN (
    SELECT id FROM bookings 
    WHERE provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all documents"
ON booking_documents
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can delete their own documents"
ON booking_documents
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- Create storage bucket for booking documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-documents',
  'booking-documents',
  false,
  20971520, -- 20MB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for booking-documents bucket (with unique names)
CREATE POLICY "Booking documents: upload access"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'booking-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM bookings 
    WHERE trader_id = auth.uid() 
    OR provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Booking documents: view access"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'booking-documents' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM bookings 
    WHERE trader_id = auth.uid() 
    OR provider_id IN (
      SELECT id FROM providers WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Booking documents: delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'booking-documents' 
  AND owner = auth.uid()
);

-- Trigger for updated_at
CREATE TRIGGER update_booking_documents_updated_at
BEFORE UPDATE ON booking_documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();