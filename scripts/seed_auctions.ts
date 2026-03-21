import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function seedAuctions() {
  console.log("Seeding sample auctions...");

  // 1. Get some containers
  const { data: containers } = await supabase.from('containers').select('id, origin, destination').limit(2);
  
  if (!containers || containers.length === 0) {
    console.error("No containers found. Please run set_provider_data.ts first.");
    return;
  }

  // 2. Get a provider user id (using the one we know)
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', 'naik90816@gmail.com').single();
  
  if (!profile) {
    console.error("Provider profile not found.");
    return;
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sampleAuctions = [
    {
      provider_id: profile.id,
      container_id: containers[0].id,
      title: `Last Minute: ${containers[0].origin} to ${containers[0].destination}`,
      description: "Remaining 15% space in high-cube container. Perfect for small electronics or retail goods.",
      starting_price: 350.00,
      current_bid: 400.00,
      bid_increment: 25.00,
      start_time: now.toISOString(),
      end_time: tomorrow.toISOString(),
      status: 'active',
      total_bids: 3
    },
    {
      provider_id: profile.id,
      container_id: containers[1]?.id || containers[0].id,
      title: `Flash Deal: Mumbai Express`,
      description: "Full container relocation auction. Starting low!",
      starting_price: 1200.00,
      current_bid: 1250.00,
      bid_increment: 50.00,
      start_time: now.toISOString(),
      end_time: tomorrow.toISOString(),
      status: 'active',
      total_bids: 1
    }
  ];

  const { error } = await supabase.from('auctions').insert(sampleAuctions);

  if (error) {
    console.error("Error seeding auctions:", error.message);
  } else {
    console.log("Successfully seeded 2 auctions!");
  }
}

seedAuctions();
