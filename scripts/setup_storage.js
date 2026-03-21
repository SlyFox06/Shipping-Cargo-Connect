import { createClient } from '@supabase/supabase-js';

// Configuration from env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function createStorageBucket() {
  console.log("Creating 'booking-documents' bucket...");
  
  const { data, error } = await supabase
    .storage
    .createBucket('booking-documents', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
      fileSizeLimit: 10485760 // 10MB
    });

  if (error) {
    if (error.message.includes("already exists")) {
      console.log("Bucket already exists. Updating settings...");
      const { error: updateError } = await supabase
        .storage
        .updateBucket('booking-documents', {
          public: true
        });
      if (updateError) console.error("Error updating bucket:", updateError);
      else console.log("Bucket updated successfully!");
    } else {
      console.error("Error creating bucket:", error);
    }
  } else {
    console.log("Bucket 'booking-documents' created successfully!");
  }
}

createStorageBucket();
