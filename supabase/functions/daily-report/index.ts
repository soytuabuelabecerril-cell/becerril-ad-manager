// supabase/functions/daily-report/index.ts
// Deno Edge Function — generates a daily Excel financial report and emails it.
// Triggered by Supabase Cron at 23:00 UTC or manually via POST from the UI.

import { createClient } from 'npm:@supabase/supabase-js@2';
import * as XLSX from 'npm:xlsx@0.18.5';
import { encodeBase64 } from "https://deno.land/std@0.203.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toFixed(2) + ' €';

const dateStr = (iso: string | null) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid'
  });
};

const todayLabel = () => {
  return new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Europe/Madrid'
  });
};

const todayFilename = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  return `informe-financiero-${y}-${m}-${dd}.xlsx`;
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const headerStyle = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '3730A3' } }, // indigo-800
  alignment: { horizontal: 'center', vertical: 'center' },
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  }
};

const paidStyle = {
  font: { color: { rgb: '065F46' } }, // emerald-900
  fill: { fgColor: { rgb: 'D1FAE5' } }, // emerald-100
};

const pendingStyle = {
  font: { color: { rgb: '92400E' } }, // amber-900
  fill: { fgColor: { rgb: 'FEF3C7' } }, // amber-100
};

const totalRowStyle = {
  font: { bold: true, sz: 11 },
  fill: { fgColor: { rgb: 'EEF2FF' } }, // indigo-50
};

function applyStyles(ws: XLSX.WorkSheet, range: XLSX.Range, headerCols: string[]) {
  // Headers are on row 1 (0-indexed: row 0)
  for (const col of headerCols) {
    const cell = ws[`${col}1`];
    if (cell) cell.s = headerStyle;
  }
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSummarySheet(invoices: any[], recibos: any[], orders: any[]) {
  const active = invoices.filter(i => i.status !== 'Cancelled' && i.status !== 'Refund');
  const totalReceivables = active.reduce((s: number, i: any) => s + (i.total || 0), 0);
  const totalPaid        = active.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + (i.total || 0), 0);
  const totalPending     = active.filter((i: any) => !i.is_paid).reduce((s: number, i: any) => s + (i.total || 0), 0);
  const vatPaid          = active.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + (i.vat || 0), 0);
  const vatPending       = active.filter((i: any) => !i.is_paid).reduce((s: number, i: any) => s + (i.vat || 0), 0);
  const collectionRate   = totalReceivables > 0 ? (totalPaid / totalReceivables) * 100 : 0;

  const totalRecibos     = recibos.reduce((s: number, r: any) => s + (r.total || 0), 0);
  const activeOrders     = orders.filter((o: any) => o.status === 'Active' || o.status === 'Pre-Reserved');

  const rows = [
    ['📊 RESUMEN FINANCIERO — ' + todayLabel(), ''],
    ['', ''],
    ['MÉTRICA', 'VALOR'],
    ['Generado el', new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })],
    ['', ''],
    ['── FACTURAS ──', ''],
    ['Total Facturado (activas)', fmt(totalReceivables)],
    ['Total Cobrado', fmt(totalPaid)],
    ['Total Pendiente', fmt(totalPending)],
    ['IVA Cobrado', fmt(vatPaid)],
    ['IVA Pendiente', fmt(vatPending)],
    ['Tasa de Cobro', collectionRate.toFixed(1) + '%'],
    ['Nº Facturas Activas', active.length],
    ['Nº Facturas Pagadas', active.filter((i: any) => i.is_paid).length],
    ['Nº Facturas Pendientes', active.filter((i: any) => !i.is_paid).length],
    ['', ''],
    ['── RECIBOS ──', ''],
    ['Total Recibos Cobrado', fmt(totalRecibos)],
    ['Nº Recibos', recibos.length],
    ['', ''],
    ['── PEDIDOS ──', ''],
    ['Pedidos Activos / Pre-reservas', activeOrders.length],
    ['Total Pedidos', orders.length],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 35 }, { wch: 22 }];
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  // Style the title
  if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14, color: { rgb: '3730A3' } }, alignment: { horizontal: 'center' } };
  if (ws['A3']) ws['A3'].s = headerStyle;
  if (ws['B3']) ws['B3'].s = headerStyle;

  return ws;
}

