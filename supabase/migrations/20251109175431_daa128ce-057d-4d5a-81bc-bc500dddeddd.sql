-- Add payment details fields to providers table
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS upi_id TEXT,
ADD COLUMN IF NOT EXISTS swift_code TEXT,
ADD COLUMN IF NOT EXISTS paypal_email TEXT,
ADD COLUMN IF NOT EXISTS currency_preference TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS payment_notes TEXT,
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN providers.bank_account_name IS 'Provider bank account holder name for payouts';
COMMENT ON COLUMN providers.bank_account_number IS 'Provider bank account number';
COMMENT ON COLUMN providers.bank_ifsc_code IS 'Bank IFSC code for Indian banks';
COMMENT ON COLUMN providers.bank_name IS 'Name of the bank';
COMMENT ON COLUMN providers.upi_id IS 'UPI ID for Indian instant payments';
COMMENT ON COLUMN providers.swift_code IS 'SWIFT/BIC code for international transfers';
COMMENT ON COLUMN providers.paypal_email IS 'PayPal email for international payouts';
COMMENT ON COLUMN providers.currency_preference IS 'Preferred currency for payouts';
COMMENT ON COLUMN providers.payment_notes IS 'Additional payment related notes';
COMMENT ON COLUMN providers.payment_verified IS 'Whether payment details have been verified by admin';