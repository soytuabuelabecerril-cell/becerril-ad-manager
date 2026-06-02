import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Fetching tables schema / counts via Supabase REST API...");

    // Fetch customers count
    const { count: customersCount, error: err1 } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    if (err1) {
      console.error("Error fetching customers count:", err1.message);
    } else {
      console.log("Customers row count:", customersCount);
    }

    // Fetch magazine_pages count
    const { count: pagesCount, error: err2 } = await supabase
      .from('magazine_pages')
      .select('*', { count: 'exact', head: true });
    if (err2) {
      console.error("Error fetching magazine_pages count:", err2.message);
    } else {
      console.log("magazine_pages row count:", pagesCount);
      // Let's also check if there are actual rows
      const { data: pageRows, error: err2b } = await supabase
        .from('magazine_pages')
        .select('*')
        .limit(3);
      if (err2b) {
        console.error("Error fetching sample pages:", err2b.message);
      } else {
        console.log("Sample magazine_pages:", pageRows);
      }
    }

    // Fetch ad_reservations count if it exists
    const { data: adsData, count: adsCount, error: err3 } = await supabase
      .from('ad_reservations')
      .select('*', { count: 'exact' });
    if (err3) {
      console.log("ad_reservations table does not exist or error:", err3.message);
    } else {
      console.log("ad_reservations row count:", adsCount);
    }

    // Fetch invoices count if it exists
    const { count: invoicesCount, error: err4 } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true });
    if (err4) {
      console.log("invoices table does not exist or error:", err4.message);
    } else {
      console.log("invoices row count:", invoicesCount);
    }

    // Fetch recibos count if it exists
    const { count: recibosCount, error: err5 } = await supabase
      .from('recibos')
      .select('*', { count: 'exact', head: true });
    if (err5) {
      console.log("recibos table does not exist or error:", err5.message);
    } else {
      console.log("recibos row count:", recibosCount);
    }

    // Fetch orders count if it exists
    const { count: ordersCount, error: err6 } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    if (err6) {
      console.log("orders table does not exist or error:", err6.message);
    } else {
      console.log("orders row count:", ordersCount);
    }

    // Fetch invoice_settings count if it exists
    const { count: settingsCount, error: err7 } = await supabase
      .from('invoice_settings')
      .select('*', { count: 'exact', head: true });
    if (err7) {
      console.log("invoice_settings table does not exist or error:", err7.message);
    } else {
      console.log("invoice_settings row count:", settingsCount);
    }

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();
