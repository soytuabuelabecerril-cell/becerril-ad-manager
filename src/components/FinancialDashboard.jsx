import React, { useState } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { TrendingUp, CheckCircle, Clock, Euro, BookOpen, AlertCircle, BarChart2, ArrowUpRight, ArrowDownRight, Send, Loader2, Mail, FileText, Copy, Check, X, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const translateActionType = (type, lang) => {
  const isEs = lang === 'es';
  switch (type) {
    case 'create_invoice':
      return isEs ? 'Crear Factura' : 'Create Invoice';
    case 'create_invoice_with_reservation':
      return isEs ? 'Reserva con Factura' : 'Reserve with Invoice';
    case 'pay_invoice':
      return isEs ? 'Pagar Factura' : 'Pay Invoice';
    case 'unpay_invoice':
      return isEs ? 'Desmarcar Pago Factura' : 'Unpay Invoice';
    case 'send_invoice_email':
      return isEs ? 'Enviar Email Factura' : 'Send Invoice Email';
    case 'send_recibo_email':
      return isEs ? 'Enviar Email Recibo' : 'Send Receipt Email';
    case 'cancel_invoice':
      return isEs ? 'Cancelar Factura' : 'Cancel Invoice';
    case 'create_refund_invoice':
      return isEs ? 'Crear Factura de Abono' : 'Create Refund Invoice';
    case 'delete_invoice':
      return isEs ? 'Papelera Factura' : 'Delete Invoice';
    case 'hard_delete_invoice':
      return isEs ? 'Eliminar Factura Permanentemente' : 'Hard Delete Invoice';
    case 'reserve_invoice_number':
      return isEs ? 'Reservar Número de Factura' : 'Reserve Invoice Number';
    case 'create_order':
      return isEs ? 'Crear Pedido de Transferencia' : 'Create Order';
    case 'pre_reserve_ad':
      return isEs ? 'Crear Pre-reserva' : 'Pre-reserve Space';
    case 'delete_order':
      return isEs ? 'Eliminar Pedido' : 'Delete Order';
    case 'update_order':
      return isEs ? 'Actualizar Pedido' : 'Update Order';
    case 'create_recibo':
      return isEs ? 'Crear Recibo' : 'Create Receipt';
    case 'delete_recibo':
      return isEs ? 'Eliminar Recibo' : 'Delete Receipt';
    default:
      return type;
  }
};

const getActionBadgeColor = (actionType) => {
  if (actionType.includes('create') || actionType.includes('reserve')) {
    return 'bg-blue-50 text-blue-700 border-blue-100';
  }
  if (actionType.includes('pay') || actionType.includes('confirm')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
  if (actionType.includes('cancel') || actionType.includes('delete') || actionType.includes('liberate')) {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  if (actionType.includes('send') || actionType.includes('email')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  }
  return 'bg-slate-50 text-slate-700 border-slate-100';
};

const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
};

const convertEventLogsToCsv = (logs) => {
  if (!logs || logs.length === 0) return '';
  const headers = [
    'Timestamp',
    'Action Type',
    'Target ID',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Product Name',
    'Page Number',
    'Price',
    'Design Price',
    'VAT',
    'Total',
    'Payment Method',
    'Payment Status'
  ];
  const csvHeaderLine = headers.join(',');
  const csvRows = logs.map(row => {
    const fields = [
      row.created_at || '',
      row.action_type || '',
      row.target_id || '',
      row.customer_name || '',
      row.customer_email || '',
      row.customer_phone || '',
      row.product_name || '',
      row.page_number !== null && row.page_number !== undefined ? String(row.page_number) : '',
      row.price !== undefined ? String(row.price) : '0',
      row.design_price !== undefined ? String(row.design_price) : '0',
      row.vat !== undefined ? String(row.vat) : '0',
      row.total !== undefined ? String(row.total) : '0',
      row.payment_method || '',
      row.payment_status || (row.is_paid ? 'Paid' : 'Pending')
    ];
    return fields.map(field => {
      let cell = field === null || field === undefined ? '' : String(field);
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        cell = `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',');
  });
  return [csvHeaderLine, ...csvRows].join('\n');
};

const downloadCsv = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const KpiCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className={`relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3 hover:shadow-md transition-shadow`}>
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.bg}`}>
      <Icon size={20} className={color.icon} />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
    {trend !== undefined && (
      <div className={`absolute top-4 right-4 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
        {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(trend).toFixed(1)}%
      </div>
    )}
    {/* decorative blob */}
    <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-5 ${color.blob}`} />
  </div>
);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const FinancialDashboard = () => {
  const { t, language } = useLanguage();
  const { invoices, pages, recibos, actionLogs } = useDatabase();
  const [reportStatus, setReportStatus] = useState(null); // null | 'sending' | 'success' | 'error'
  const [reportMsg, setReportMsg] = useState('');
  const [syncStatus, setSyncStatus] = useState(null); // null | 'syncing' | 'success' | 'error' | 'configure'
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [activeLogTab, setActiveLogTab] = useState('ledger'); // 'ledger' | 'cash' | 'event_logs'
  const [copied, setCopied] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const sendDailyReport = async () => {
    setReportStatus('sending');
    setReportMsg('');
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setReportStatus('success');
        setReportMsg(data.message || 'Informe enviado correctamente');
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setReportStatus('error');
      setReportMsg(err.message || 'Error al enviar el informe');
    } finally {
      setTimeout(() => setReportStatus(null), 6000);
    }
  };

  const getReportData = () => {
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

    // Sort by page number ascending
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

    return { ledgerRows, cashRows };
  };

  const convertToCsv = (data) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvHeaderLine = headers.join(',');
    const csvRows = data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          cell = `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    );
    return [csvHeaderLine, ...csvRows].join('\n');
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syncGoogleSheets = async () => {
    const scriptUrl = localStorage.getItem('google_sheets_sync_url');
    if (!scriptUrl) {
      setSyncStatus('configure');
      setTimeout(() => setSyncStatus(null), 5000);
      return;
    }

    setSyncStatus('syncing');
    try {
      const { ledgerRows, cashRows } = getReportData();

      const payload = {
        ledger: ledgerRows,
        cash: cashRows
      };

      // Call Google Apps Script Web App using raw fetch POST with no-cors to bypass CORS restrictions on redirect
      await fetch(scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
      });

      setSyncStatus('success');
    } catch (error) {
      console.error("Google Sheets sync failed:", error);
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus(null), 8000);
    }
  };

  /* ── Financial Metrics ─────────────────────────────────────────── */
  const active = invoices.filter(inv => inv.status !== 'Cancelled' && inv.status !== 'Refund');

  const totalReceivables = active.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid        = active.filter(i => i.isPaid).reduce((s, i) => s + (i.total || 0), 0);
  const totalPending     = active.filter(i => !i.isPaid).reduce((s, i) => s + (i.total || 0), 0);
  const vatPaid          = active.filter(i => i.isPaid).reduce((s, i) => s + (i.vat  || 0), 0);
  const vatPending       = active.filter(i => !i.isPaid).reduce((s, i) => s + (i.vat  || 0), 0);
  const collectionRate   = totalReceivables > 0 ? (totalPaid / totalReceivables) * 100 : 0;

  /* ── Page Metrics ──────────────────────────────────────────────── */
  const TOTAL_PAGES   = 92;
  const soldPages     = pages.filter(p => p.status === 'Reserved').length;
  const availPages    = pages.filter(p => p.status === 'Available').length;
  const soldPct       = (soldPages / TOTAL_PAGES) * 100;
  const targetPages   = TOTAL_PAGES;

  /* ── Customer Breakdown ────────────────────────────────────────── */
  const byCustomer = active.reduce((acc, inv) => {
    const name = inv.customerName || t('rp_unknown_customer');
    if (!acc[name]) acc[name] = { paid: 0, pending: 0, total: 0, count: 0 };
    acc[name].total   += inv.total || 0;
    acc[name].count   += 1;
    if (inv.isPaid) acc[name].paid    += inv.total || 0;
    else            acc[name].pending += inv.total || 0;
    return acc;
  }, {});

  const customerRows = Object.entries(byCustomer).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900">{t('fd_title')}</h2>
            <p className="text-sm text-gray-400">{t('fd_subtitle')}</p>
          </div>
        </div>

        {/* Buttons Action Group */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Open Google Sheets Link */}
            <a
              href="https://docs.google.com/spreadsheets/d/1BhC7XuASyIXW4PrCU1HOWOJ9rvWpaoCCfqVIr2XVAK0/edit"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all duration-200 cursor-pointer"
            >
              <BookOpen size={15} className="text-blue-500" />
              {t('fd_open_sheet')}
            </a>

            {/* Sync Button */}
            <button
              id="sync-google-sheets-btn"
              onClick={syncGoogleSheets}
              disabled={syncStatus === 'syncing'}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm ${
                syncStatus === 'syncing'
                  ? 'bg-slate-100 text-slate-400 cursor-wait'
                  : syncStatus === 'success'
                  ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md'
                  : syncStatus === 'error'
                  ? 'bg-red-500 text-white shadow-red-200 shadow-md'
                  : syncStatus === 'configure'
                  ? 'bg-amber-500 text-white shadow-amber-200 shadow-md font-bold'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200 shadow-md cursor-pointer'
              }`}
            >
              {syncStatus === 'syncing' ? (
                <><Loader2 size={15} className="animate-spin" /> {t('fd_syncing')}</>
              ) : syncStatus === 'success' ? (
                <><CheckCircle size={15} /> {t('fd_sync_success')}</>
              ) : syncStatus === 'error' ? (
                <><AlertCircle size={15} /> {t('fd_sync_error')}</>
              ) : syncStatus === 'configure' ? (
                <><AlertCircle size={15} /> Configurar URL</>
              ) : (
                <><Send size={15} /> {t('fd_sync_sheets')}</>
              )}
            </button>

            {/* View CSV Logs Button */}
            <button
              id="download-xls-btn"
              onClick={() => setIsLogModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-emerald-200 shadow-md transition-all duration-200 cursor-pointer"
            >
              <FileText size={15} />
              {t('fd_download_xls')}
            </button>
          </div>

          {/* Sync warning message */}
          {syncStatus === 'configure' && (
            <p className="text-xs font-semibold text-amber-500 text-right">
              {t('fd_sync_configure_first')}
            </p>
          )}

          {/* Daily Report Button */}
          <div className="flex flex-col items-end gap-1.5 mt-2 border-t border-slate-50 pt-2 w-full">
            <button
              id="send-daily-report-btn"
              onClick={sendDailyReport}
              disabled={reportStatus === 'sending'}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm ${
                reportStatus === 'sending'
                  ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                  : reportStatus === 'success'
                  ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-md'
                  : reportStatus === 'error'
                  ? 'bg-red-500 text-white shadow-red-200 shadow-md'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200 shadow-md'
              }`}
            >
              {reportStatus === 'sending' ? (
                <><Loader2 size={15} className="animate-spin" /> Enviando…</>
              ) : reportStatus === 'success' ? (
                <><CheckCircle size={15} /> ¡Enviado!</>
              ) : reportStatus === 'error' ? (
                <><AlertCircle size={15} /> Error</>
              ) : (
                <><Send size={15} /> Enviar Informe Ahora</>
              )}
            </button>

            {/* Status message */}
            {reportMsg && (
              <p className={`text-xs font-medium max-w-[260px] text-right ${
                reportStatus === 'success' ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {reportMsg}
              </p>
            )}

            {/* Auto-schedule notice */}
            <p className="flex items-center gap-1 text-xs text-gray-400">
              <Mail size={11} />
              Informe automático diario a las 23:00 → sbs.comite@gmail.com
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          icon={BarChart2}
          label={t('fd_total_receivables')}
          value={fmt(totalReceivables)}
          sub={`${active.length} ${t('fd_invoices')}`}
          color={{ bg: 'bg-indigo-50', icon: 'text-indigo-600', blob: 'bg-indigo-600' }}
        />
        <KpiCard
          icon={CheckCircle}
          label={t('fd_collected')}
          value={fmt(totalPaid)}
          sub={`${active.filter(i => i.isPaid).length} ${t('fd_invoices')}`}
          color={{ bg: 'bg-emerald-50', icon: 'text-emerald-600', blob: 'bg-emerald-600' }}
          trend={collectionRate}
        />
        <KpiCard
          icon={Clock}
          label={t('fd_outstanding')}
          value={fmt(totalPending)}
          sub={`${active.filter(i => !i.isPaid).length} ${t('fd_invoices')}`}
          color={{ bg: 'bg-amber-50', icon: 'text-amber-600', blob: 'bg-amber-400' }}
        />
        <KpiCard
          icon={Euro}
          label={t('fd_vat_collected')}
          value={fmt(vatPaid)}
          sub={t('fd_vat_21')}
          color={{ bg: 'bg-teal-50', icon: 'text-teal-600', blob: 'bg-teal-500' }}
        />
        <KpiCard
          icon={AlertCircle}
          label={t('fd_vat_pending')}
          value={fmt(vatPending)}
          sub={t('fd_vat_21')}
          color={{ bg: 'bg-rose-50', icon: 'text-rose-600', blob: 'bg-rose-500' }}
        />
      </div>

      {/* Page Sales Progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <BookOpen size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{t('fd_pages_title')}</h3>
              <p className="text-xs text-gray-400">{t('fd_pages_subtitle')}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-gray-900">{soldPages}</span>
            <span className="text-gray-400 font-medium"> / {targetPages}</span>
            <p className="text-xs text-gray-400 mt-0.5">{t('fd_pages_sold')}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${soldPct}%`,
              background: soldPct >= 80
                ? 'linear-gradient(90deg, #059669, #10b981)'
                : soldPct >= 50
                  ? 'linear-gradient(90deg, #2563eb, #6366f1)'
                  : 'linear-gradient(90deg, #f59e0b, #f97316)'
            }}
          />
          {/* Target marker */}
          <div className="absolute top-0 right-0 h-full w-0.5 bg-gray-300 opacity-60" style={{ right: '0%' }} />
        </div>

        {/* Progress labels */}
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-600 font-medium">{soldPages} {t('fd_pages_sold')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block" />
              <span className="text-gray-600 font-medium">{availPages} {t('fd_pages_available')}</span>
            </span>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            soldPct >= 80 ? 'bg-emerald-50 text-emerald-700'
            : soldPct >= 50 ? 'bg-blue-50 text-blue-700'
            : 'bg-amber-50 text-amber-700'
          }`}>
            {soldPct.toFixed(1)}% {t('fd_complete')}
          </span>
        </div>

        {/* Mini page grid indicator */}
        <div className="mt-5 pt-4 border-t border-gray-50">
          <p className="text-xs text-gray-400 mb-2">{t('fd_pages_grid_hint')}</p>
          <div className="flex flex-wrap gap-1">
            {pages.map((p) => (
              <div
                key={p.page_number}
                title={`Pág. ${p.page_number} — ${p.status === 'Reserved' ? t('fd_page_sold') : t('fd_page_available')}`}
                className={`w-4 h-4 rounded-sm transition-colors ${
                  p.status === 'Reserved' ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Collection Rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
          <p className="text-indigo-200 text-sm font-semibold uppercase tracking-wider">{t('fd_collection_rate')}</p>
          <p className="text-5xl font-black mt-2">{collectionRate.toFixed(1)}<span className="text-2xl">%</span></p>
          <div className="mt-4 bg-white/20 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${collectionRate}%` }} />
          </div>
          <p className="mt-3 text-indigo-200 text-sm">{fmt(totalPaid)} {t('fd_of')} {fmt(totalReceivables)}</p>
        </div>

        {/* Customer Breakdown */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-4">{t('fd_by_customer')}</h3>
          {customerRows.length === 0 ? (
            <div className="text-center py-8 text-gray-300">
              <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('fd_no_data')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {customerRows.map(([name, data]) => {
                const pct = data.total > 0 ? (data.paid / data.total) * 100 : 0;
                return (
                  <div key={name} className="group">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-sm font-semibold text-gray-800 truncate max-w-[55%]">{name}</span>
                      <div className="flex gap-3 text-xs shrink-0">
                        <span className="text-emerald-600 font-bold">{fmt(data.paid)}</span>
                        {data.pending > 0 && <span className="text-amber-600 font-bold">{fmt(data.pending)} {t('fd_pending_tag')}</span>}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      {/* CSV Logs Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 transition-all">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-4xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={22} />
                  {t('fd_log_modal_title')}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {t('fd_log_modal_subtitle')}
                </p>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs for different logs */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveLogTab('ledger');
                    setCopied(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLogTab === 'ledger'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t('fd_log_tab_ledger')}
                </button>
                <button
                  onClick={() => {
                    setActiveLogTab('cash');
                    setCopied(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLogTab === 'cash'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t('fd_log_tab_cash')}
                </button>
                <button
                  onClick={() => {
                    setActiveLogTab('event_logs');
                    setCopied(false);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeLogTab === 'event_logs'
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {language === 'es' ? 'Historial de Eventos' : 'Event History'}
                </button>
              </div>
            </div>

            {/* CSV / Content Container */}
            <div className="p-6 flex-1 overflow-hidden flex flex-col relative min-h-0">
              {activeLogTab === 'event_logs' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Filter and Download Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center mb-4 pb-2 px-1">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder={language === 'es' ? 'Buscar en historial (cliente, producto, factura...)...' : 'Search logs...'}
                        value={logSearchQuery}
                        onChange={(e) => setLogSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full text-sm bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(convertEventLogsToCsv((actionLogs || []).filter(log => {
                          if (!logSearchQuery) return true;
                          const q = logSearchQuery.toLowerCase();
                          return (
                            (log.action_type && log.action_type.toLowerCase().includes(q)) ||
                            (log.target_id && log.target_id.toLowerCase().includes(q)) ||
                            (log.customer_name && log.customer_name.toLowerCase().includes(q)) ||
                            (log.customer_email && log.customer_email.toLowerCase().includes(q)) ||
                            (log.customer_phone && log.customer_phone.toLowerCase().includes(q)) ||
                            (log.product_name && log.product_name.toLowerCase().includes(q)) ||
                            (log.payment_method && log.payment_method.toLowerCase().includes(q)) ||
                            (log.payment_status && log.payment_status.toLowerCase().includes(q))
                          );
                        })))}
                        className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                          copied
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer'
                        }`}
                      >
                        {copied ? (
                          <>
                            <Check size={14} />
                            {t('fd_log_copied')}
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            {language === 'es' ? 'Copiar CSV' : 'Copy CSV'}
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          const logsToDl = (actionLogs || []).filter(log => {
                            if (!logSearchQuery) return true;
                            const q = logSearchQuery.toLowerCase();
                            return (
                              (log.action_type && log.action_type.toLowerCase().includes(q)) ||
                              (log.target_id && log.target_id.toLowerCase().includes(q)) ||
                              (log.customer_name && log.customer_name.toLowerCase().includes(q)) ||
                              (log.customer_email && log.customer_email.toLowerCase().includes(q)) ||
                              (log.customer_phone && log.customer_phone.toLowerCase().includes(q)) ||
                              (log.product_name && log.product_name.toLowerCase().includes(q)) ||
                              (log.payment_method && log.payment_method.toLowerCase().includes(q)) ||
                              (log.payment_status && log.payment_status.toLowerCase().includes(q))
                            );
                          });
                          downloadCsv(convertEventLogsToCsv(logsToDl), `becerril_event_logs_${new Date().toISOString().slice(0,10)}.csv`);
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-indigo-600 shadow-sm cursor-pointer"
                      >
                        <FileText size={14} />
                        {language === 'es' ? 'Descargar CSV' : 'Download CSV'}
                      </button>
                    </div>
                  </div>

                  {/* Table container */}
                  <div className="flex-1 overflow-auto border border-slate-100 rounded-xl">
                    {(() => {
                      const filtered = (actionLogs || []).filter(log => {
                        if (!logSearchQuery) return true;
                        const q = logSearchQuery.toLowerCase();
                        return (
                          (log.action_type && log.action_type.toLowerCase().includes(q)) ||
                          (log.target_id && log.target_id.toLowerCase().includes(q)) ||
                          (log.customer_name && log.customer_name.toLowerCase().includes(q)) ||
                          (log.customer_email && log.customer_email.toLowerCase().includes(q)) ||
                          (log.customer_phone && log.customer_phone.toLowerCase().includes(q)) ||
                          (log.product_name && log.product_name.toLowerCase().includes(q)) ||
                          (log.payment_method && log.payment_method.toLowerCase().includes(q)) ||
                          (log.payment_status && log.payment_status.toLowerCase().includes(q))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-8 text-center text-slate-400 text-sm">
                            {language === 'es' ? 'No se encontraron registros de eventos.' : 'No event logs found.'}
                          </div>
                        );
                      }

                      return (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 tracking-wider uppercase sticky top-0 z-10">
                              <th className="p-3 font-bold">{language === 'es' ? 'Fecha/Hora' : 'Date/Time'}</th>
                              <th className="p-3 font-bold">{language === 'es' ? 'Acción' : 'Action'}</th>
                              <th className="p-3 font-bold">ID</th>
                              <th className="p-3 font-bold">{language === 'es' ? 'Cliente' : 'Customer'}</th>
                              <th className="p-3 font-bold">{language === 'es' ? 'Producto/Pág' : 'Product/Pg'}</th>
                              <th className="p-3 font-bold">Total</th>
                              <th className="p-3 font-bold text-center">{language === 'es' ? 'Detalle' : 'Detail'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filtered.map((row, idx) => {
                              const logRowId = row.id || `${row.created_at}-${idx}`;
                              const isExpanded = expandedLogId === logRowId;
                              return (
                                <React.Fragment key={logRowId}>
                                  <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 text-slate-500 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                                    <td className="p-3">
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(row.action_type)}`}>
                                        {translateActionType(row.action_type, language)}
                                      </span>
                                    </td>
                                    <td className="p-3 font-mono font-semibold text-slate-700">{row.target_id || '—'}</td>
                                    <td className="p-3">
                                      <div className="font-bold text-slate-800">{row.customer_name || '—'}</div>
                                      {(row.customer_email || row.customer_phone) && (
                                        <div className="text-[10px] text-slate-400 mt-0.5 flex flex-col gap-0.5">
                                          {row.customer_email && <span>{row.customer_email}</span>}
                                          {row.customer_phone && <span>{row.customer_phone}</span>}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3">
                                      <div className="text-slate-700">{row.product_name || '—'}</div>
                                      {row.page_number !== null && row.page_number !== undefined && (
                                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                          {language === 'es' ? 'Pág. ' : 'Pg. '}{row.page_number}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 font-semibold text-slate-900 tabular-nums">
                                      {row.total !== undefined ? `${fmt(row.total)}` : '—'}
                                      {row.payment_method && (
                                        <div className="text-[9px] text-slate-400 font-normal mt-0.5">
                                          {row.payment_method} · {row.payment_status || (row.is_paid ? 'Pagado' : 'Pendiente')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => setExpandedLogId(isExpanded ? null : logRowId)}
                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-semibold rounded text-[10px] cursor-pointer transition-all"
                                      >
                                        {isExpanded ? (language === 'es' ? 'Ocultar' : 'Hide') : (language === 'es' ? 'Ver' : 'Show')}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan="7" className="p-3 bg-slate-50/50">
                                        <div className="flex flex-col gap-1">
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            {language === 'es' ? 'Metadatos Completos del Evento (Respaldo de Seguridad):' : 'Complete Event Metadata (Safety Fallback):'}
                                          </div>
                                          <pre className="text-left bg-slate-900 text-slate-100 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-60 shadow-inner">
                                            {JSON.stringify(row.details && Object.keys(row.details).length > 0 ? row.details : row, null, 2)}
                                          </pre>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="relative flex-1 flex flex-col min-h-0">
                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(activeLogTab === 'ledger' ? convertToCsv(getReportData().ledgerRows) : convertToCsv(getReportData().cashRows))}
                    className={`absolute top-4 right-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 border shadow-sm ${
                      copied
                        ? 'bg-emerald-500 border-emerald-600 text-white animate-scale-in'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 cursor-pointer'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={14} />
                        {t('fd_log_copied')}
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        {t('fd_log_copy')}
                      </>
                    )}
                  </button>

                  <textarea
                    readOnly
                    className="w-full flex-1 min-h-[300px] font-mono text-xs p-6 pt-16 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 focus:outline-none resize-none overflow-auto"
                    value={activeLogTab === 'ledger' ? convertToCsv(getReportData().ledgerRows) : convertToCsv(getReportData().cashRows)}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm rounded-xl transition-all cursor-pointer"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default FinancialDashboard;
