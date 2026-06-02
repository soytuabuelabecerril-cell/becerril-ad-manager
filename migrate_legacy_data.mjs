// migrate_legacy_data.mjs
// Inserts the original hardcoded reservations from fallbackData.js into Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://dfjxmnsozvmfhojnuikx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc'
);

// All legacy reservations from fallbackData.js initialData
// Only the Reserved ones get an ad_reservation entry
const legacyReservations = [
  { page_number: 1,  ad_type: 'Portada' },
  { page_number: 2,  ad_type: 'Fundación' },
  { page_number: 3,  ad_type: 'Carta del alcalde' },
  { page_number: 5,  ad_type: 'Presentación concejal' },
  { page_number: 7,  ad_type: 'Presentación cura' },
  { page_number: 9,  ad_type: 'Comisión de festejos' },
  { page_number: 40, ad_type: 'Las mises y peñas' },
  { page_number: 41, ad_type: 'Las mises y peñas' },
  { page_number: 42, ad_type: 'Las mises y peñas' },
  { page_number: 43, ad_type: 'Las mises y peñas' },
  { page_number: 48, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 49, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 50, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 51, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 52, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 53, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 54, ad_type: 'Programa de fiestas y feria taurina' },
  { page_number: 56, ad_type: 'Abonos feria taurina' },
  { page_number: 58, ad_type: 'Corporación municipal' },
  { page_number: 59, ad_type: 'Teléfonos de interés' },
  { page_number: 60, ad_type: 'Cruz de mayo' },
  { page_number: 61, ad_type: 'Cruz de mayo' },
  { page_number: 72, ad_type: 'Concentración clásicos' },
  { page_number: 73, ad_type: 'Directorio' },
  { page_number: 74, ad_type: 'Directorio' },
  { page_number: 75, ad_type: 'Directorio' },
  { page_number: 76, ad_type: 'Horarios autobuses' },
  { page_number: 77, ad_type: 'Horarios autobuses' },
  { page_number: 78, ad_type: 'Horarios autobuses' },
];

console.log(`Migrating ${legacyReservations.length} legacy reservations to ad_reservations...`);

// Build insert rows
const rows = legacyReservations.map(r => ({
  page_number: r.page_number,
  customer_id: 'legacy',
  customer_name: r.ad_type, // Use the ad_type as the display name (it's what showed in the grid)
  ad_type: r.ad_type,
  is_paid: false,
  is_pre_reserved: false,
  is_new: false,
  payment_method: 'Transfer',
}));

const { data, error } = await supabase
  .from('ad_reservations')
  .insert(rows)
  .select('page_number, ad_type');

if (error) {
  console.error('❌ Insert failed:', error.message);
  process.exit(1);
}

console.log(`✅ Inserted ${data.length} rows into ad_reservations`);

// Update magazine_pages statuses to match
const reservedPageNums = [...new Set(legacyReservations.map(r => r.page_number))];
console.log(`\nUpdating magazine_pages statuses for ${reservedPageNums.length} pages...`);

const { error: updateErr } = await supabase
  .from('magazine_pages')
  .update({ status: 'Reserved' })
  .in('page_number', reservedPageNums);

if (updateErr) {
  console.error('❌ Update magazine_pages failed:', updateErr.message);
} else {
  console.log('✅ magazine_pages statuses updated');
}

// Verify final state
const { count: adsCount } = await supabase.from('ad_reservations').select('*', { count: 'exact', head: true });
const { data: statusBreakdown } = await supabase.from('magazine_pages').select('status');
const statuses = {};
statusBreakdown.forEach(p => { statuses[p.status] = (statuses[p.status] || 0) + 1; });

console.log(`\n--- Final state ---`);
console.log(`ad_reservations: ${adsCount} total rows`);
console.log(`magazine_pages statuses:`, statuses);
console.log('\nMigration complete! ✅');
