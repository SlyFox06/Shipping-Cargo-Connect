import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkUsers() {
  console.log("Checking all profiles in the database...");
  const { data, error } = await supabase.from('profiles').select('id, email, full_name');
  
  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  console.log("--- PROFILES FOUND ---");
  data.forEach(p => console.log(`- ID: ${p.id} | Email: ${p.email} | Name: ${p.full_name}`));
  console.log("------------------------");
}

checkUsers();
