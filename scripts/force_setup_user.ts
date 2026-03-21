import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function forceCreateUser() {
  const email = "naik90816@gmail.com";
  const dummyUserId = "12345678-1234-1234-1234-123456789012"; // We'll try to get real sessions instead

  console.log("Attempting to fix profile and provider for:", email);

  // 1. Try to find if user exists in auth (can't do via client, so we'll just check profiles)
  const { data: profiles } = await supabase.from('profiles').select('id').eq('email', email);
  
  if (!profiles || profiles.length === 0) {
    console.log("No profile found. If you are signed in, please refresh the page to trigger the handle_new_user function.");
    console.log("Alternatively, if you haven't signed up yet, please do so at /auth.");
  } else {
    const userId = profiles[0].id;
    console.log("Found profile for user ID:", userId);
    
    // Check if provider exists
    const { data: providers } = await supabase.from('providers').select('id').eq('user_id', userId);
    if (!providers || providers.length === 0) {
      console.log("Profile found but no provider record. Creating...");
      const { error } = await supabase.from('providers').insert({
        user_id: userId,
        transport_mode: 'sea',
        verified: true
      });
      if (error) console.error("Error creating provider:", error.message);
      else console.log("Provider record created!");
    } else {
      console.log("Provider record already exists.");
    }
  }
}

forceCreateUser();
