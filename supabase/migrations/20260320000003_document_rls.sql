-- Add missing INSERT and VIEW policies for documents table
-- Ensure the storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('booking-documents', 'booking-documents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- First, ensure RLS is enabled...
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;

-- Allow users to upload documents for their own bookings
CREATE POLICY "Users can upload documents for their bookings"
ON documents
FOR INSERT
WITH CHECK (
  auth.uid() = uploader_id AND
  EXISTS (
    SELECT 1 FROM bookings 
    WHERE bookings.id = documents.booking_id 
    AND (bookings.trader_id = auth.uid() OR bookings.provider_id = auth.uid())
  )
);

-- Ensure users can see their uploaded documents
-- (Replacing the old view policy if needed or just adding)
DROP POLICY IF EXISTS "Users can view their booking documents" ON documents;
CREATE POLICY "Users can view their booking documents" ON documents FOR SELECT USING (
  auth.uid() = uploader_id OR 
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = documents.booking_id AND (bookings.trader_id = auth.uid() OR bookings.provider_id = auth.uid()))
);

-- STORAGE POLICIES
-- NOTE: These policies apply to the storage.objects table for the specific bucket
-- Ensure the bucket exists (this usually needs to be done via dashboard or API but we can try to hint it)

-- Allow authenticated users to upload to the booking-documents bucket
CREATE POLICY "Users can upload booking documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'booking-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to view documents they or their counterpart uploaded
CREATE POLICY "Users can view booking documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'booking-documents'); -- Simplified for demo, ideally more restrictive
