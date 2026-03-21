-- ============================================
-- PROXY BIDDING SYSTEM ENHANCEMENTS
-- ============================================

-- Function to handle proxy bidding
CREATE OR REPLACE FUNCTION process_proxy_bids()
RETURNS TRIGGER AS $$
DECLARE
  highest_proxy_bid RECORD;
  increment DECIMAL(10,2);
  new_proxy_amount DECIMAL(10,2);
BEGIN
  -- 1. Get auction increment
  SELECT bid_increment INTO increment 
  FROM auctions 
  WHERE id = NEW.auction_id;

  -- 2. Check if anyone has a proxy bid that could outbid this new bid
  -- Exclude the current bidder to avoid bidding against self
  SELECT * INTO highest_proxy_bid
  FROM bids
  WHERE auction_id = NEW.auction_id
    AND bidder_id != NEW.bidder_id
    AND auto_bid = true
    AND max_auto_bid >= (NEW.amount + increment)
  ORDER BY max_auto_bid DESC, created_at ASC
  LIMIT 1;

  -- 3. If a higher proxy exists, outbid the NEW bid automatically
  IF highest_proxy_bid IS NOT NULL THEN
    new_proxy_amount := NEW.amount + increment;
    
    -- Ensure we don't exceed their max
    IF new_proxy_amount <= highest_proxy_bid.max_auto_bid THEN
      -- Create the automatic outbid
      -- Note: This is an AFTER INSERT trigger, so this will trigger another insert
      -- which will trigger another after insert, but our check 
      -- highest_proxy_bid.bidder_id != NEW.bidder_id prevents infinite loop
      INSERT INTO bids (
        auction_id, 
        bidder_id, 
        amount, 
        auto_bid, 
        max_auto_bid, 
        status
      ) VALUES (
        NEW.auction_id,
        highest_proxy_bid.bidder_id,
        new_proxy_amount,
        true,
        highest_proxy_bid.max_auto_bid,
        'active'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set up the trigger
CREATE TRIGGER trigger_proxy_bids
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION process_proxy_bids();

-- Add indexes for proxy bidding performance
CREATE INDEX IF NOT EXISTS idx_bids_proxy_check ON bids(auction_id, auto_bid, max_auto_bid, bidder_id);
