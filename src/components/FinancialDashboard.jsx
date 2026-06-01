import React, { useState, useEffect } from 'react';
import { getInvoices } from '../utils/invoicesStore';
import { getFullPages } from '../utils/fallbackData';
import { TrendingUp, CheckCircle, Clock, Euro, BookOpen, AlertCircle, BarChart2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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

const FinancialDashboard = () => {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState([]);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    setInvoices(getInvoices());
    setPages(getFullPages());
  }, []);

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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
          <TrendingUp size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-900">{t('fd_title')}</h2>
          <p className="text-sm text-gray-400">{t('fd_subtitle')}</p>
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
      </div>
    </div>
  );
};

export default FinancialDashboard;