function buildInvoicesSheet(invoices: any[]) {
  const headers = [
    'ID Factura', 'Fecha', 'Cliente', 'Producto', 'Pág.', 'Estado Factura',
    'Precio Base €', 'Diseño €', 'Subtotal €', 'IVA €', 'Total €',
    'Pagado', 'Método Pago', 'Email Enviado'
  ];

  const rows = invoices.map((i: any) => {
    const subtotal = (i.price || 0) + (i.design_price || 0);
    return [
      i.id,
      dateStr(i.created_at),
      i.customer_name || '',
      i.product_name || '',
      i.assigned_page || '',
      i.status || '',
      Number((i.price || 0).toFixed(2)),
      Number((i.design_price || 0).toFixed(2)),
      Number(subtotal.toFixed(2)),
      Number((i.vat || 0).toFixed(2)),
      Number((i.total || 0).toFixed(2)),
      i.is_paid ? 'SÍ' : 'NO',
      i.payment_method || '',
      dateStr(i.email_sent_at),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [18, 18, 22, 22, 6, 12, 13, 10, 12, 10, 12, 8, 14, 18]);

  // Style header row
  'ABCDEFGHIJKLMN'.split('').forEach(col => {
    const cell = ws[`${col}1`];
    if (cell) cell.s = headerStyle;
  });

  // Style paid/pending rows
  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, +1 for header
    const isPaid = row[11] === 'SÍ';
    const style = isPaid ? paidStyle : pendingStyle;
    if (ws[`L${rowNum}`]) ws[`L${rowNum}`].s = style;
    if (ws[`K${rowNum}`]) ws[`K${rowNum}`].s = style;
  });

  // Add totals row
  const totalRow = rows.length + 2;
  const sums = rows.reduce((acc: number[], row) => {
    [6, 7, 8, 9, 10].forEach(i => { acc[i] = (acc[i] || 0) + (Number(row[i]) || 0); });
    return acc;
  }, []);

  const totalsData: any[] = ['TOTALES', '', '', '', '', '',
    Number(sums[6]?.toFixed(2) || 0),
    Number(sums[7]?.toFixed(2) || 0),
    Number(sums[8]?.toFixed(2) || 0),
    Number(sums[9]?.toFixed(2) || 0),
    Number(sums[10]?.toFixed(2) || 0),
    '', '', ''
  ];
  XLSX.utils.sheet_add_aoa(ws, [totalsData], { origin: `A${totalRow}` });
  'ABCDEFGHIJK'.split('').forEach(col => {
    const cell = ws[`${col}${totalRow}`];
    if (cell) cell.s = totalRowStyle;
  });

  return ws;
}

