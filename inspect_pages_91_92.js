import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Updating pages 91 and 92 in magazine_pages...");
    const { data, error } = await supabase
      .from('magazine_pages')
      .update({ status: 'Available', ad_type: null })
      .in('page_number', [91, 92]);
    
    if (error) {
      console.error("Update Error:", error);
    } else {
      console.log("Successfully updated pages 91 and 92 in Supabase!");
      
      // Let's verify the updated values
      const { data: verifiedData, error: verifyError } = await supabase
        .from('magazine_pages')
        .select('*')
        .in('page_number', [91, 92]);
      if (verifyError) {
        console.error("Verify Error:", verifyError);
      } else {
        console.log("Verified pages 91 and 92 rows in DB:", verifiedData);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
