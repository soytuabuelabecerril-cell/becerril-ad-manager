import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

const toDbInvoice = (inv) => ({
  id: inv.id,
  status: inv.status,
  payment_method: inv.paymentMethod,
  is_paid: inv.isPaid,
  customer_name: inv.customerName,
  product_name: inv.productName,
  price: inv.price,
  design_price: inv.designPrice,
  vat: inv.vat,
  total: inv.total,
  assigned_page: inv.assignedPage,
  artwork_comment: inv.artworkComment,
  original_invoice_id: inv.originalInvoiceId
});

async function run() {
  const invoiceId = '10_2601'; // Let's try 10_2601 since the current next sequence is 10
  const reservedInvoice = {
    id: invoiceId,
    status: 'Reserved',
    customerName: 'System User',
    productName: 'Número Factura reservada',
    price: 0,
    designPrice: 0,
    vat: 0,
    total: 0,
    assignedPage: null,
    artworkComment: 'Número Factura reservada',
    paymentMethod: 'Pending',
    isPaid: false
  };

  console.log("Inserting reserved invoice...", toDbInvoice(reservedInvoice));
  const { data, error } = await supabase
    .from('invoices')
    .insert([toDbInvoice(reservedInvoice)])
    .select();

  if (error) {
    console.error("Database insert error:", error);
  } else {
    console.log("Success! Data returned:", data);
  }
}

run();
