import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { getReciboWhatsAppMessage } from '../utils/invoicesStore';
import { FileText, Download, Receipt, Mail, MessageCircle, XCircle, CheckCircle, Eye, X, Trash2, Search, Settings } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useLanguage } from '../context/LanguageContext';

const InvoicesList = () => {
  const { t, language } = useLanguage();
  const {
    invoices,
    recibos,
    settings,
    cancelInvoice,
    updateInvoicePayment,
    hardDeleteInvoice,
    deleteRecibo,
    saveInvoiceSettings,
    reserveInvoiceNumber
  } = useDatabase();

  const [renderingInvoice, setRenderingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [activeSection, setActiveSection] = useState('invoices'); // 'invoices' | 'recibos'
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSettings, setConfigSettings] = useState({ isSequentialEnabled: true, nextInvoiceNumber: 3 });
  const [reserveNote, setReserveNote] = useState('');

  useEffect(() => {
    if (settings) {
      setConfigSettings(settings);
    }
  }, [settings]);

  const handleReserveInvoiceDirect = async () => {
    if (!settings?.isSequentialEnabled) {
      const seqMsg = language === 'es'
        ? "La numeración secuencial no está activada en la configuración."
        : "Sequential numbering is not enabled in settings.";
      alert(seqMsg);
      return;
    }

    const displayId = String(settings.nextInvoiceNumber).padStart(2, '0') + '_2601';
    const confirmMessage = language === 'es' 
      ? `¿Estás seguro de que quieres reservar el número de factura ${displayId} para uso externo?`
      : `Are you sure you want to reserve invoice number ${displayId} for external use?`;
      
    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await reserveInvoiceNumber("Número Factura reservada");
      if (res) {
        const successMessage = language === 'es'
          ? `Factura ${res.id} reservada correctamente.`
          : `Invoice ${res.id} reserved successfully.`;
        alert(successMessage);
      } else {
        alert("Failed to reserve invoice number.");
      }
    } catch (e) {
      console.error("Error reserving invoice directly:", e);
      alert("Error reserving invoice number: " + e.message);
    }
  };

  const generatePDF = (inv) => {
    setRenderingInvoice(inv);
    
    // Allow React to fully paint the hidden element before capturing
    setTimeout(async () => {
      try {
        const element = document.getElementById('pdf-template');
        if (!element) throw new Error('PDF template element not found in DOM');

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        pdf.save(`Factura_${inv.id}.pdf`);
      } catch (err) {
        console.error('Error al generar el PDF:', err);
        alert('Error al generar el PDF: ' + (err?.message || 'Error desconocido'));
      } finally {
        setRenderingInvoice(null);
      }
    }, 300);
  };


  const sendInvoiceEmail = async (inv) => {
    const email = window.prompt(`Introduce el correo del cliente para ${inv.customerName}:`);
    if (!email) return;

    setSendingEmailId(inv.id);
    setRenderingInvoice(inv);
    
    // Allow React to fully paint the hidden element before capturing
    setTimeout(async () => {
      try {
        const element = document.getElementById('pdf-template');
        if (element) {
          const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.85);
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
          
          const base64DataUri = pdf.output('datauristring');
          
          const apiUrl = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' ? 'http://localhost:3001/api/send-email' : '/api/send-email');
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              subject: `Factura Reserva: ${inv.id}`,
              text: `Hola,\n\nAdjuntamos la factura ${inv.id} correspondiente a su reserva de ${inv.productName}.\n\nNota importante sobre arte: ${inv.artworkComment}\n\nGracias,\nEquipo I AM YOUR GRANNY S.L.`,
              attachmentBase64: base64DataUri,
              attachmentName: `Factura_${inv.id}.pdf`
            })
          });
          
          const data = await response.json();
          if (data.success) {
            alert('Email sent successfully!');
          } else {
            alert('Failed to send email: ' + (data.error || 'Unknown error'));
          }
        }
      } catch (err) {
        console.error('Error al enviar email:', err);
        alert('Error al enviar el correo. Asegúrate de que el servidor esté activo.');
      } finally {
        setRenderingInvoice(null);
        setSendingEmailId(null);
      }
    }, 600);
  };

  const getWhatsAppLink = (inv) => {
    const text = `Hola, adjuntamos la factura ${inv.id} correspondiente a su reserva (${inv.productName}).\n\nPor favor, revise el documento.\n\nNota: ${inv.artworkComment}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const getEmailLink = (inv) => {
    const subject = `Factura Reserva: ${inv.id}`;
    const body = `Hola,\n\nAdjuntamos la factura ${inv.id} correspondiente a su reserva de ${inv.productName}.\n\nNota importante sobre arte: ${inv.artworkComment}\n\nGracias,\nEquipo I AM YOUR GRANNY S.L.`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCancelInvoice = async (inv) => {
    if (!window.confirm(`Are you absolutely sure you want to cancel invoice ${inv.id}? This will also delete the reservation from the magazine grid.`)) {
      return;
    }

    const shouldRefund = window.confirm("Do you want to generate a compensating invoice (Abono) for a money return?");
    await cancelInvoice(inv.id, shouldRefund);
  };

  const handleHardDelete = async (inv) => {
    if (!window.confirm(`Are you sure you want to permanently delete invoice ${inv.id} and any associated refunds? This cannot be undone.`)) {
      return;
    }
    await hardDeleteInvoice(inv.id);
  };

  const handleMarkAsPaid = async (inv) => {
    if (!window.confirm(`Mark invoice ${inv.id} as paid?`)) return;
    await updateInvoicePayment(inv.id, inv.paymentMethod || 'Transfer', true);
  };

  const handleDeleteRecibo = async (rec) => {
    if (!window.confirm(t('rp_confirm_delete') || 'Are you sure you want to delete this receipt?')) return;
    await deleteRecibo(rec.id);
  };


  const displayInvoices = invoices.filter(inv => {
    if (inv.status === 'Refund') return false;
    if (filter === 'Pending payment' && inv.isPaid) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchId = inv.id?.toLowerCase().includes(q);
      const matchCustomer = inv.customerName?.toLowerCase().includes(q);
      const matchProduct = inv.productName?.toLowerCase().includes(q);
      const matchPage = inv.assignedPage?.toString().includes(q);
      if (!matchId && !matchCustomer && !matchProduct && !matchPage) return false;
    }
    
    return true;
  });

  // ─── On-screen preview (Tailwind classes are fine here) ───────────────────
  const renderInvoiceTemplate = (inv) => (
    <>
      <div className="border-b-2 border-gray-800 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('inv_invoice')}</h1>
          <p className="text-gray-500 mt-1">{inv.id}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-gray-800">I AM YOUR GRANNY S.L.</h2>
          <p className="text-gray-500 text-sm">CIF: B72877640</p>
          <p className="text-gray-500 text-sm">Ctra. Guadarama-Cercedilla S/N</p>
          <p className="text-gray-500 text-sm">Portal 10 3C</p>
          <p className="text-gray-500 text-sm">28470 Cercedilla</p>
        </div>
      </div>
      
      <div className="flex justify-between mb-12">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">{t('inv_billed_to')}</h3>
          <p className="text-lg font-bold text-gray-900">{inv.customerName}</p>
        </div>
        <div className="text-right">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">{t('inv_date')}</h3>
          <p className="text-lg font-bold text-gray-900">{new Date(inv.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <table className="w-full mb-12">
        <thead>
          <tr className="border-b-2 border-gray-800 text-gray-800">
            <th className="text-left py-3 font-bold">{t('inv_desc')}</th>
            <th className="text-right py-3 font-bold">{t('inv_base_price')}</th>
            {inv.designPrice > 0 && <th className="text-right py-3 font-bold">{t('inv_design')}</th>}
            <th className="text-right py-3 font-bold">{t('inv_vat')}</th>
            <th className="text-right py-3 font-bold">{t('inv_total')}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-4">
              <div className="font-bold text-gray-900">{inv.productName}</div>
              <div className="text-sm text-gray-500">{t('inv_page_assignment')} {inv.assignedPage}</div>
            </td>
            <td className="text-right py-4 text-gray-700">{inv.price.toFixed(2)}€</td>
            {inv.designPrice > 0 && <td className="text-right py-4 text-gray-700">{inv.designPrice.toFixed(2)}€</td>}
            <td className="text-right py-4 text-gray-700">{inv.vat.toFixed(2)}€</td>
            <td className="text-right py-4 font-bold text-gray-900">{inv.total.toFixed(2)}€</td>
          </tr>
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-64">
          <div className="flex justify-between py-2">
            <span className="text-gray-600 font-medium">{t('inv_subtotal')}</span>
            <span className="text-gray-900 font-medium">{inv.price.toFixed(2)}€</span>
          </div>
          {inv.designPrice > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600 font-medium">{t('inv_design_work')}</span>
              <span className="text-gray-900 font-medium">{inv.designPrice.toFixed(2)}€</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">{t('inv_vat')}</span>
            <span className="text-gray-900 font-medium">{inv.vat.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-xl font-bold text-gray-900">{t('inv_total')}</span>
            <span className="text-xl font-bold text-blue-600">{inv.total.toFixed(2)}€</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h4 className="font-bold text-gray-800 mb-2">{t('inv_payment_status')}</h4>
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
          <div>
            <span className="text-sm text-gray-500 block">{t('inv_method')}</span>
            <span className="font-bold text-gray-900">{inv.paymentMethod}</span>
          </div>
          <div className="h-8 w-px bg-gray-300"></div>
          <div>
            <span className="text-sm text-gray-500 block">{t('inv_status')}</span>
            <span className={`font-bold ${inv.isPaid ? 'text-green-600' : 'text-red-600'}`}>
              {inv.isPaid ? t('inv_paid') : t('inv_pending')}
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h4 className="font-bold text-gray-800 mb-2">{t('inv_important_info')}</h4>
        <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{inv.artworkComment}</p>
      </div>
    </>
  );

  // ─── PDF-only template: ONLY inline styles with hex/rgb colors ─────────────
  // html2canvas cannot parse oklch() (used by Tailwind v4). No className allowed here.
  const renderPDFTemplate = (inv) => (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#111827', fontSize: '14px', lineHeight: '1.5' }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #1f2937', paddingBottom: '16px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-0.5px' }}>{t('inv_invoice')}</h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '13px' }}>{inv.id}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>I AM YOUR GRANNY S.L.</h2>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>CIF: B72877640</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>Ctra. Guadarama-Cercedilla S/N</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>Portal 10 3C</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '2px 0 0' }}>28470 Cercedilla</p>
        </div>
      </div>

      {/* Billed to / Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>{t('inv_billed_to')}</p>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>{inv.customerName}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '6px' }}>{t('inv_date')}</p>
          <p style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>{new Date(inv.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1f2937' }}>
            <th style={{ textAlign: 'left', padding: '10px 0', fontWeight: '700', color: '#1f2937' }}>{t('inv_desc')}</th>
            <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '700', color: '#1f2937' }}>{t('inv_base_price')}</th>
            {inv.designPrice > 0 && <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '700', color: '#1f2937' }}>{t('inv_design')}</th>}
            <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '700', color: '#1f2937' }}>{t('inv_vat')}</th>
            <th style={{ textAlign: 'right', padding: '10px 0', fontWeight: '700', color: '#1f2937' }}>{t('inv_total')}</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
            <td style={{ padding: '14px 0' }}>
              <div style={{ fontWeight: '700', color: '#111827' }}>{inv.productName}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{t('inv_page_assignment')} {inv.assignedPage}</div>
            </td>
            <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>{inv.price.toFixed(2)}€</td>
            {inv.designPrice > 0 && <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>{inv.designPrice.toFixed(2)}€</td>}
            <td style={{ textAlign: 'right', padding: '14px 0', color: '#374151' }}>{inv.vat.toFixed(2)}€</td>
            <td style={{ textAlign: 'right', padding: '14px 0', fontWeight: '700', color: '#111827' }}>{inv.total.toFixed(2)}€</td>
          </tr>
        </tbody>
      </table>

      {/* Totals summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '240px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: '#4b5563', fontWeight: '500' }}>{t('inv_subtotal')}</span>
            <span style={{ color: '#111827', fontWeight: '500' }}>{inv.price.toFixed(2)}€</span>
          </div>
          {inv.designPrice > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: '#4b5563', fontWeight: '500' }}>{t('inv_design_work')}</span>
              <span style={{ color: '#111827', fontWeight: '500' }}>{inv.designPrice.toFixed(2)}€</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#4b5563', fontWeight: '500' }}>{t('inv_vat')}</span>
            <span style={{ color: '#111827', fontWeight: '500' }}>{inv.vat.toFixed(2)}€</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>{t('inv_total')}</span>
            <span style={{ fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>{inv.total.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #e5e7eb' }}>
        <h4 style={{ fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>{t('inv_payment_status')}</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: '#f9fafb', padding: '14px', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>{t('inv_method')}</span>
            <span style={{ fontWeight: '700', color: '#111827' }}>{inv.paymentMethod}</span>
          </div>
          <div style={{ width: '1px', height: '32px', backgroundColor: '#d1d5db' }} />
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>{t('inv_status')}</span>
            <span style={{ fontWeight: '700', color: inv.isPaid ? '#16a34a' : '#dc2626' }}>
              {inv.isPaid ? t('inv_paid') : t('inv_pending')}
            </span>
          </div>
        </div>
      </div>

      {/* Artwork note */}
      <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #e5e7eb' }}>
        <h4 style={{ fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>{t('inv_important_info')}</h4>
        <p style={{ color: '#4b5563', backgroundColor: '#f9fafb', padding: '14px', borderRadius: '8px', margin: 0 }}>{inv.artworkComment}</p>
      </div>
    </div>
  );



  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-6 max-w-6xl mx-auto relative">
      <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Receipt className={activeSection === 'invoices' ? 'text-blue-600' : 'text-emerald-600'} />
            {activeSection === 'invoices' 
              ? t('il_title') 
              : `${t('il_recibos_title')} - Total: ${recibos.reduce((sum, r) => sum + r.total, 0).toFixed(2)}€`}
          </h2>
          {/* Section Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-auto mt-2 sm:mt-0">
            <button
              onClick={() => setActiveSection('invoices')}
              className={`flex-1 sm:flex-none px-3 py-1 text-sm font-medium rounded-md transition-colors text-center ${
                activeSection === 'invoices' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('il_title')}
            </button>
            <button
              onClick={() => setActiveSection('recibos')}
              className={`flex-1 sm:flex-none px-3 py-1 text-sm font-medium rounded-md transition-colors text-center ${
                activeSection === 'recibos' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('il_recibos_tab')} {recibos.length > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 text-xs font-bold">{recibos.length}</span>}
            </button>
          </div>
        </div>
        {activeSection === 'invoices' && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder={t('il_search_placeholder') || "Search invoices..."} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
              />
            </div>
            <div className="flex gap-2 justify-between md:justify-start">
              <button 
                onClick={() => setFilter('All')}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs sm:text-sm font-medium rounded text-center ${filter === 'All' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t('il_all') || 'All'}
              </button>
              <button 
                onClick={() => setFilter('Pending payment')}
                className={`flex-1 md:flex-none px-3 py-1.5 text-xs sm:text-sm font-medium rounded text-center ${filter === 'Pending payment' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {t('il_pending_payment_filter') || 'Pending payment'}
              </button>
            </div>

            <button
              onClick={handleReserveInvoiceDirect}
              title="Reservar Facturar"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded transition-colors cursor-pointer tracking-wide"
            >
              RF
            </button>

            <span className="text-xs text-gray-500 text-right md:text-left">{displayInvoices.length} {t('il_active_cancelled') || 'active/cancelled'}</span>
          </div>
        )}
      </div>

      {activeSection === 'invoices' && (
        displayInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>{t('il_no_invoices') || 'No invoices have been generated yet.'}</p>
            <p className="text-sm">{t('il_reserve_first') || 'Reserve a page to generate your first invoice.'}</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 font-semibold rounded-tl-lg">
                      <div className="flex items-center gap-1.5">
                        <span>{t('il_col_id') || 'Invoice ID'}</span>
                        <button
                          onClick={() => {
                            setConfigSettings(getInvoiceSettings());
                            setIsConfigOpen(true);
                          }}
                          className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                          title={t('config_title')}
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </th>
                    <th className="p-3 font-semibold">{t('il_col_date') || 'Date'}</th>
                    <th className="p-3 font-semibold">{t('il_col_customer') || 'Customer'}</th>
                    <th className="p-3 font-semibold">{t('il_col_payment') || 'Payment'}</th>
                    <th className="p-3 font-semibold">{t('il_col_total') || 'Total'}</th>
                    <th className="p-3 font-semibold text-right rounded-tr-lg">{t('il_col_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayInvoices.map((inv) => (
                    <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${inv.status === 'Cancelled' ? 'opacity-50' : ''} ${inv.status === 'Reserved' ? 'bg-slate-50/70 border-l-4 border-l-slate-400' : ''}`}>
                      <td className="p-3">
                        <span className="font-mono text-sm text-blue-600 font-medium">{inv.id}</span>
                        {inv.status === 'Cancelled' && <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-red-100 text-red-800 rounded">{t('il_status_cancelled') || 'Cancelled'}</span>}
                        {inv.status === 'Reserved' && <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-slate-200 text-slate-800 rounded">{t('il_status_reserved') || 'Reserved'}</span>}
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{inv.customerName === 'System User' ? t('system_user') : inv.customerName}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]">
                          {inv.assignedPage ? `P${inv.assignedPage} - ` : ''}
                          {inv.productName === 'Reserved ID' ? t('reserved_id_desc') : inv.productName}
                        </div>
                      </td>
                      <td className="p-3">
                        {inv.status === 'Reserved' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {t('il_status_reserved') || 'Reserved'}
                          </span>
                        ) : (
                          <>
                            <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${inv.isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                              {inv.isPaid ? (t('il_status_paid') || 'Paid') : (t('il_status_pending') || 'Pending')}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{t('rp_' + inv.paymentMethod?.toLowerCase()) || inv.paymentMethod}</div>
                          </>
                        )}
                      </td>
                      <td className="p-3 font-bold text-gray-900">
                        {inv.total.toFixed(2)}€
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          {inv.status === 'Reserved' ? (
                            <button 
                              onClick={() => handleHardDelete(inv)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors tooltip-wrapper cursor-pointer"
                              title={t('il_tooltip_hard_delete') || "Permanently Delete"}
                            >
                              <Trash2 size={18} />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => setViewingInvoice(inv)}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors tooltip-wrapper"
                                title="View Invoice"
                              >
                                <Eye size={18} />
                              </button>
                              
                              <button 
                                onClick={() => generatePDF(inv)}
                                disabled={renderingInvoice !== null}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors tooltip-wrapper"
                                title="Download PDF"
                              >
                                <Download size={18} />
                              </button>
                              
                              <button 
                                onClick={() => sendInvoiceEmail(inv)}
                                disabled={renderingInvoice !== null || sendingEmailId === inv.id}
                                className={`p-2 rounded transition-colors ${inv.status === 'Cancelled' ? 'pointer-events-none opacity-50' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'} ${sendingEmailId === inv.id ? 'animate-pulse text-blue-400' : ''}`}
                                title="Send via Email"
                              >
                                <Mail size={18} />
                              </button>
                              
                              <a 
                                href={getWhatsAppLink(inv)} 
                                target="_blank" rel="noreferrer"
                                className={`p-2 rounded transition-colors ${inv.status === 'Cancelled' ? 'pointer-events-none opacity-50' : 'text-gray-600 hover:text-green-600 hover:bg-green-50'}`}
                                title="Send via WhatsApp"
                              >
                                <MessageCircle size={18} />
                              </a>
                              
                              {inv.status !== 'Cancelled' && (
                                <>
                                  {!inv.isPaid && (
                                    <button 
                                      onClick={() => handleMarkAsPaid(inv)}
                                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors tooltip-wrapper"
                                      title="Mark as Paid"
                                    >
                                      <CheckCircle size={18} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleCancelInvoice(inv)}
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors tooltip-wrapper"
                                    title="Cancel Invoice"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </>
                              )}
                              {inv.status === 'Cancelled' && (
                                <button 
                                  onClick={() => handleHardDelete(inv)}
                                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors tooltip-wrapper"
                                  title="Permanently Delete Invoice & Refunds"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (hidden on md and larger) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {displayInvoices.map((inv) => (
                <div 
                  key={inv.id} 
                  className={`bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3 relative border-l-4 ${
                    inv.status === 'Cancelled' ? 'opacity-60 border-l-red-400' :
                    inv.status === 'Reserved' ? 'border-l-slate-400 bg-slate-50/40' :
                    inv.isPaid ? 'border-l-green-500' : 'border-l-orange-500'
                  }`}
                >
                  {/* Top row */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-sm text-blue-600 font-bold">{inv.id}</span>
                      {inv.status === 'Cancelled' && <span className="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold bg-red-100 text-red-800 rounded">{t('il_status_cancelled') || 'Cancelled'}</span>}
                      {inv.status === 'Reserved' && <span className="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold bg-slate-200 text-slate-800 rounded">{t('il_status_reserved') || 'Reserved'}</span>}
                    </div>
                    <span className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Customer details */}
                  <div className="text-sm">
                    <div className="font-bold text-gray-800">{inv.customerName === 'System User' ? t('system_user') : inv.customerName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {inv.assignedPage ? `P${inv.assignedPage} - ` : ''}
                      {inv.productName === 'Reserved ID' ? t('reserved_id_desc') : inv.productName}
                    </div>
                    <div className="text-xs text-blue-600 mt-1 font-semibold">{t('inv_page_assignment') || 'Page:'} {inv.assignedPage}</div>
                  </div>

                  {/* Payment status & Total */}
                  <div className="flex justify-between items-end bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">{t('il_col_payment') || 'Payment'}</span>
                      {inv.status === 'Reserved' ? (
                        <span className="text-xs font-bold text-slate-600">{t('il_status_reserved') || 'Reserved'}</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${inv.isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                            {inv.isPaid ? (t('il_status_paid') || 'Paid') : (t('il_status_pending') || 'Pending')}
                          </span>
                          <span className="text-[10px] text-gray-500">{t('rp_' + inv.paymentMethod?.toLowerCase()) || inv.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">{t('il_col_total') || 'Total'}</span>
                      <span className="text-lg font-black text-gray-800">{inv.total.toFixed(2)}€</span>
                    </div>
                  </div>

                  {/* Actions always visible */}
                  <div className="flex flex-wrap gap-1.5 justify-end border-t border-gray-100 pt-3 mt-1">
                    {inv.status === 'Reserved' ? (
                      <button 
                        onClick={() => handleHardDelete(inv)}
                        className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
                        title={t('il_tooltip_hard_delete')}
                      >
                        <Trash2 size={16} /> {t('delete') || 'Delete'}
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => setViewingInvoice(inv)}
                          className="p-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-lg transition-colors"
                          title="View Invoice"
                        >
                          <Eye size={16} />
                        </button>
                        
                        <button 
                          onClick={() => generatePDF(inv)}
                          disabled={renderingInvoice !== null}
                          className="p-2 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-lg transition-colors"
                          title="Download PDF"
                        >
                          <Download size={16} />
                        </button>
                        
                        <button 
                          onClick={() => sendInvoiceEmail(inv)}
                          disabled={renderingInvoice !== null || sendingEmailId === inv.id}
                          className={`p-2 bg-gray-50 rounded-lg transition-colors ${inv.status === 'Cancelled' ? 'pointer-events-none opacity-50' : 'hover:bg-blue-50 hover:text-blue-600 text-gray-600'} ${sendingEmailId === inv.id ? 'animate-pulse text-blue-400' : ''}`}
                          title="Send via Email"
                        >
                          <Mail size={16} />
                        </button>
                        
                        <a 
                          href={getWhatsAppLink(inv)} 
                          target="_blank" rel="noreferrer"
                          className={`p-2 bg-gray-50 rounded-lg transition-colors flex items-center justify-center ${inv.status === 'Cancelled' ? 'pointer-events-none opacity-50' : 'hover:bg-green-50 hover:text-green-600 text-gray-600'}`}
                          title="Send via WhatsApp"
                        >
                          <MessageCircle size={16} />
                        </a>
                        
                        {inv.status !== 'Cancelled' && (
                          <>
                            {!inv.isPaid && (
                              <button 
                                onClick={() => handleMarkAsPaid(inv)}
                                className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                                title="Mark as Paid"
                              >
                                <CheckCircle size={16} /> {t('il_status_paid') || 'Paid'}
                              </button>
                            )}
                            <button 
                              onClick={() => handleCancelInvoice(inv)}
                              className="p-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                              title="Cancel Invoice"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        {inv.status === 'Cancelled' && (
                          <button 
                            onClick={() => handleHardDelete(inv)}
                            className="p-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
                            title="Permanently Delete Invoice & Refunds"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* ─── Recibos Section ─── */}
      {activeSection === 'recibos' && (
        recibos.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>{t('il_recibos_empty')}</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-emerald-50 text-emerald-800 text-sm">
                    <th className="p-3 font-semibold rounded-tl-lg">{t('il_recibos_col_id')}</th>
                    <th className="p-3 font-semibold">{t('il_recibos_col_date')}</th>
                    <th className="p-3 font-semibold">{t('il_recibos_col_customer')}</th>
                    <th className="p-3 font-semibold">{t('il_recibos_col_product')}</th>
                    <th className="p-3 font-semibold">{t('il_recibos_col_total')}</th>
                    <th className="p-3 font-semibold text-right rounded-tr-lg">{t('il_recibos_col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recibos.map((rec) => (
                    <tr key={rec.id} className="border-b border-gray-50 hover:bg-emerald-50/30 transition-colors">
                      <td className="p-3">
                        <span className="font-mono text-sm text-emerald-700 font-medium">{rec.id}</span>
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-green-100 text-green-700 rounded">Efectivo</span>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{rec.customerName}</div>
                        <div className="text-xs text-gray-500">Pág. {rec.assignedPage}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-gray-700 max-w-[200px] truncate">{rec.productName}</div>
                      </td>
                      <td className="p-3 font-bold text-emerald-700">
                        {rec.total.toFixed(2)}€
                        <div className="text-xs text-gray-400 font-normal">sin IVA</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(getReciboWhatsAppMessage(rec))}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title={t('il_recibos_whatsapp')}
                          >
                            <MessageCircle size={18} />
                          </a>
                          <button
                            onClick={() => handleDeleteRecibo(rec)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title={t('il_recibos_delete')}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {recibos.length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50/50 border-t border-emerald-200 font-bold text-emerald-800">
                      <td className="p-3 font-bold" colSpan="4">Total</td>
                      <td className="p-3 text-base text-emerald-800 font-bold" colSpan="1">
                        {recibos.reduce((sum, r) => sum + r.total, 0).toFixed(2)}€
                        <div className="text-xs text-emerald-600/70 font-normal">sin IVA</div>
                      </td>
                      <td className="p-3" colSpan="1"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile Card List for Recibos (hidden on md and larger) */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {recibos.map((rec) => (
                <div key={rec.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3 relative border-l-4 border-l-emerald-500">
                  {/* Top row */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-sm text-emerald-700 font-bold">{rec.id}</span>
                      <span className="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold bg-green-100 text-green-700 rounded">Efectivo</span>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(rec.createdAt).toLocaleDateString()}</span>
                  </div>

                  {/* Content */}
                  <div className="text-sm">
                    <div className="font-bold text-gray-800">{rec.customerName}</div>
                    <div className="text-xs text-blue-600 font-semibold mt-0.5">Pág. {rec.assignedPage}</div>
                    <div className="text-xs text-gray-500 mt-1 max-w-[250px] truncate">{rec.productName}</div>
                  </div>

                  {/* Total and actions */}
                  <div className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-50 mt-1">
                    <div>
                      <span className="text-[10px] text-emerald-800/80 uppercase font-semibold block">{t('il_recibos_col_total')}</span>
                      <span className="text-lg font-black text-emerald-700">{rec.total.toFixed(2)}€</span>
                      <span className="text-[9px] text-gray-400 block -mt-1">sin IVA</span>
                    </div>
                    
                    <div className="flex gap-1.5">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(getReciboWhatsAppMessage(rec))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-100 rounded-lg transition-colors flex items-center justify-center"
                        title={t('il_recibos_whatsapp')}
                      >
                        <MessageCircle size={16} />
                      </a>
                      <button
                        onClick={() => handleDeleteRecibo(rec)}
                        className="p-2 bg-white text-red-600 hover:bg-red-50 border border-red-100 rounded-lg transition-colors flex items-center justify-center"
                        title={t('il_recibos_delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {recibos.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                  {t('il_recibos_empty')}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* Hidden Off-Screen Invoice Template for PDF Rendering */}
      {/* Positioned off-screen to the LEFT so html2canvas can reliably capture it */}
      {renderingInvoice && (
        <div
          id="pdf-template"
          style={{
            position: 'fixed',
            top: 0,
            left: '-10000px',
            width: '800px',
            padding: '40px',
            background: 'white',
            zIndex: -1,
          }}
        >
          {renderPDFTemplate(renderingInvoice)}
        </div>
      )}

      {/* On-Screen Invoice Viewer Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-screen flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-lg">{t('il_modal_title')}</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => sendInvoiceEmail(viewingInvoice)}
                  disabled={sendingEmailId === viewingInvoice.id}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Mail size={16} /> {sendingEmailId === viewingInvoice.id ? t('il_modal_sending') : t('il_modal_send_email')}
                </button>
                <button 
                  onClick={() => { generatePDF(viewingInvoice); setViewingInvoice(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Download size={16} /> {t('il_modal_download')}
                </button>
                <button 
                  onClick={() => setViewingInvoice(null)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-50 min-h-0">
              <div className="bg-white mx-auto shadow-sm" style={{ width: '800px', padding: '40px' }}>
                 {renderInvoiceTemplate(viewingInvoice)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoicing Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                <Settings size={18} className="text-gray-600" />
                {t('config_title')}
              </h3>
              <button 
                onClick={() => setIsConfigOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Toggle sequential */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{t('config_sequential')}</span>
                <button
                  type="button"
                  onClick={() => setConfigSettings(prev => ({ ...prev, isSequentialEnabled: !prev.isSequentialEnabled }))}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    configSettings.isSequentialEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      configSettings.isSequentialEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Next invoice number input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">{t('config_next_num')}</label>
                <input
                  type="number"
                  disabled={!configSettings.isSequentialEnabled}
                  value={configSettings.nextInvoiceNumber}
                  onChange={(e) => setConfigSettings(prev => ({ ...prev, nextInvoiceNumber: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>

              {/* Reserve Next ID section */}
              {configSettings.isSequentialEnabled && (
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">{t('config_reserve_note')}</label>
                  <input
                    type="text"
                    placeholder={t('config_reserve_note') + "..."}
                    value={reserveNote}
                    onChange={(e) => setReserveNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm mb-3"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!configSettings.nextInvoiceNumber) return;
                      const displayId = String(configSettings.nextInvoiceNumber).padStart(2, '0') + '_2601';
                      if (!window.confirm(`${t('config_reserve_btn')} (${displayId})?`)) return;
                      
                      // Save settings first so store knows the sequence
                      await saveInvoiceSettings(configSettings);
                      
                      // Reserve number
                      await reserveInvoiceNumber(reserveNote);
                      
                      // Reload store state
                      setReserveNote('');
                      alert('ID reserved successfully!');
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    {t('config_reserve_btn')} ({String(configSettings.nextInvoiceNumber).padStart(2, '0')}_2601)
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  saveInvoiceSettings(configSettings);
                  setIsConfigOpen(false);
                  alert('Settings saved successfully!');
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesList;
