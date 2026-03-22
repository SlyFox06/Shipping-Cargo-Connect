import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedContainers() {
  console.log("Fetching profiles to act as providers...");
  const { data: profiles, error: profileErr } = await supabase.from('profiles').select('id, role').limit(10);
  
  if (profileErr) {
    console.error("Failed fetching profiles", profileErr);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.log("No profiles found to assign containers to. Please sign up users first.");
    return;
  }
  
  // We need 2 distinct provider accounts
  let providers = profiles.filter(p => p.role === 'provider');
  if (providers.length < 2) {
    console.log(`Only found ${providers.length} providers. Using other profiles as well for demo purposes.`);
    providers = [...providers, ...profiles.filter(p => p.role !== 'provider')];
  }
  
  if (providers.length < 2) {
    console.log("Still need at least 2 profiles total. Please create another account first.");
    return;
  }
  
  const provider1 = providers[0].id;
  const provider2 = providers[1].id;
  
  console.log(`Using provider 1: ${provider1}`);
  console.log(`Using provider 2: ${provider2}`);
  
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const inTwoWeeks = new Date(now);
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);

  const demoContainers = [
    {
      provider_id: provider1,
      origin: 'Mumbai (INNSA)',
      destination: 'Rotterdam (NLRTM)',
      departure_date: nextWeek.toISOString(),
      arrival_date: inTwoWeeks.toISOString(),
      total_volume_m3: 33, // standard 20ft
      available_volume_m3: 15,
      price_per_m3: 125,
      container_type: '20ft Standard',
      refrigerated: false,
      status: 'active'
    },
    {
      provider_id: provider1,
      origin: 'Shanghai (CNSHA)',
      destination: 'Dubai (AEDXB)',
      departure_date: nextWeek.toISOString(),
      arrival_date: inTwoWeeks.toISOString(),
      total_volume_m3: 67, // standard 40ft
      available_volume_m3: 40,
      price_per_m3: 85,
      container_type: '40ft High Cube',
      refrigerated: true,
      status: 'active'
    },
    {
      provider_id: provider2,
      origin: 'Singapore (SGSIN)',
      destination: 'Rotterdam (NLRTM)',
      departure_date: inTwoWeeks.toISOString(),
      arrival_date: new Date(inTwoWeeks.getTime() + 10 * 86400000).toISOString(),
      total_volume_m3: 67,
      available_volume_m3: 67,
      price_per_m3: 98,
      container_type: '40ft Standard',
      refrigerated: false,
      status: 'active'
    },
    {
      provider_id: provider2,
      origin: 'New York (USNYC)',
      destination: 'Hong Kong (HKHKG)',
      departure_date: nextWeek.toISOString(),
      arrival_date: inTwoWeeks.toISOString(),
      total_volume_m3: 67,
      available_volume_m3: 30,
      price_per_m3: 115,
      container_type: '40ft Standard',
      refrigerated: false,
      status: 'active'
    }
  ];

  const { error } = await supabase.from('containers').insert(demoContainers);
  
  if (error) {
    console.error("Error inserting containers:", error);
  } else {
    console.log("Successfully inserted 4 demo containers across 2 providers!");
  }
}

seedContainers();
