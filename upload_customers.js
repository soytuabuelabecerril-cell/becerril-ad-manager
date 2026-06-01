import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadCustomers() {
  console.log("Reading extracted customers...");
  const rawData = fs.readFileSync('extracted_customers.json');
  const customers = JSON.parse(rawData);
  
  console.log(`Found ${customers.length} customers to upload.`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const c of customers) {
    // Basic mapping from JSON to the DB schema
    const payload = {
      fiscal_name: c.fiscal_name,
      commercial_name: c.fiscal_name, // Defaulting to fiscal name
      nif: c.nif || 'UNKNOWN-' + Math.random().toString(36).substring(7), // NIF is required and unique in schema
      address: c.address,
      last_year_product: c.last_year_product
    };

    const { error } = await supabase
      .from('customers')
      .insert([payload]);
    
    if (error) {
      // If NIF constraint fails because of duplicate "UNKNOWN", we ignore for this MVP script
      console.error(`Error uploading ${c.fiscal_name}:`, error.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log(`\nUpload complete! Successfully added ${successCount} customers. Failed: ${errorCount}`);
}

uploadCustomers();
