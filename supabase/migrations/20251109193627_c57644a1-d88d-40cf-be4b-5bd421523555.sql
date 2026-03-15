-- Add payment details fields to profiles table for traders
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_account_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_ifsc_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS swift_code text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS upi_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS paypal_email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_preference text DEFAULT 'USD';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_notes text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS payment_verified boolean DEFAULT false;