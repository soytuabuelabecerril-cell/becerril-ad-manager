import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== CUSTOMER AaSbs ===");
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .ilike('commercial_name', '%AaSbs%');
  if (cErr) console.error(cErr);
  else console.log(customers);

  console.log("\n=== AD RESERVATIONS PAGE 10 ===");
  const { data: ads, error: aErr } = await supabase
    .from('ad_reservations')
    .select('*')
    .eq('page_number', 10);
  if (aErr) console.error(aErr);
  else console.log(ads);
}

inspect();
