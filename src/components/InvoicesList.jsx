import React, { useState, useEffect } from 'react';
import { getInvoices, cancelInvoice, updateInvoicePayment, hardDeleteInvoice } from '../utils/invoicesStore';
import { getFullPages } from '../utils/fallbackData';
import { FileText, Download, Receipt, Mail, MessageCircle, XCircle, Star, CheckCircle, Eye, X, Trash2, Search } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const InvoicesList = ({ onSelectPage }) => {
  const [invoices, setInvoices] = useState([]);
  const [renderingInvoice, setRenderingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load invoices on mount
    setInvoices(getInvoices());
  }, []);

  const generatePDF = (inv) => {
    setRenderingInvoice(inv);
    
    // Small delay to let the DOM update before capturing
    setTimeout(async () => {
      try {
        const element = document.getElementById('pdf-template');
        if (element) {
          const canvas = await html2canvas(element, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`Factura_${inv.id}.pdf`);
        }
      } catch (err) {
        console.error("Error generating PDF:", err);
        alert("Failed to generate PDF");
      } finally {
        setRenderingInvoice(null);
      }
    }, 100);
  };

  const getWhatsAppLink = (inv) => {
    const text = `Hola, adjuntamos la factura ${inv.id} correspondiente a su reserva (${inv.productName}).\n\nPor favor, revise el documento.\n\nNota: ${inv.artworkComment}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const getEmailLink = (inv) => {
    const subject = `Factura Reserva: ${inv.id}`;
    const body = `Hola,\n\nAdjuntamos la factura ${inv.id} correspondiente a su reserva de ${inv.productName}.\n\nNota importante sobre arte: ${inv.artworkComment}\n\nGracias,\nEquipo Abuela Ads`;
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleCancelInvoice = (inv) => {
    if (!window.confirm(`Are you absolutely sure you want to cancel invoice ${inv.id}? This will also delete the reservation from the magazine grid.`)) {
      return;
    }

    const shouldRefund = window.confirm("Do you want to generate a compensating invoice (Abono) for a money return?");
    
    // Update store
    cancelInvoice(inv.id, shouldRefund);
    
    // Remove from grid
    const pages = getFullPages();
    const page = pages.find(p => p.page_number === inv.assignedPage);
    if (page && page.ads) {
      const adIdx = page.ads.findIndex(a => a.customer_name === inv.customerName && a.ad_type === inv.productName);
      if (adIdx > -1) {
        page.ads.splice(adIdx, 1);
        if (page.ads.length === 0) page.status = 'Available';
      }
    }
    
    // Refresh list
    setInvoices(getInvoices());
  };

  const handleHardDelete = (inv) => {
    if (!window.confirm(`Are you sure you want to permanently delete invoice ${inv.id} and any associated refunds? This cannot be undone.`)) {
      return;
    }
    hardDeleteInvoice(inv.id);
    
    // Remove from grid
    const pages = getFullPages();
    const page = pages.find(p => p.page_number === inv.assignedPage);
    if (page && page.ads) {
      const adIdx = page.ads.findIndex(a => a.customer_name === inv.customerName && a.ad_type === inv.productName);
      if (adIdx > -1) {
        page.ads.splice(adIdx, 1);
        if (page.ads.length === 0) page.status = 'Available';
      }
    }
    
    setInvoices(getInvoices());
  };

  // Rest of code...

  const handleMarkAsPaid = (inv) => {
    if (!window.confirm(`Mark invoice ${inv.id} as paid?`)) return;
    
    // Update store
    updateInvoicePayment(inv.id, inv.paymentMethod || 'Transfer', true);
    
    // Update reservation
    const pages = getFullPages();
    const page = pages.find(p => p.page_number === inv.assignedPage);
    if (page && page.ads) {
      const ad = page.ads.find(a => a.customer_name === inv.customerName && a.ad_type === inv.productName);
      if (ad) {
        ad.isPaid = true;
      }
    }
    
    // Refresh list
    setInvoices(getInvoices());
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

  const renderInvoiceTemplate = (inv) => (
    <>
      <div className="border-b-2 border-gray-800 pb-4 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">INVOICE</h1>
          <p className="text-gray-500 mt-1">{inv.id}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-gray-800">Abuela Ads</h2>
          <p className="text-gray-500 text-sm">CIF: B12345678</p>
          <p className="text-gray-500 text-sm">Calle Mayor 1, Madrid</p>
        </div>
      </div>
      
      <div className="flex justify-between mb-12">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Billed To</h3>
          <p className="text-lg font-bold text-gray-900">{inv.customerName}</p>
        </div>
        <div className="text-right">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Date</h3>
          <p className="text-lg font-bold text-gray-900">{new Date(inv.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <table className="w-full mb-12">
        <thead>
          <tr className="border-b-2 border-gray-800 text-gray-800">
            <th className="text-left py-3 font-bold">Description</th>
            <th className="text-right py-3 font-bold">Base Price</th>
            {inv.designPrice > 0 && <th className="text-right py-3 font-bold">Design</th>}
            <th className="text-right py-3 font-bold">VAT (21%)</th>
            <th className="text-right py-3 font-bold">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-4">
              <div className="font-bold text-gray-900">{inv.productName}</div>
              <div className="text-sm text-gray-500">Page Assignment: Pg. {inv.assignedPage}</div>
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
            <span className="text-gray-600 font-medium">Subtotal</span>
            <span className="text-gray-900 font-medium">{inv.price.toFixed(2)}€</span>
          </div>
          {inv.designPrice > 0 && (
            <div className="flex justify-between py-2">
              <span className="text-gray-600 font-medium">Design Work</span>
              <span className="text-gray-900 font-medium">{inv.designPrice.toFixed(2)}€</span>
            </div>
          )}
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-600 font-medium">VAT (21%)</span>
            <span className="text-gray-900 font-medium">{inv.vat.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between py-3">
            <span className="text-xl font-bold text-gray-900">Total</span>
            <span className="text-xl font-bold text-blue-600">{inv.total.toFixed(2)}€</span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h4 className="font-bold text-gray-800 mb-2">Payment Status:</h4>
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
          <div>
            <span className="text-sm text-gray-500 block">Method</span>
            <span className="font-bold text-gray-900">{inv.paymentMethod}</span>
          </div>
          <div className="h-8 w-px bg-gray-300"></div>
          <div>
            <span className="text-sm text-gray-500 block">Status</span>
            <span className={`font-bold ${inv.isPaid ? 'text-green-600' : 'text-red-600'}`}>
              {inv.isPaid ? 'PAID' : 'PENDING'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h4 className="font-bold text-gray-800 mb-2">Important Information regarding Artwork:</h4>
        <p className="text-gray-600 bg-gray-50 p-4 rounded-lg">{inv.artworkComment}</p>
      </div>
    </>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-6xl mx-auto relative">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="text-blue-600" />
          Generated Invoices
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search invoices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <div className="flex gap-2 mr-4 border-r border-gray-200 pr-4">
            <button 
              onClick={() => setFilter('All')}
              className={`px-3 py-1.5 text-sm font-medium rounded ${filter === 'All' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter('Pending payment')}
              className={`px-3 py-1.5 text-sm font-medium rounded ${filter === 'Pending payment' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Pending payment
            </button>
          </div>
          <div className="flex gap-2 mr-4 border-r border-gray-200 pr-4">
            <button
              onClick={() => {
                const page = getFullPages().find(p => p.page_number === 91);
                if (onSelectPage) onSelectPage(page);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold rounded border border-orange-200 transition-colors"
            >
              <Star size={14} /> Book Pg. 91 (Int. Portada)
            </button>
            <button
              onClick={() => {
                const page = getFullPages().find(p => p.page_number === 92);
                if (onSelectPage) onSelectPage(page);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 text-xs font-bold rounded border border-orange-200 transition-colors"
            >
              <Star size={14} /> Book Pg. 92 (Contraportada)
            </button>
          </div>
          <span className="text-sm text-gray-500">{displayInvoices.length} active/cancelled</span>
        </div>
      </div>

      {displayInvoices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p>No invoices have been generated yet.</p>
          <p className="text-sm">Reserve a page to generate your first invoice.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="p-3 font-semibold rounded-tl-lg">Invoice ID</th>
                <th className="p-3 font-semibold">Date</th>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Payment</th>
                <th className="p-3 font-semibold">Total</th>
                <th className="p-3 font-semibold text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayInvoices.map((inv) => (
                <tr key={inv.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${inv.status === 'Cancelled' ? 'opacity-50' : ''}`}>
                  <td className="p-3">
                    <span className="font-mono text-sm text-blue-600 font-medium">{inv.id}</span>
                    {inv.status === 'Cancelled' && <span className="ml-2 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-red-100 text-red-800 rounded">Cancelled</span>}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{inv.customerName}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{inv.productName}</div>
                  </td>
                  <td className="p-3">
                    <div className={`text-xs font-bold px-2 py-1 rounded inline-block ${inv.isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                      {inv.isPaid ? 'Paid' : 'Pending'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{inv.paymentMethod}</div>
                  </td>
                  <td className="p-3 font-bold text-gray-900">
                    {inv.total.toFixed(2)}€
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
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
                      
                      <a 
                        href={getEmailLink(inv)} 
                        className={`p-2 rounded transition-colors ${inv.status === 'Cancelled' ? 'pointer-events-none opacity-50' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Send via Email"
                      >
                        <Mail size={18} />
                      </a>
                      
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden Off-Screen Invoice Template for PDF Rendering */}
      {renderingInvoice && (
        <div className="fixed top-[200vh] left-0 bg-white" style={{ width: '800px', padding: '40px' }} id="pdf-template">
          {renderInvoiceTemplate(renderingInvoice)}
        </div>
      )}

      {/* On-Screen Invoice Viewer Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-screen flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-lg">Invoice Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => { generatePDF(viewingInvoice); setViewingInvoice(null); }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Download size={16} /> Download PDF
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
    </div>
  );
};

export default InvoicesList;
