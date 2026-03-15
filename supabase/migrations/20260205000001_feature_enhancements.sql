-- ============================================
-- SHIPCONNECT FEATURE ENHANCEMENTS
-- Phase 1: Database Schema Extensions
-- ============================================

-- ============================================
-- 1. BIDDING & AUCTION SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  starting_price DECIMAL(10,2) NOT NULL,
  reserve_price DECIMAL(10,2), -- Minimum acceptable price
  current_bid DECIMAL(10,2) DEFAULT 0,
  
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  winner_id UUID REFERENCES auth.users(id),
  
  bid_increment DECIMAL(10,2) DEFAULT 10.00,
  total_bids INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'outbid', 'winning', 'won', 'lost')),
  
  auto_bid BOOLEAN DEFAULT false,
  max_auto_bid DECIMAL(10,2)
);

-- ============================================
-- 2. REVIEWS & RATINGS SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  
  -- Detailed ratings
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  reliability_rating INTEGER CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  
  photos TEXT[], -- Array of photo URLs
  
  status TEXT DEFAULT 'published' CHECK (status IN ('pending', 'published', 'flagged', 'removed')),
  
  helpful_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  response_text TEXT NOT NULL
);

-- ============================================
-- 3. DOCUMENT MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  document_type TEXT NOT NULL CHECK (document_type IN (
    'bill_of_lading', 'commercial_invoice', 'packing_list', 
    'customs_declaration', 'certificate_of_origin', 'insurance_certificate',
    'shipping_instruction', 'other'
  )),
  
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER, -- in bytes
  mime_type TEXT,
  
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'verified', 'rejected', 'archived')),
  
  -- AI verification
  ai_verified BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(5,2), -- 0-100
  ai_extracted_data JSONB, -- Parsed data from document
  
  -- E-signature
  requires_signature BOOLEAN DEFAULT false,
  signed_by UUID REFERENCES auth.users(id),
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_url TEXT,
  
  notes TEXT
);

-- ============================================
-- 4. ENHANCED PAYMENT SYSTEM
-- ============================================

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  payment_type TEXT CHECK (payment_type IN ('full', 'partial', 'deposit', 'balance', 'refund')),
  payment_method TEXT CHECK (payment_method IN ('card', 'bank_transfer', 'crypto', 'escrow')),
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  
  -- Escrow details
  escrow_id TEXT,
  escrow_release_date TIMESTAMP WITH TIME ZONE,
  escrow_released BOOLEAN DEFAULT false,
  
  -- Split payment
  split_percentage DECIMAL(5,2), -- If this is a split payment
  parent_transaction_id UUID REFERENCES payment_transactions(id),
  
  transaction_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  method_type TEXT CHECK (method_type IN ('card', 'bank_account', 'crypto_wallet')),
  
  is_default BOOLEAN DEFAULT false,
  
  -- Card details (tokenized)
  stripe_payment_method_id TEXT,
  last_four TEXT,
  card_brand TEXT,
  
  -- Bank details
  bank_name TEXT,
  account_number_last_four TEXT,
  
  -- Crypto
  wallet_address TEXT,
  crypto_type TEXT,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'removed'))
);

-- ============================================
-- 5. TEAM & ORGANIZATION MANAGEMENT
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  organization_type TEXT CHECK (organization_type IN ('provider', 'trader', 'both')),
  
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB,
  
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_documents TEXT[]
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role TEXT CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  
  permissions JSONB, -- {"can_book": true, "can_approve_payments": false, ...}
  
  invited_by UUID REFERENCES auth.users(id),
  invitation_accepted_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),
  
  UNIQUE(organization_id, user_id)
);

-- ============================================
-- 6. ANALYTICS & TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL, -- 'page_view', 'search', 'booking_created', etc.
  event_category TEXT, -- 'user_action', 'system_event', etc.
  
  properties JSONB, -- Additional event data
  
  session_id TEXT,
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  
  price_usd DECIMAL(10,2) NOT NULL,
  
  -- Route details for price analytics
  origin TEXT,
  destination TEXT,
  transport_mode TEXT
);

-- ============================================
-- 7. SOCIAL & COMMUNITY FEATURES
-- ============================================

CREATE TABLE IF NOT EXISTS forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  
  display_order INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  category_id UUID REFERENCES forum_categories(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  
  views INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'flagged', 'removed'))
);