function buildRecibosSheet(recibos: any[]) {
  const headers = [
    'ID Recibo', 'Fecha', 'Cliente', 'Producto', 'Pág.',
    'Precio Base €', 'Diseño €', 'Total €', 'Email Cliente', 'Teléfono', 'Email Enviado'
  ];

  const rows = recibos.map((r: any) => [
    r.id,
    dateStr(r.created_at),
    r.customer_name || '',
    r.product_name || '',
    r.assigned_page || '',
    Number((r.price || 0).toFixed(2)),
    Number((r.design_price || 0).toFixed(2)),
    Number((r.total || 0).toFixed(2)),
    r.customer_email || '',
    r.customer_phone || '',
    dateStr(r.email_sent_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [18, 18, 22, 22, 6, 13, 10, 12, 24, 16, 18]);

  'ABCDEFGHIJK'.split('').forEach(col => {
    const cell = ws[`${col}1`];
    if (cell) cell.s = headerStyle;
  });

  // Totals
  const totalRow = rows.length + 2;
  const sums = rows.reduce((acc: number[], row) => {
    [5, 6, 7].forEach(i => { acc[i] = (acc[i] || 0) + (Number(row[i]) || 0); });
    return acc;
  }, []);
  const totalsData: any[] = ['TOTALES', '', '', '', '',
    Number(sums[5]?.toFixed(2) || 0),
    Number(sums[6]?.toFixed(2) || 0),
    Number(sums[7]?.toFixed(2) || 0),
    '', '', ''
  ];
  XLSX.utils.sheet_add_aoa(ws, [totalsData], { origin: `A${totalRow}` });
  'ABCDEFGH'.split('').forEach(col => {
    const cell = ws[`${col}${totalRow}`];
    if (cell) cell.s = totalRowStyle;
  });

  return ws;
}

function buildOrdersSheet(orders: any[]) {
  const headers = [
    'ID Pedido', 'Fecha', 'Cliente', 'Producto', 'Pág.', 'Tipo', 'Estado',
    'Precio Base €', 'Diseño €', 'Método Pago', 'Email Cliente', 'Teléfono', 'Recordatorio'
  ];

  const rows = orders.map((o: any) => [
    o.id,
    dateStr(o.created_at),
    o.customer_name || '',
    o.product_name || '',
    o.assigned_page || '',
    o.order_type || '',
    o.status || '',
    Number((o.price || 0).toFixed(2)),
    Number((o.design_price || 0).toFixed(2)),
    o.payment_method || '',
    o.customer_email || '',
    o.customer_phone || '',
    dateStr(o.reminder_sent_at),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  setColWidths(ws, [18, 18, 22, 22, 6, 14, 14, 13, 10, 14, 24, 16, 18]);

  'ABCDEFGHIJKLM'.split('').forEach(col => {
    const cell = ws[`${col}1`];
    if (cell) cell.s = headerStyle;
  });

  return ws;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const fromEmail    = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';
    const reportEmail  = Deno.env.get('DAILY_REPORT_EMAIL')!;

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY secret must be set.');
    }

    // ── Fetch data from Supabase ──────────────────────────────────────────────
    const supabase = createClient(supabaseUrl, serviceKey);

    const [invRes, recRes, ordRes] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
      supabase.from('recibos').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ]);

    if (invRes.error) throw new Error('Invoices fetch error: ' + invRes.error.message);
    if (recRes.error) throw new Error('Recibos fetch error: ' + recRes.error.message);
    if (ordRes.error) throw new Error('Orders fetch error: ' + ordRes.error.message);

    const invoices = invRes.data || [];
    const recibos  = recRes.data || [];
    const orders   = ordRes.data || [];

    // ── Build Excel workbook ─────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, buildSummarySheet(invoices, recibos, orders), '📊 Resumen');
    XLSX.utils.book_append_sheet(wb, buildInvoicesSheet(invoices), '🧾 Facturas');
    XLSX.utils.book_append_sheet(wb, buildRecibosSheet(recibos), '📄 Recibos');
    XLSX.utils.book_append_sheet(wb, buildOrdersSheet(orders), '📋 Pedidos');

    // Write to buffer (Deno-compatible — no Buffer/Node globals)
    const xlsxBuffer: Uint8Array = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // ── Send email ────────────────────────────────────────────────────────────

    const activeInvoices  = invoices.filter((i: any) => i.status !== 'Cancelled' && i.status !== 'Refund');
    const totalPaid       = activeInvoices.filter((i: any) => i.is_paid).reduce((s: number, i: any) => s + (i.total || 0), 0);
    const totalPending    = activeInvoices.filter((i: any) => !i.is_paid).reduce((s: number, i: any) => s + (i.total || 0), 0);
    const totalRecibos    = recibos.reduce((s: number, r: any) => s + (r.total || 0), 0);
    const today           = todayLabel();
    const filename        = todayFilename();

    const htmlBody = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
    .card { max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #3730A3, #6D28D9); padding: 32px 28px; color: white; }
    .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 800; }
    .header p { margin: 0; opacity: 0.8; font-size: 14px; }
    .body { padding: 28px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .kpi { background: #f1f5f9; border-radius: 10px; padding: 14px 16px; }
    .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
    .kpi-value { font-size: 20px; font-weight: 800; color: #1e293b; }
    .kpi.green .kpi-value { color: #059669; }
    .kpi.amber .kpi-value { color: #d97706; }
    .kpi.blue .kpi-value { color: #3730A3; }
    .attachment-note { background: #EEF2FF; border-radius: 10px; padding: 14px 16px; border-left: 4px solid #6366f1; font-size: 13px; color: #3730A3; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #94a3b8; text-align: center; padding: 12px 0 0; border-top: 1px solid #f1f5f9; }
    .counts { font-size: 12px; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📊 Informe Financiero Diario</h1>
      <p>${today}</p>
    </div>
    <div class="body">
      <div class="attachment-note">
        📎 El informe completo está adjunto en formato Excel con 4 hojas:<br>
        <strong>Resumen · Facturas · Recibos · Pedidos</strong>
      </div>
      <div class="kpi-grid">
        <div class="kpi green">
          <div class="kpi-label">Total Cobrado</div>
          <div class="kpi-value">${totalPaid.toFixed(2)} €</div>
          <div class="counts">${activeInvoices.filter((i: any) => i.is_paid).length} facturas pagadas</div>
        </div>
        <div class="kpi amber">
          <div class="kpi-label">Pendiente de Cobro</div>
          <div class="kpi-value">${totalPending.toFixed(2)} €</div>
          <div class="counts">${activeInvoices.filter((i: any) => !i.is_paid).length} facturas pendientes</div>
        </div>
        <div class="kpi blue">
          <div class="kpi-label">Total Recibos</div>
          <div class="kpi-value">${totalRecibos.toFixed(2)} €</div>
          <div class="counts">${recibos.length} recibos</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Pedidos Activos</div>
          <div class="kpi-value">${orders.filter((o: any) => o.status === 'Active' || o.status === 'Pre-Reserved').length}</div>
          <div class="counts">de ${orders.length} totales</div>
        </div>
      </div>
      <div class="footer">
        Generado automáticamente por Panel Financiero — Revista Becerril<br>
        Este informe se envía cada día a las 23:00
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const base64Content = encodeBase64(xlsxBuffer);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [reportEmail],
        subject: `📊 Informe Financiero Diario — ${new Date().toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })}`,
        html: htmlBody,
        attachments: [
          {
            filename,
            content: base64Content
          }
        ]
      })
    });

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(responseData)}`);
    }

    console.log(`[daily-report] Email sent successfully via Resend to ${reportEmail} with ${filename}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Informe enviado a ${reportEmail}`,
        filename,
        counts: { invoices: invoices.length, recibos: recibos.length, orders: orders.length }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err: any) {
    console.error('[daily-report] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
