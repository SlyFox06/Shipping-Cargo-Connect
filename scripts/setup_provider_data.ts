import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupProvider() {
  const targetEmail = "naik90816@gmail.com";
  console.log(`Setting up sample containers for provider: ${targetEmail}`);

  // 1. Find profile by email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', targetEmail)
    .single();

  if (profileError || !profile) {
    console.error("Could not find profile for email. Make sure the user has signed up first.");
    return;
  }

  // 2. Find provider id
  const { data: provider, error: providerError } = await supabase
    .from('providers')
    .select('id')
    .eq('user_id', profile.id)
    .single();

  if (providerError || !provider) {
    console.error("User found, but is not registered as a provider.");
    return;
  }

  console.log(`Found Provider ID: ${provider.id}`);

  // 3. Add sample containers
  const containers = [
    {
      provider_id: provider.id,
      origin: "Mumbai, India",
      destination: "Dubai, UAE",
      origin_city: "Mumbai",
      origin_country: "India",
      destination_city: "Dubai",
      destination_country: "UAE",
      container_type: "standard_20",
      transport_mode: "sea",
      capacity_kg: 20000,
      price_usd: 1200,
      available_from: new Date().toISOString(),
      available_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "available",
      total_volume_m3: 33,
      available_volume_m3: 33,
      available_weight_kg: 20000
    },
    {
      provider_id: provider.id,
      origin: "Shanghai, China",
      destination: "Mumbai, India",
      origin_city: "Shanghai",
      origin_country: "China",
      destination_city: "Mumbai",
      destination_country: "India",
      container_type: "standard_40",
      transport_mode: "sea",
      capacity_kg: 28000,
      price_usd: 2400,
      available_from: new Date().toISOString(),
      available_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      status: "available",
      total_volume_m3: 67,
      available_volume_m3: 67,
      available_weight_kg: 28000
    },
    {
      provider_id: provider.id,
      origin: "Dubai, UAE",
      destination: "London, UK",
      origin_city: "Dubai",
      origin_country: "UAE",
      destination_city: "London",
      destination_country: "UK",
      container_type: "refrigerated_20",
      transport_mode: "sea",
      capacity_kg: 18000,
      price_usd: 1800,
      available_from: new Date().toISOString(),
      available_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      status: "available",
      total_volume_m3: 28,
      available_volume_m3: 28,
      available_weight_kg: 18000
    }
  ];

  const { data: inserted, error: insertError } = await supabase
    .from('containers')
    .insert(containers);

  if (insertError) {
    console.error("Error inserting containers:", insertError);
  } else {
    console.log("Successfully added 3 sample containers for the provider!");
  }
}

setupProvider();