CREATE TABLE IF NOT EXISTS forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  
  status TEXT DEFAULT 'published' CHECK (status IN ('published', 'flagged', 'removed'))
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  referral_code TEXT UNIQUE NOT NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  
  reward_amount DECIMAL(10,2) DEFAULT 0,
  reward_claimed BOOLEAN DEFAULT false,
  reward_claimed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  points INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'booking_completed', 'referral', 'review_submitted', etc.
  
  reference_id UUID, -- e.g., booking_id or referral_id
  reference_type TEXT,
  
  expires_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 8. ADVANCED SEARCH & FAVORITES
-- ============================================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  search_criteria JSONB NOT NULL,
  
  email_alerts BOOLEAN DEFAULT false,
  alert_frequency TEXT CHECK (alert_frequency IN ('instant', 'daily', 'weekly')),
  
  last_run_at TIMESTAMP WITH TIME ZONE,
  results_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
  
  notes TEXT,
  
  UNIQUE(user_id, container_id)
);

-- ============================================
-- 9. WEATHER & ROUTE DATA
-- ============================================

CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  location TEXT NOT NULL, -- Port name or coordinates
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  
  forecast_date DATE NOT NULL,
  
  temperature_celsius DECIMAL(5,2),
  weather_condition TEXT,
  wind_speed_kmh DECIMAL(5,2),
  precipitation_mm DECIMAL(5,2),
  
  storm_warning BOOLEAN DEFAULT false,
  delay_risk TEXT CHECK (delay_risk IN ('low', 'medium', 'high', 'severe')),
  
  raw_data JSONB,
  
  UNIQUE(location, forecast_date)
);

CREATE TABLE IF NOT EXISTS route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  transport_mode TEXT NOT NULL,
  
  optimal_route JSONB, -- Array of waypoints
  alternative_routes JSONB,
  
  estimated_duration_hours INTEGER,
  estimated_cost_usd DECIMAL(10,2),
  carbon_footprint_kg DECIMAL(10,2),
  
  weather_impact TEXT,
  delay_probability DECIMAL(5,2), -- 0-100
  
  valid_until TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_bids_auction ON bids(auction_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_documents_booking ON documents(booking_id);
CREATE INDEX idx_payment_transactions_booking ON payment_transactions(booking_id);
CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_forum_posts_category ON forum_posts(category_id);
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_weather_cache_location_date ON weather_cache(location, forecast_date);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Auctions: Anyone can view active auctions
CREATE POLICY "Anyone can view active auctions" ON auctions FOR SELECT USING (status = 'active');
CREATE POLICY "Providers can manage their auctions" ON auctions FOR ALL USING (auth.uid() = provider_id);

-- Bids: Users can view their own bids
CREATE POLICY "Users can view their own bids" ON bids FOR SELECT USING (auth.uid() = bidder_id);
CREATE POLICY "Users can create bids" ON bids FOR INSERT WITH CHECK (auth.uid() = bidder_id);

-- Reviews: Anyone can read published reviews
CREATE POLICY "Anyone can read published reviews" ON reviews FOR SELECT USING (status = 'published');
CREATE POLICY "Users can write reviews for their bookings" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update their own reviews" ON reviews FOR UPDATE USING (auth.uid() = reviewer_id);

-- Documents: Users can access documents for their bookings
CREATE POLICY "Users can view their booking documents" ON documents FOR SELECT USING (
  auth.uid() = uploader_id OR 
  EXISTS (SELECT 1 FROM bookings WHERE bookings.id = documents.booking_id AND (bookings.trader_id = auth.uid() OR bookings.provider_id = auth.uid()))
);

-- Organizations: Members can view their organization
CREATE POLICY "Members can view their organization" ON organizations FOR SELECT USING (
  auth.uid() = owner_id OR 
  EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = organizations.id AND organization_members.user_id = auth.uid())
);

-- Forum: Anyone can read published posts
CREATE POLICY "Anyone can read published posts" ON forum_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Users can create posts" ON forum_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can update their posts" ON forum_posts FOR UPDATE USING (auth.uid() = author_id);

-- Saved Searches: Users can only access their own
CREATE POLICY "Users can manage their saved searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- Favorites: Users can only access their own
CREATE POLICY "Users can manage their favorites" ON favorites FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update auction current_bid when new bid is placed
CREATE OR REPLACE FUNCTION update_auction_current_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auctions 
  SET current_bid = NEW.amount,
      total_bids = total_bids + 1,
      updated_at = NOW()
  WHERE id = NEW.auction_id;
  
  -- Update previous bids status to 'outbid'
  UPDATE bids 
  SET status = 'outbid' 
  WHERE auction_id = NEW.auction_id 
    AND id != NEW.id 
    AND status = 'winning';
  
  -- Set new bid as winning
  NEW.status = 'winning';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_auction_current_bid
  BEFORE INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION update_auction_current_bid();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
