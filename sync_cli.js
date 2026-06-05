import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1BhC7XuASyIXW4PrCU1HOWOJ9rvWpaoCCfqVIr2XVAK0/edit?usp=sharing';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyw5VNfUS5-gN1RBCZvCOgkUn5julNv9o3Bo5YKeVdyxHQnt7zNgcILfMz1zjbFZ1LC/exec';

// Mapping Helpers
const fromDbInvoice = (row) => ({
  id: row.id,
  createdAt: row.created_at,
  status: row.status,
  paymentMethod: row.payment_method,
  isPaid: row.is_paid,
  customerName: row.customer_name,
  productName: row.product_name,
  price: parseFloat(row.price || 0),
  designPrice: parseFloat(row.design_price || 0),
  vat: parseFloat(row.vat || 0),
  total: parseFloat(row.total || 0),
  assignedPage: row.assigned_page,
  artworkComment: row.artwork_comment
});

const fromDbRecibo = (row) => ({
  id: row.id,
  createdAt: row.created_at,
  status: row.status,
  paymentMethod: row.payment_method,
  isPaid: row.is_paid,
  isRecibo: row.is_recibo,
  customerName: row.customer_name,
  productName: row.product_name,
  price: parseFloat(row.price || 0),
  designPrice: parseFloat(row.design_price || 0),
  total: parseFloat(row.total || 0),
  assignedPage: row.assigned_page
});

const fromDbAd = (row) => ({
  id: row.id,
  ad_type: row.ad_type,
  customer_id: row.customer_id,
  customer_name: row.customer_name,
  isPreReserved: row.is_pre_reserved,
  expires_at: row.expires_at,
  artworkOption: row.artwork_option,
  designWorkOption: row.design_work_option,
  designWorkPrice: parseFloat(row.design_work_price || 0),
  isPaid: row.is_paid,
  paymentMethod: row.payment_method,
  isNew: row.is_new,
  isRecibo: row.is_recibo,
  createdAt: row.created_at
});

async function run() {
  try {
    console.log("Fetching data from Supabase...");

    // 1. Fetch pages
    const { data: pagesData, error: pagesErr } = await supabase
      .from('magazine_pages')
      .select('*')
      .order('page_number', { ascending: true });
    if (pagesErr) throw pagesErr;

    // 2. Fetch ads
    const { data: adsData, error: adsErr } = await supabase
      .from('ad_reservations')
      .select('*');
    if (adsErr) throw adsErr;

    // 3. Fetch invoices
    const { data: invoicesData, error: invoicesErr } = await supabase
      .from('invoices')
      .select('*');
    if (invoicesErr) throw invoicesErr;

    // 4. Fetch recibos
    const { data: recibosData, error: recibosErr } = await supabase
      .from('recibos')
      .select('*');
    if (recibosErr) throw recibosErr;

    const invoices = invoicesData.map(fromDbInvoice);
    const recibos = recibosData.map(fromDbRecibo);

    // Combine pages and ads
    const pages = pagesData.map(p => {
      const pageAds = adsData.filter(ad => ad.page_number === p.page_number).map(fromDbAd);
      return {
        ...p,
        ads: pageAds,
        status: pageAds.length > 0 ? 'Reserved' : p.status
      };
    });

    console.log(`Processing data: ${pages.length} pages, ${invoices.length} invoices, ${recibos.length} recibos.`);

    // 1. Prepare Reservations Ledger Data
    const ledgerRows = [];
    pages.forEach(p => {
      if (p.ads && p.ads.length > 0) {
        p.ads.forEach(ad => {
          let invoiceId = '';
          let received = 0;
          let outstanding = 0;
          let statusText = ad.isPreReserved ? 'Pre-reserva' : 'Reservada';

          if (ad.isPreReserved) {
            invoiceId = 'Pre-reserva';
            received = 0;
            outstanding = 0;
          } else if (ad.isRecibo) {
            const matchingRecibo = recibos.find(r => 
              r.assignedPage === p.page_number &&
              r.customerName === ad.customer_name &&
              r.productName === ad.ad_type &&
              r.status !== 'Cancelled'
            );
            if (matchingRecibo) {
              invoiceId = matchingRecibo.id;
              received = parseFloat(matchingRecibo.total || 0);
              outstanding = 0;
              statusText = 'Pagada (Recibo)';
            } else {
              invoiceId = 'Recibo';
              received = parseFloat(ad.designWorkPrice || 0);
              outstanding = 0;
              statusText = 'Pagada';
            }
          } else {
            const matchingInvoice = invoices.find(inv => 
              inv.assignedPage === p.page_number &&
              inv.customerName === ad.customer_name &&
              inv.productName === ad.ad_type &&
              inv.status !== 'Cancelled'
            );
            if (matchingInvoice) {
              invoiceId = matchingInvoice.id;
              if (matchingInvoice.isPaid) {
                received = parseFloat(matchingInvoice.total || 0);
                outstanding = 0;
                statusText = 'Pagada';
              } else {
                received = 0;
                outstanding = parseFloat(matchingInvoice.total || 0);
                statusText = 'Pendiente de Pago';
              }
            } else {
              if (ad.isPaid) {
                received = parseFloat(ad.designWorkPrice || 0);
                outstanding = 0;
                statusText = 'Pagada';
              } else {
                received = 0;
                outstanding = parseFloat(ad.designWorkPrice || 0);
                statusText = 'Pendiente';
              }
            }
          }

          ledgerRows.push({
            'Página': p.page_number,
            'Tipo de Reserva': ad.ad_type,
            'Cliente': ad.customer_name || 'Desconocido',
            'ID Factura / Recibo': invoiceId || 'Sin Facturar',
            'Importe Recibido (€)': received,
            'Importe Pendiente (€)': outstanding,
            'Método de Pago': ad.paymentMethod || 'No especificado',
            'Estado': statusText
          });
        });
      }
    });

    ledgerRows.sort((a, b) => a['Página'] - b['Página']);

    // 2. Prepare Cash transactions without VAT Data
    const cashRows = recibos
      .filter(r => r.status !== 'Cancelled')
      .map(r => ({
        'ID Recibo': r.id,
        'Fecha': r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : '',
        'Cliente': r.customerName,
        'Producto': r.productName,
        'Página Asignada': r.assignedPage || 'Sin asignar',
        'Importe Cobrado (Sin IVA) (€)': parseFloat(r.total || 0),
        'Método de Pago': r.paymentMethod || 'Efectivo',
        'Estado': r.status === 'Active' ? 'Activo' : r.status
      }));

    console.log(`Sending sync request to Google Sheets Web App...`);
    console.log(`Spreadsheet URL: ${SPREADSHEET_URL}`);
    console.log(`Script Web App URL: ${SCRIPT_URL}`);

    const payload = {
      spreadsheetUrl: SPREADSHEET_URL,
      ledger: ledgerRows,
      cash: cashRows
    };

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify(payload)
    });

    const resText = await response.text();
    console.log("Response Status:", response.status);
    console.log("Response Body:", resText);

    try {
      const resJson = JSON.parse(resText);
      if (resJson.success) {
        console.log("✅ Google Sheets synced successfully!");
      } else {
        console.error("❌ Google Sheets sync failed:", resJson.error);
      }
    } catch {
      console.log("Response is not JSON, might be HTML due to Google login/auth redirects or success page.");
    }

  } catch (error) {
    console.error("Error running sync script:", error);
  }
}

run();
