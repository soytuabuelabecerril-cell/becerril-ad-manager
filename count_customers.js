import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function countCustomers() {
  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error fetching customers:', error);
  } else {
    console.log(`Total customers: ${count}`);
  }
}

countCustomers();
