import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

const pagesData = [
  { page_number: 1, ad_type: "Portada", status: "Reserved" },
  { page_number: 2, ad_type: "Fundación", status: "Reserved" },
  { page_number: 3, ad_type: "Carta del alcalde", status: "Reserved" },
  { page_number: 5, ad_type: "Presentación concejal", status: "Reserved" },
  { page_number: 7, ad_type: "Presentación cura", status: "Reserved" },
  { page_number: 9, ad_type: "Comisión de festejos", status: "Reserved" },
  { page_number: 40, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 41, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 42, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 43, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 48, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 49, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 50, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 51, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 52, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 53, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 54, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 56, ad_type: "Abonos feria taurina", status: "Reserved" },
  { page_number: 58, ad_type: "Corporación municipal", status: "Reserved" },
  { page_number: 59, ad_type: "Teléfonos de interés", status: "Reserved" },
  { page_number: 60, ad_type: "Cruz de mayo", status: "Reserved" },
  { page_number: 61, ad_type: "Cruz de mayo", status: "Reserved" },
  { page_number: 64, ad_type: "San Roque", status: "Available" },
  { page_number: 65, ad_type: "San Roque", status: "Available" },
  { page_number: 72, ad_type: "Concentración clásicos", status: "Reserved" },
  { page_number: 73, ad_type: "Directorio", status: "Reserved" },
  { page_number: 74, ad_type: "Directorio", status: "Reserved" },
  { page_number: 75, ad_type: "Directorio", status: "Reserved" },
  { page_number: 76, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 77, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 78, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 91, ad_type: null, status: "Available" },
  { page_number: 92, ad_type: null, status: "Available" }
];

async function updatePages() {
  console.log("Starting database update...");
  for (const page of pagesData) {
    const { data, error } = await supabase
      .from('magazine_pages')
      .update({ status: page.status, ad_type: page.ad_type })
      .eq('page_number', page.page_number);
    
    if (error) {
      console.error(`Error updating page ${page.page_number}:`, error.message);
    } else {
      console.log(`Updated page ${page.page_number} -> ${page.status} (${page.ad_type})`);
    }
  }
  console.log("Update complete!");
}

updatePages();
