import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { products } from '../utils/products';
import { useDatabase } from '../context/DatabaseContext';
import { CheckCircle, FileText, X, Trash2, CreditCard } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getProductAbbreviation } from '../utils/invoicesStore';
import { formatTemplate, getTemplateVariables, getHtmlEmailTemplate } from '../utils/notifications';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { parseAddressDetails } from '../utils/addressParser';

const getInvoiceWhatsAppMessage = (invoice, templates) => {
  const tObj = templates?.invoice_whatsapp;
  if (tObj && tObj.body) {
    const abbrev = getProductAbbreviation(invoice.productName);
    const vars = {
      id: invoice.id || '',
      customerName: invoice.customerName || '',
      productName: invoice.productName || '',
      assignedPage: invoice.assignedPage || '',
      total: invoice.total.toFixed(2),
      productAbbreviation: abbrev
    };
    return formatTemplate(tObj.body, vars);
  }
  const abbrev = getProductAbbreviation(invoice.productName);
  const amount = invoice.total.toFixed(2);
  return `Confirmación de pago y Factura Nro. ${invoice.id} – ${abbrev} – ${invoice.customerName} – ${amount}€`;
};

const getReciboWhatsAppMessageLocal = (recibo, templates) => {
  const tObj = templates?.recibo_whatsapp;
  if (tObj && tObj.body) {
    const abbrev = getProductAbbreviation(recibo.productName);
    const vars = {
      id: recibo.id || '',
      customerName: recibo.customerName || '',
      productName: recibo.productName || '',
      assignedPage: recibo.assignedPage || '',
      total: recibo.total.toFixed(2),
      productAbbreviation: abbrev
    };
    return formatTemplate(tObj.body, vars);
  }
  const abbrev = getProductAbbreviation(recibo.productName);
  const amount = recibo.total.toFixed(2);
  return `Recibí, pago a cuenta – ${abbrev} – ${recibo.customerName} – ${amount}€`;
};

const getOrderWhatsAppMessage = (order, language, templates) => {
  const isEs = language === 'es';
  const statusTxt = order.orderType === 'pre-reserved'
    ? (isEs ? 'Pre-reserva (temporal 1 semana)' : 'Pre-reservation (1-week hold)')
    : (isEs ? 'Reserva (Transferencia pendiente)' : 'Reservation (Pending Transfer)');
  
  const templateId = order.orderType === 'pre-reserved' ? 'order_prereservation_whatsapp' : 'order_reservation_whatsapp';
  const tObj = templates?.[templateId];
  if (tObj && tObj.body) {
    const vars = getTemplateVariables(order, language);
    return formatTemplate(tObj.body, vars);
  }
  
  const total = ((order.price + order.designPrice) * 1.21).toFixed(2);
  
  return isEs
    ? `Confirmación de ${statusTxt} - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n` +
      `- Cliente: ${order.customerName}\n` +
      `- Producto: ${order.productName}\n` +
      `- Pág. Asignada: ${order.assignedPage}\n` +
      `- Subtotal: ${(order.price + order.designPrice).toFixed(2)}€\n` +
      `- Total (con IVA): ${total}€\n\n` +
      `Gracias,\nEquipo de Coordinación Publicitaria`
    : `Confirmation of ${statusTxt} - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n` +
      `- Customer: ${order.customerName}\n` +
      `- Product: ${order.productName}\n` +
      `- Assigned Page: ${order.assignedPage}\n` +
      `- Subtotal: ${(order.price + order.designPrice).toFixed(2)}€\n` +
      `- Total (with VAT): ${total}€\n\n` +
      `Thank you,\nRevista de Fiestas Patronales Becerril de la Sierra 2026 Team`;
};

// Helper: insert a customer, falling back to core fields if schema cache is stale
const safeInsertCustomer = async (payload) => {
  const cleanData = {
    fiscal_name: payload.fiscal_name || '',
    commercial_name: payload.commercial_name || '',
    nif: payload.nif || '',
    category: payload.category || '',
    address: payload.address || '',
    email: payload.email || '',
    whatsapp: payload.whatsapp || '',
    last_year_product: payload.last_year_product || ''
  };

  const { data, error } = await supabase.from('customers').insert([cleanData]).select();
  if (error && error.message && error.message.includes('schema cache')) {
    // Schema cache stale — retry with only the original guaranteed columns
    const corePayload = {
      fiscal_name: payload.fiscal_name,
      commercial_name: payload.commercial_name,
      nif: payload.nif,
      email: payload.email,
      last_year_product: payload.last_year_product
    };
    return await supabase.from('customers').insert([corePayload]).select();
  }
  return { data, error };
};


const ReservationPanel = ({ selectedPage, onReservationComplete, onCancel }) => {
  const { t, language } = useLanguage();
  const {
    pages,
    invoices,
    recibos,
    orders,
    templates,
    addInvoice,
    addInvoiceWithReservation,
    updateInvoicePayment,
    deleteInvoice,
    addRecibo,
    addOrder,
    deleteOrder,
    updateOrder,
    confirmOrderPayment,
    deleteAdReservationDirect,
    resolvePreReservation,
    logAction
  } = useDatabase();
  const [customers, setCustomers] = useState([]);
  const [usedProducts, setUsedProducts] = useState(new Set());
  
  const savedPageNum = localStorage.getItem('rp_page_number');
  const isSamePage = savedPageNum === String(selectedPage?.page_number);

  const [selectedCustomerId, setSelectedCustomerId] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_selectedCustomerId') || '') : '';
  });
  const [selectedProductId, setSelectedProductId] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_selectedProductId') || '') : '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [renderingInvoice, setRenderingInvoice] = useState(null);
  
  const [isAddingNew, setIsAddingNew] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_isAddingNew') === 'true') : false;
  });
  const [newCustomer, setNewCustomer] = useState(() => {
    const saved = isSamePage ? localStorage.getItem('rp_newCustomer') : null;
    return saved ? JSON.parse(saved) : { 
      fiscal_name: '', 
      commercial_name: '', 
      nif: '', 
      contact_name: '',
      email: '', 
      whatsapp: '',
      address: '',
      category: '',
      last_year_product: ''
    };
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_isEditingExisting') === 'true') : false;
  });
  const [editedCustomer, setEditedCustomer] = useState(() => {
    const saved = isSamePage ? localStorage.getItem('rp_editedCustomer') : null;
    return saved ? JSON.parse(saved) : {
      fiscal_name: '',
      commercial_name: '',
      nif: '',
      contact_name: '',
      email: '',
      whatsapp: '',
      address: '',
      category: '',
      last_year_product: ''
    };
  });

  const [assignmentPref, setAssignmentPref] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_assignmentPref') || 'aleatorio') : 'aleatorio';
  });
  
  // Never restore confirmation modals from localStorage — they open only via user actions,
  // which also reset emailStatus. Restoring open=true would skip the status reset
  // and block the auto-send (emailStatus.status would not be null).
  const [invoiceModalOpen, setInvoiceModalOpenRaw] = useState(false);
  const setInvoiceModalOpen = (val) => {
    setInvoiceModalOpenRaw(val);
    localStorage.setItem('invoiceModalOpen', val);
  };

  const [invoiceDetails, setInvoiceDetailsRaw] = useState(() => {
    const saved = localStorage.getItem('invoiceDetails');
    return saved ? JSON.parse(saved) : null;
  });
  const setInvoiceDetails = (val) => {
    setInvoiceDetailsRaw(val);
    if (val) localStorage.setItem('invoiceDetails', JSON.stringify(val));
    else localStorage.removeItem('invoiceDetails');
  };

  const [efectivoPreviewOpen, setEfectivoPreviewOpenRaw] = useState(false);
  const setEfectivoPreviewOpen = (val) => {
    setEfectivoPreviewOpenRaw(val);
    localStorage.setItem('efectivoPreviewOpen', val);
  };
  
  const [paymentMethod, setPaymentMethod] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_paymentMethod') || 'Transfer') : 'Transfer';
  });
  const [reservationPaymentMethod, setReservationPaymentMethod] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_reservationPaymentMethod') || 'Transfer') : 'Transfer';
  });
  const [isPaid, setIsPaid] = useState(false);
  const [currentAdRef, setCurrentAdRef] = useState(null);
  
  const [artworkOption, setArtworkOption] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_artworkOption') || '') : '';
  });
  const [designWorkOption, setDesignWorkOption] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_designWorkOption') || '') : '';
  });
  const [designWorkPrice, setDesignWorkPrice] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_designWorkPrice') || '') : '';
  });

  // Recibo state
  const [reciboModalOpen, setReciboModalOpenRaw] = useState(false);
  const setReciboModalOpen = (val) => {
    setReciboModalOpenRaw(val);
    localStorage.setItem('reciboModalOpen', val);
  };

  const [reciboDetails, setReciboDetailsRaw] = useState(() => {
    const saved = localStorage.getItem('reciboDetails');
    return saved ? JSON.parse(saved) : null;
  });
  const setReciboDetails = (val) => {
    setReciboDetailsRaw(val);
    if (val) localStorage.setItem('reciboDetails', JSON.stringify(val));
    else localStorage.removeItem('reciboDetails');
  };

  // Order (pending — not yet invoiced) state
  const [orderConfirmModalOpen, setOrderConfirmModalOpenRaw] = useState(false);
  const setOrderConfirmModalOpen = (val) => {
    setOrderConfirmModalOpenRaw(val);
    localStorage.setItem('orderConfirmModalOpen', val);
  };

  const [orderDetails, setOrderDetailsRaw] = useState(() => {
    const saved = localStorage.getItem('orderDetails');
    return saved ? JSON.parse(saved) : null;
  });
  const setOrderDetails = (val) => {
    setOrderDetailsRaw(val);
    if (val) localStorage.setItem('orderDetails', JSON.stringify(val));
    else localStorage.removeItem('orderDetails');
  };

  // Customer dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [sentEmailAddress, setSentEmailAddress] = useState('');
  const [emailStatus, setEmailStatus] = useState({ sending: false, status: null, error: '' });
  const dropdownRef = useRef(null);

  // Pre-billing state (pre-reservation confirmation)
  const [preBillingModalOpen, setPreBillingModalOpen] = useState(false);
  const [preBillingAd, setPreBillingAd] = useState(null);
  const [preBillingIndex, setPreBillingIndex] = useState(null);

  const [activeViewMode, setActiveViewMode] = useState(() => {
    return isSamePage ? (localStorage.getItem('rp_activeViewMode') || null) : null;
  }); // 'select_mode', 'process_clients', 'new_reservation'

  // Once activeViewMode is established (restored from storage or set by user action),
  // we lock it so that Supabase re-fetches triggering usedProducts/pages updates
  // cannot overwrite the user's current position in the reservation flow.
  // The lock is cleared only when the user explicitly navigates to a new page.
  const viewModeLocked = React.useRef(isSamePage && !!localStorage.getItem('rp_activeViewMode'));

  const setActiveViewModeAndLock = (mode) => {
    viewModeLocked.current = true;
    setActiveViewMode(mode);
  };

  const [selectedAdIndex, setSelectedAdIndex] = useState(null);
  const [closeSalePaymentMethod, setCloseSalePaymentMethod] = useState('Transfer');

  const [graphicalSelectedSlot, setGraphicalSelectedSlot] = useState(null);
  const [collapsedPreview, setCollapsedPreview] = useState(false);
  const [hoveredLayoutSlots, setHoveredLayoutSlots] = useState([]);

  // Save drafts to localStorage whenever they change
  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_selectedCustomerId', selectedCustomerId);
    }
  }, [selectedCustomerId, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_selectedProductId', selectedProductId);
    }
  }, [selectedProductId, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_isAddingNew', isAddingNew);
    }
  }, [isAddingNew, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_newCustomer', JSON.stringify(newCustomer));
    }
  }, [newCustomer, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_isEditingExisting', isEditingExisting);
    }
  }, [isEditingExisting, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_editedCustomer', JSON.stringify(editedCustomer));
    }
  }, [editedCustomer, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_assignmentPref', assignmentPref);
    }
  }, [assignmentPref, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_paymentMethod', paymentMethod);
    }
  }, [paymentMethod, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_reservationPaymentMethod', reservationPaymentMethod);
    }
  }, [reservationPaymentMethod, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_artworkOption', artworkOption);
    }
  }, [artworkOption, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_designWorkOption', designWorkOption);
    }
  }, [designWorkOption, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      localStorage.setItem('rp_designWorkPrice', designWorkPrice);
    }
  }, [designWorkPrice, selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      if (activeViewMode) {
        localStorage.setItem('rp_activeViewMode', activeViewMode);
      } else {
        localStorage.removeItem('rp_activeViewMode');
      }
    }
  }, [activeViewMode, selectedPage]);

  useEffect(() => {
    if (!dropdownOpen) {
      setCustomerSearchQuery('');
    }
  }, [dropdownOpen]);

  // Reset preview collapse and selection when selectedPage changes
  useEffect(() => {
    setCollapsedPreview(false);
    setGraphicalSelectedSlot(null);
    setHoveredLayoutSlots([]);
  }, [selectedPage]);

  // Sync selectedProductId to graphicalSelectedSlot
  useEffect(() => {
    if (selectedProductId) {
      const id = parseInt(selectedProductId);
      if (id === 5) setGraphicalSelectedSlot('top');
      else if (id === 6) setGraphicalSelectedSlot('middle');
      else if (id === 7) setGraphicalSelectedSlot('bottom');
      else if (id === 8) setGraphicalSelectedSlot('top_middle');
      else if (id === 9) setGraphicalSelectedSlot('middle_bottom');
      else {
        const prod = products.find(p => p.id === id);
        if (prod) {
          if (prod.requiredSlots.length === 3) {
            setGraphicalSelectedSlot('full');
          } else if (prod.requiredSlots.includes('any_1')) {
            if (!['top', 'middle', 'bottom'].includes(graphicalSelectedSlot)) {
              setGraphicalSelectedSlot(null);
            }
          } else {
            setGraphicalSelectedSlot(null);
          }
        } else {
          setGraphicalSelectedSlot(null);
        }
      }
    } else {
      setGraphicalSelectedSlot(null);
    }
  }, [selectedProductId]);


  const getEmailHtml = (title, content) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 32px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 700;
            margin: 0;
          }
          .content {
            padding: 32px;
            color: #334155;
            line-height: 1.6;
            font-size: 15px;
          }
          .content p {
            margin-top: 0;
            margin-bottom: 16px;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 24px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0; color:#ffffff;">Revista de Fiestas Patronales Becerril de la Sierra 2026</h1>
          </div>
          <div class="content">
            <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">${title}</h2>
            ${content}
          </div>
          <div class="footer">
            <p style="margin:0;">Este es un correo automático de Revista de Fiestas Patronales Becerril de la Sierra 2026.</p>
            <p style="margin:4px 0 0 0;">I am your granny S.L. &bull; &copy; 2026 Revista de Fiestas Patronales Becerril de la Sierra 2026. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const getFormattedHtmlContent = (bodyText) => {
    const clean = bodyText.replace(/\\n/g, '\n');
    const lines = clean.split('\n');
    let html = '';
    let inList = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        if (!inList) {
          html += '<ul style="margin: 16px 0; padding-left: 20px; color: #334155; font-size: 15px; line-height: 1.6;">';
          inList = true;
        }
        const itemText = trimmed.substring(2);
        const parts = itemText.split(':');
        if (parts.length > 1) {
          const label = parts[0];
          const value = parts.slice(1).join(':');
          html += `<li style="margin-bottom: 8px;"><strong>${label}:</strong>${value}</li>`;
        } else {
          html += `<li style="margin-bottom: 8px;">${itemText}</li>`;
        }
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (trimmed) {
          if (trimmed.toLowerCase().includes('nota:') || trimmed.toLowerCase().includes('importante:')) {
            html += `<p style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; color: #c2410c; border-radius: 6px; font-weight: 500; margin: 16px 0;">${trimmed}</p>`;
          } else {
            html += `<p style="margin-bottom: 16px;">${trimmed}</p>`;
          }
        } else {
          html += '<div style="height: 8px;"></div>';
        }
      }
    });

    if (inList) {
      html += '</ul>';
    }
    return html;
  };

  const handleSendEmail = async (details, isPreReservation, isRecibo = false, isInvoice = false) => {
    const to = details.customerEmail;
    if (!to) {
      alert(language === 'es' ? 'No hay correo electrónico registrado para este cliente' : 'No email address registered for this customer');
      return;
    }

    setEmailStatus({ sending: true, status: 'sending', error: '' });

    if (isInvoice) {
      setRenderingInvoice(details);
      
      // Allow React to fully paint the hidden element before capturing
      setTimeout(async () => {
        try {
          const element = document.getElementById('pdf-template');
          if (!element) throw new Error('PDF template element not found in DOM');

          const canvas = await html2canvas(element, {
            scale: 1.5,
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
          
          const invoiceTemplate = templates?.invoice_email;
          const vars = getTemplateVariables(details, language);
          
          const subject = invoiceTemplate?.subject 
            ? formatTemplate(invoiceTemplate.subject, vars) 
            : `Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. ${details.id}`;
            
          const text = invoiceTemplate?.body 
            ? formatTemplate(invoiceTemplate.body, vars) 
            : `Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: ${details.id}\n- Producto: ${details.productName}\n- Página Asignada: ${details.assignedPage}\n- Método de Pago: ${details.paymentMethod || 'Transfer'}\n- Precio Base: ${details.price.toFixed(2)}€\n${details.designPrice > 0 ? `- Precio Diseño: ${details.designPrice.toFixed(2)}€\n` : ''}- Subtotal: ${(details.price + details.designPrice).toFixed(2)}€\n- IVA (21%): ${details.vat.toFixed(2)}€\n- Total Pagado: ${details.total.toFixed(2)}€\n\nGracias,\nEquipo de Coordinación Publicitaria`;

          const cleanSubject = subject.replace(/\\n/g, ' ');
          const cleanText = text.replace(/\\n/g, '\n');
          const html = getEmailHtml(cleanSubject, getFormattedHtmlContent(text));

          const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to,
              subject: cleanSubject,
              text: cleanText,
              html,
              attachmentBase64: base64DataUri,
              attachmentName: `Factura_${details.id}.pdf`,
              background: true
            })
          });
          
          const data = await response.json();
          if (data.success) {
            setEmailStatus({ sending: false, status: 'success', error: '' });
            logAction(
              'send_invoice_email',
              details.id || '',
              details.customerName || details.customer_name || '',
              details.productName || details.ad_type || '',
              details.assignedPage || details.page_number || null,
              details.price || 0,
              details.designPrice || details.design_work_price || 0,
              details.vat || 0,
              details.total || 0,
              details.paymentMethod || details.payment_method || '',
              details.isPaid || details.is_paid || false,
              { to, subject: cleanSubject }
            );
          } else {
            setEmailStatus({ sending: false, status: 'error', error: data.error || 'Failed to send' });
          }
        } catch (err) {
          console.error('Error al enviar email con factura PDF:', err);
          setEmailStatus({ sending: false, status: 'error', error: err.message });
        } finally {
          setRenderingInvoice(null);
        }
      }, 600);
    } else {
      try {
        let subject = '';
        let text = '';
        
        const vars = getTemplateVariables(details, language);
        let templateId = 'order_reservation_email';
        if (isRecibo) templateId = 'recibo_email';
        else if (isPreReservation) templateId = 'order_prereservation_email';

        const tObj = templates?.[templateId];
        if (tObj) {
          subject = formatTemplate(tObj.subject, vars);
          text = formatTemplate(tObj.body, vars);
        } else {
          if (isRecibo) {
            subject = `Recibo de Pago Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. ${details.assignedPage}`;
            text = `Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: ${details.productName}\n- Página Asignada: ${details.assignedPage}\n- Precio Base: ${details.price.toFixed(2)}€\n${details.designPrice > 0 ? `- Precio Diseño: ${details.designPrice.toFixed(2)}€\n` : ''}- Recibo: ${details.total.toFixed(2)}€\n\nGracias,\nEquipo de Coordinación Publicitaria`;
          } else {
            subject = isPreReservation
              ? `Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. ${details.assignedPage}`
              : `Confirmación de Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. ${details.assignedPage}`;
            text = isPreReservation
              ? `Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: ${details.productName}\n- Página Asignada: ${details.assignedPage}\n- Comentarios de Arte/Diseño: ${details.artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFERENCIA PAGO: ${details.productName}\n\nGracias,\nEquipo de Coordinación Publicitaria`
              : `Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: ${details.productName}\n- Página Asignada: ${details.assignedPage}\n- Método de Pago: ${t('rp_' + details.paymentMethod.toLowerCase()) || details.paymentMethod}\n- Comentarios de Arte/Diseño: ${details.artworkComment}\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFEFERENCIA PAGO: ${details.productName}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
          }
        }

        const cleanSubject = subject.replace(/\\n/g, ' ');
        const cleanText = text.replace(/\\n/g, '\n');
        const html = getEmailHtml(cleanSubject, getFormattedHtmlContent(text));

        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject: cleanSubject, text: cleanText, html, background: true })
        });
        const data = await response.json();
        if (data.success) {
          setEmailStatus({ sending: false, status: 'success', error: '' });
          
          let logActionType = 'send_reservation_email';
          if (isRecibo) logActionType = 'send_recibo_email';
          else if (isPreReservation) logActionType = 'send_prereservation_email';

          logAction(
            logActionType,
            details.id || details.page_number?.toString() || '',
            details.customerName || details.customer_name || '',
            details.productName || details.ad_type || '',
            details.assignedPage || details.page_number || null,
            details.price || 0,
            details.designPrice || details.design_work_price || 0,
            details.vat || 0,
            details.total || 0,
            details.paymentMethod || details.payment_method || '',
            details.isPaid || details.is_paid || false,
            { to, subject: cleanSubject }
          );
        } else {
          setEmailStatus({ sending: false, status: 'error', error: data.error || 'Failed to send' });
        }
      } catch (err) {
        console.error(err);
        setEmailStatus({ sending: false, status: 'error', error: err.message });
      }
    }
  };

  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== 'new') {
      const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
      if (cust) {
        setEditedCustomer({
          fiscal_name: cust.fiscal_name || '',
          commercial_name: cust.commercial_name || '',
          nif: cust.nif || '',
          contact_name: cust.contact_name || '',
          email: cust.email || '',
          whatsapp: cust.whatsapp || '',
          address: cust.address || '',
          category: cust.category || '',
          last_year_product: cust.last_year_product || ''
        });
      }
    } else {
      setIsEditingExisting(false);
    }
  }, [selectedCustomerId, customers]);

  const filteredCustomers = customers.filter(c => {
    const query = customerSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (c.commercial_name || '').toLowerCase().includes(query) ||
      (c.fiscal_name || '').toLowerCase().includes(query) ||
      (c.contact_name || '').toLowerCase().includes(query) ||
      (c.category || '').toLowerCase().includes(query) ||
      (c.nif || '').toLowerCase().includes(query) ||
      (c.whatsapp || '').toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.address || '').toLowerCase().includes(query) ||
      (c.last_year_product || '').toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase.from('customers').select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          setCustomers(data);
        } else {
          setCustomers(fallbackCustomers);
        }
      } catch (err) {
        setCustomers(fallbackCustomers);
      }
    };

    const checkUsedProducts = () => {
      const used = new Set();
      pages.forEach(p => {
        if (p.ads) {
          p.ads.forEach(ad => {
            const prod = products.find(prod => prod.name === ad.ad_type);
            if (prod && prod.exclusive) {
              used.add(prod.id);
            }
          });
        }
      });
      setUsedProducts(used);
    };

    fetchCustomers();
    checkUsedProducts();
  }, [selectedPage, pages]);

  useEffect(() => {
    if (selectedPage) {
      const savedPageNum = localStorage.getItem('rp_page_number');
      if (savedPageNum !== String(selectedPage.page_number)) {
        // Different page selected, reset all inputs
        setSelectedProductId('');
        setSelectedCustomerId('');
        setIsAddingNew(false);
        setSentEmailAddress('');
        setSelectedAdIndex(null);
        setCloseSalePaymentMethod('Transfer');
        
        // Update stored page number and clear draft storage
        localStorage.setItem('rp_page_number', String(selectedPage.page_number));
        localStorage.removeItem('rp_selectedCustomerId');
        localStorage.removeItem('rp_selectedProductId');
        localStorage.removeItem('rp_isAddingNew');
        localStorage.removeItem('rp_newCustomer');
        localStorage.removeItem('rp_isEditingExisting');
        localStorage.removeItem('rp_editedCustomer');
        localStorage.removeItem('rp_artworkOption');
        localStorage.removeItem('rp_designWorkOption');
        localStorage.removeItem('rp_designWorkPrice');
        localStorage.removeItem('rp_activeViewMode');
        localStorage.removeItem('rp_assignmentPref');
        localStorage.removeItem('rp_paymentMethod');
        localStorage.removeItem('rp_reservationPaymentMethod');
        // Clear the view-mode lock so the auto-calculator runs fresh for the new page
        viewModeLocked.current = false;
      }
    }
  }, [selectedPage]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Automatically send email on order confirmation modal open
  useEffect(() => {
    if (orderConfirmModalOpen && orderDetails && orderDetails.customerEmail) {
      if (emailStatus.status === null && !emailStatus.sending) {
        handleSendEmail(orderDetails, orderDetails.orderType === 'pre-reserved', false);
      }
    }
  }, [orderConfirmModalOpen, orderDetails, emailStatus]);

  // Automatically send email on recibo modal open
  useEffect(() => {
    if (reciboModalOpen && reciboDetails && reciboDetails.customerEmail) {
      if (emailStatus.status === null && !emailStatus.sending) {
        handleSendEmail(reciboDetails, false, true);
      }
    }
  }, [reciboModalOpen, reciboDetails, emailStatus]);

  // Automatically send email on invoice modal open (exclude preview mode)
  useEffect(() => {
    if (invoiceModalOpen && invoiceDetails && !invoiceDetails._preview && invoiceDetails.customerEmail) {
      if (emailStatus.status === null && !emailStatus.sending) {
        handleSendEmail(invoiceDetails, false, false, true);
      }
    }
  }, [invoiceModalOpen, invoiceDetails, emailStatus]);

  // Helper to check if a product fits in a specific page
  const productFitsInPage = (product, page) => {
    const filledSlots = new Set();
    let hasAny1 = false;
    
    if (page.ads) {
      page.ads.forEach(ad => {
        const p = products.find(prod => prod.name === ad.ad_type);
        if (p) {
          p.requiredSlots.forEach(s => {
            if (s === 'any_1') hasAny1 = true;
            else filledSlots.add(s);
          });
        } else {
          // If it's a legacy ad or an ad not in our catalog, it takes up the full page.
          filledSlots.add('top');
          filledSlots.add('middle');
          filledSlots.add('bottom');
        }
      });
    }

    if (hasAny1) {
      if (!filledSlots.has('top')) filledSlots.add('top');
      else if (!filledSlots.has('middle')) filledSlots.add('middle');
      else if (!filledSlots.has('bottom')) filledSlots.add('bottom');
    }

    const availableSlots = new Set(['top', 'middle', 'bottom']);
    filledSlots.forEach(s => availableSlots.delete(s));

    // Check if the product's required slots are available
    if (product.requiredSlots.includes('any_1')) {
      return availableSlots.size >= 1;
    }
    
    return product.requiredSlots.every(slot => availableSlots.has(slot));
  };

  const selectProductForSlot = (slotKey) => {
    const preferredProductIdMap = {
      top: 5,           // ⅓ tercio superior
      middle: 6,        // ⅓ tercio medio
      bottom: 7,        // ⅓ tercio faldón
      top_middle: 8,    // ⅔ dos tercios superior
      middle_bottom: 9, // ⅔ dos tercios bajo
      full: 1           // Página completa
    };
    
    let targetProductId = preferredProductIdMap[slotKey];
    let selectedProd = availableProducts.find(p => p.id === targetProductId);
    
    if (!selectedProd) {
      if (slotKey === 'top' || slotKey === 'middle' || slotKey === 'bottom') {
        selectedProd = availableProducts.find(p => p.requiredSlots.includes('any_1'));
      } else if (slotKey === 'full') {
        selectedProd = availableProducts.find(p => p.requiredSlots.length === 3);
      }
    }
    
    if (selectedProd) {
      setSelectedProductId(selectedProd.id.toString());
      return selectedProd;
    }
    
    return null;
  };

  const handleSlotClick = (slotKey) => {
    if (activeViewMode === 'select_mode') {
      setActiveViewModeAndLock('new_reservation');
    }
    
    setGraphicalSelectedSlot(slotKey);
    const prod = selectProductForSlot(slotKey);
    if (prod) {
      setTimeout(() => {
        setCollapsedPreview(true);
      }, 400);
    }
  };

  const getSlotLabel = (slotKey) => {
    const labels = {
      top: language === 'es' ? '1/3 Superior' : '1/3 Top',
      middle: language === 'es' ? '1/3 Medio' : '1/3 Middle',
      bottom: language === 'es' ? '1/3 Inferior' : '1/3 Bottom',
      top_middle: language === 'es' ? '2/3 Superior' : '2/3 Top',
      middle_bottom: language === 'es' ? '2/3 Inferior' : '2/3 Bottom',
      full: language === 'es' ? 'Página Completa' : 'Full Page'
    };
    return labels[slotKey] || slotKey;
  };

  const renderMiniPageGraphic = (slotKey) => {
    const isTop = slotKey === 'top' || slotKey === 'top_middle' || slotKey === 'full';
    const isMiddle = slotKey === 'middle' || slotKey === 'top_middle' || slotKey === 'middle_bottom' || slotKey === 'full';
    const isBottom = slotKey === 'bottom' || slotKey === 'middle_bottom' || slotKey === 'full';
    
    return (
      <div className="w-8 h-10 bg-white border border-slate-400 rounded flex flex-col gap-0.5 p-0.5 shadow-inner shrink-0" aria-hidden="true">
        <div className={`flex-1 rounded-[1px] ${isTop ? 'bg-green-500 border-green-600' : 'bg-slate-50 border-[0.5px] border-slate-200 border-dashed'}`} />
        <div className={`flex-1 rounded-[1px] ${isMiddle ? 'bg-green-500 border-green-600' : 'bg-slate-50 border-[0.5px] border-slate-200 border-dashed'}`} />
        <div className={`flex-1 rounded-[1px] ${isBottom ? 'bg-green-500 border-green-600' : 'bg-slate-50 border-[0.5px] border-slate-200 border-dashed'}`} />
      </div>
    );
  };

  useEffect(() => {
    if (selectedPage) {
      const savedMode = localStorage.getItem('rp_activeViewMode');
      const savedPage = localStorage.getItem('rp_page_number');
      const isSamePageAsStored = savedPage === String(selectedPage.page_number);

      // If we have a saved mode for this page, restore it and lock — don't let
      // subsequent usedProducts/pages re-fetches overwrite the user's position.
      if (savedMode && isSamePageAsStored) {
        viewModeLocked.current = true;
        setActiveViewMode(savedMode);
        return;
      }

      // If mode is already locked by a previous user action this session, don't recalculate.
      if (viewModeLocked.current) return;

      const hasSomeAds = selectedPage.ads && selectedPage.ads.length > 0;
      
      const available = products.filter(p => {
        if (usedProducts.has(p.id)) return false;
        if (!productFitsInPage(p, selectedPage)) return false;

        // Exclusivity filtering for cover pages (91 and 92) and their products
        if (selectedPage.page_number === 91) {
          if (p.id !== 12) return false;
        } else if (selectedPage.page_number === 92) {
          if (p.id !== 10) return false;
        } else {
          if (p.id === 10 || p.id === 11 || p.id === 12) return false;
        }

        // Parity and specific page filtering
        if (typeof selectedPage.page_number === 'number') {
          const isEven = selectedPage.page_number % 2 === 0;
          const isOdd = !isEven;
          const pNameLower = p.name.toLowerCase();
          
          // Hide 'libre adjudicación' (free assignment) products if a specific page is already selected
          if (pNameLower.includes('libre adjudicación')) return false;

          // If product is exclusively for odd pages
          if (pNameLower.includes('impar') && isEven) return false;
          
          // If product is exclusively for even pages
          if (pNameLower.includes(' par') && !pNameLower.includes('impar') && isOdd) return false;
        } else if (selectedPage.page_number === 'Unassigned') {
          const pNameLower = p.name.toLowerCase();
          if (assignmentPref === 'par' && pNameLower.includes('impar')) return false;
          if (assignmentPref === 'impar' && pNameLower.includes(' par') && !pNameLower.includes('impar')) return false;
        }

        return true;
      });

      if (hasSomeAds && available.length > 0) {
        setActiveViewMode('select_mode');
      } else if (hasSomeAds) {
        setActiveViewMode('process_clients');
      } else {
        setActiveViewMode('new_reservation');
      }
    }
  }, [selectedPage, usedProducts, assignmentPref]);

  const handleUpdateExistingCustomer = async () => {
    if (!editedCustomer.commercial_name) {
      alert(t('rp_alert_cust_name_req'));
      return;
    }
    
    // Clean data payload for database column mismatch
    const cleanData = {
      fiscal_name: editedCustomer.fiscal_name || '',
      commercial_name: editedCustomer.commercial_name || '',
      nif: editedCustomer.nif || '',
      category: editedCustomer.category || '',
      address: editedCustomer.address || '',
      email: editedCustomer.email || '',
      whatsapp: editedCustomer.whatsapp || '',
      last_year_product: editedCustomer.last_year_product || ''
    };

    setIsSavingCustomer(true);
    try {
      if (!selectedCustomerId.startsWith('ext-')) {
        // Real Supabase customer
        const { error } = await supabase
          .from('customers')
          .update(cleanData)
          .eq('id', selectedCustomerId);
        if (error) throw error;
        
        // Update local state
        setCustomers(prev => prev.map(c => (c.id === selectedCustomerId ? { ...c, ...cleanData } : c)));
        logAction('update_customer', selectedCustomerId, cleanData.commercial_name || cleanData.fiscal_name, null, null, 0, 0, 0, 0, null, false, cleanData);
      } else {
        // Mock fallback customer
        setCustomers(prev => prev.map(c => (c.id === selectedCustomerId ? { ...c, ...cleanData } : c)));
      }
      setIsEditingExisting(false);
    } catch (err) {
      console.error("Error updating customer:", err);
      alert(language === 'es' ? 'Error al actualizar el cliente' : 'Error updating customer details');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSave = async (isPreReservation = false) => {
    if (!selectedProductId || (!selectedCustomerId && !isAddingNew)) {
      alert(t('rp_alert_select_cust_prod'));
      return;
    }
    
    // Check contact info: must have email and/or telephone (whatsapp) number
    let checkEmail = '';
    let checkPhone = '';
    
    if (isAddingNew) {
      checkEmail = newCustomer.email;
      checkPhone = newCustomer.whatsapp;
    } else {
      const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
      if (cust) {
        checkEmail = cust.email;
        checkPhone = cust.whatsapp;
      }
    }
    
    if (!checkEmail && !checkPhone) {
      alert(language === 'es' 
        ? 'El cliente debe tener un correo electrónico y/o número de teléfono (WhatsApp) para continuar con la reserva.' 
        : 'The customer must have an email and/or telephone number (WhatsApp) to continue with the reservation.');
      if (!isAddingNew) {
        setIsEditingExisting(true);
      }
      return;
    }
    
    if (!artworkOption) {
      alert(t('rp_alert_select_artwork'));
      return;
    }

    if (artworkOption === '3') {
      if (!designWorkOption) {
        alert(t('rp_alert_select_design'));
        return;
      }
      if (designWorkOption === '1' && !designWorkPrice) {
        alert(t('rp_alert_enter_price'));
        return;
      }
    }

    if (isAddingNew && (!newCustomer.commercial_name || !newCustomer.email)) {
      alert(t('rp_alert_provide_name_email'));
      return;
    }

    setIsSaving(true);
    const prod = products.find(p => p.id === parseInt(selectedProductId));
    
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';
      let customerEmail = '';

      if (isAddingNew) {
        if (!newCustomer.commercial_name) {
          alert(t('rp_alert_cust_name_req'));
          setIsSaving(false); return;
        }
        
        const nifToUse = newCustomer.nif || `UNKNOWN-${Date.now()}`;
        
        const { data, error } = await safeInsertCustomer({
          fiscal_name: newCustomer.fiscal_name,
          commercial_name: newCustomer.commercial_name,
          nif: nifToUse,
          contact_name: newCustomer.contact_name,
          email: newCustomer.email,
          whatsapp: newCustomer.whatsapp,
          address: newCustomer.address,
          category: newCustomer.category,
          last_year_product: newCustomer.last_year_product
        });
        
        if (error) {
          alert(t('rp_alert_cust_db_error') + error.message);
          setIsSaving(false);
          return;
        }
        
        if (data && data.length > 0) {
          finalCustomerId = data[0].id;
          finalCustomerName = data[0].commercial_name || data[0].fiscal_name;
          customerEmail = data[0].email || '';
          setCustomers(prev => [...prev, data[0]]);
          logAction('create_customer', data[0].id, finalCustomerName, null, null, 0, 0, 0, 0, null, false, data[0]);
        } else {
          alert(t('rp_alert_cust_create_error'));
          setIsSaving(false);
          return;
        }
      } else {
        const cust = customers.find(c => c.id === finalCustomerId || c.nif === finalCustomerId);
        finalCustomerName = cust ? (cust.commercial_name || cust.fiscal_name) : (t('rp_unknown_customer') || 'Unknown Customer');
        customerEmail = cust ? (cust.email || '') : '';
      }

      // Auto-assign page if Unassigned
      let targetPageNumber = selectedPage.page_number;
      
      if (targetPageNumber === 'Unassigned') {
        const fallbackPages = pages;
        // Look for a page that can fit this product
        let availablePages = fallbackPages.filter(p => p.status !== 'Locked' && productFitsInPage(prod, p));
        
        // Exclude 91 and 92 from auto-assignment just in case, unless they are the only ones left
        const normalAvailable = availablePages.filter(p => p.page_number !== 91 && p.page_number !== 92);
        if (normalAvailable.length > 0) availablePages = normalAvailable;

        if (assignmentPref === 'par') {
          availablePages = availablePages.filter(p => p.page_number % 2 === 0);
        } else if (assignmentPref === 'impar') {
          availablePages = availablePages.filter(p => p.page_number % 2 !== 0);
        }
        
        if (availablePages.length === 0) {
          alert(t('rp_alert_no_pages'));
          setIsSaving(false);
          return;
        }
        
        // Pick random from filtered list
        const randomIdx = Math.floor(Math.random() * availablePages.length);
        targetPageNumber = availablePages[randomIdx].page_number;
      }

      let artworkComment = "";
      if (artworkOption === '1') artworkComment = t('artwork_note_opt1');
      else if (artworkOption === '2') artworkComment = t('artwork_note_opt2');
      else if (artworkOption === '3') {
        if (designWorkOption === '1') artworkComment = t('artwork_note_opt3_1');
        else if (designWorkOption === '2') artworkComment = t('artwork_note_opt3_2');
        else if (designWorkOption === '3') artworkComment = t('artwork_note_opt3_3');
      }

      const basePrice = parseFloat(prod.price);
      let designPrice = 0;
      if (artworkOption === '3' && designWorkOption === '1') {
        designPrice = parseFloat(designWorkPrice) || 0;
      }

      // Create a pending order — invoice will only be generated when payment is confirmed
      const newOrder = await addOrder({
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice: designPrice,
        assignedPage: targetPageNumber,
        date: new Date().toLocaleDateString(),
        artworkComment: artworkComment,
        orderType: isPreReservation ? 'pre-reserved' : 'transfer',
        paymentMethod: reservationPaymentMethod,
        customerEmail: checkEmail,
        customerPhone: checkPhone,
        customerId: finalCustomerId
      });
      setOrderDetails(newOrder);
      setEmailStatus({ sending: false, status: null, error: '' });
      setOrderConfirmModalOpen(true);

    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecibo = async () => {
    if (!selectedProductId || (!selectedCustomerId && !isAddingNew)) {
      alert(t('rp_alert_select_cust_prod'));
      return;
    }

    // Check contact info: must have email and/or telephone (whatsapp) number
    let checkEmail = '';
    let checkPhone = '';
    
    if (isAddingNew) {
      checkEmail = newCustomer.email;
      checkPhone = newCustomer.whatsapp;
    } else {
      const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
      if (cust) {
        checkEmail = cust.email;
        checkPhone = cust.whatsapp;
      }
    }
    
    if (!checkEmail && !checkPhone) {
      alert(language === 'es' 
        ? 'El cliente debe tener un correo electrónico y/o número de teléfono (WhatsApp) para continuar con la reserva.' 
        : 'The customer must have an email and/or telephone number (WhatsApp) to continue with the reservation.');
      if (!isAddingNew) {
        setIsEditingExisting(true);
      }
      return;
    }

    if (!artworkOption) {
      alert(t('rp_alert_select_artwork'));
      return;
    }
    if (isAddingNew && (!newCustomer.commercial_name || !newCustomer.email)) {
      alert(t('rp_alert_provide_name_email'));
      return;
    }

    setIsSaving(true);
    const prod = products.find(p => p.id === parseInt(selectedProductId));

    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';
      let customerEmail = '';

      if (isAddingNew) {
        if (!newCustomer.commercial_name) {
          alert(t('rp_alert_cust_name_req'));
          setIsSaving(false); return;
        }
        const nifToUse = newCustomer.nif || `UNKNOWN-${Date.now()}`;
        const { data, error } = await safeInsertCustomer({
          fiscal_name: newCustomer.fiscal_name,
          commercial_name: newCustomer.commercial_name,
          nif: nifToUse,
          contact_name: newCustomer.contact_name,
          email: newCustomer.email,
          whatsapp: newCustomer.whatsapp,
          address: newCustomer.address,
          category: newCustomer.category,
          last_year_product: newCustomer.last_year_product
        });
        if (error) {
          alert(t('rp_alert_cust_db_error') + error.message);
          setIsSaving(false); return;
        }
        if (data && data.length > 0) {
          finalCustomerId = data[0].id;
          finalCustomerName = data[0].commercial_name || data[0].fiscal_name;
          customerEmail = data[0].email || '';
          setCustomers(prev => [...prev, data[0]]);
        } else {
          alert(t('rp_alert_cust_create_error'));
          setIsSaving(false); return;
        }
      } else {
        const cust = customers.find(c => c.id === finalCustomerId || c.nif === finalCustomerId);
        finalCustomerName = cust ? (cust.commercial_name || cust.fiscal_name) : (t('rp_unknown_customer') || 'Unknown Customer');
        customerEmail = cust ? (cust.email || '') : '';
      }

      // Auto-assign page if Unassigned
      let targetPageNumber = selectedPage.page_number;
      if (targetPageNumber === 'Unassigned') {
        const fallbackPages = pages;
        let availablePages = fallbackPages.filter(p => p.status !== 'Locked' && productFitsInPage(prod, p));
        const normalAvailable = availablePages.filter(p => p.page_number !== 91 && p.page_number !== 92);
        if (normalAvailable.length > 0) availablePages = normalAvailable;
        if (assignmentPref === 'par') availablePages = availablePages.filter(p => p.page_number % 2 === 0);
        else if (assignmentPref === 'impar') availablePages = availablePages.filter(p => p.page_number % 2 !== 0);
        if (availablePages.length === 0) {
          alert(t('rp_alert_no_pages'));
          setIsSaving(false); return;
        }
        const randomIdx = Math.floor(Math.random() * availablePages.length);
        targetPageNumber = availablePages[randomIdx].page_number;
      }

      const basePrice = parseFloat(prod.price);
      let designPrice = 0;
      if (artworkOption === '3' && designWorkOption === '1') {
        designPrice = parseFloat(designWorkPrice) || 0;
      }

      const newRecibo = await addRecibo({
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice: designPrice,
        assignedPage: targetPageNumber,
        date: new Date().toLocaleDateString(),
        customerEmail: checkEmail,
        customerPhone: checkPhone,
        customerId: finalCustomerId
      });

      setReciboDetails(newRecibo);
      setEmailStatus({ sending: false, status: null, error: '' });
      setReciboModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Efectivo flow ---
  // Step 1: validate form, build preview data, open preview modal
  const handleOpenEfectivoPreview = () => {
    if (!selectedProductId || (!selectedCustomerId && !isAddingNew)) {
      alert(t('rp_alert_select_cust_prod'));
      return;
    }

    if (!artworkOption) {
      alert(t('rp_alert_select_artwork'));
      return;
    }

    if (isAddingNew && (!newCustomer.commercial_name || !newCustomer.email)) {
      alert(t('rp_alert_provide_name_email'));
      return;
    }

    const prod = products.find(p => p.id === parseInt(selectedProductId));
    if (!prod) return;

    const basePrice = parseFloat(prod.price);
    let designPrice = 0;
    if (artworkOption === '3' && designWorkOption === '1') {
      designPrice = parseFloat(designWorkPrice) || 0;
    }
    const subtotal = basePrice + designPrice;
    const vatAmount = parseFloat((subtotal * 0.21).toFixed(2));
    const total = parseFloat((subtotal + vatAmount).toFixed(2));

    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';
    if (isAddingNew) {
      customerName = newCustomer.commercial_name || newCustomer.fiscal_name;
      customerEmail = newCustomer.email;
      customerPhone = newCustomer.whatsapp;
    } else {
      const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
      customerName = cust ? (cust.commercial_name || cust.fiscal_name) : '';
      customerEmail = cust ? (cust.email || '') : '';
      customerPhone = cust ? (cust.whatsapp || '') : '';
    }

    // Store preview details in invoiceDetails (reuse state), flag via efectivoPreviewOpen
    setInvoiceDetails({
      _preview: true,
      customerName,
      customerEmail,
      customerPhone,
      productName: prod.name,
      productId: prod.id,
      assignedPage: selectedPage.page_number,
      price: basePrice,
      designPrice,
      vat: vatAmount,
      total,
    });
    setEfectivoPreviewOpen(true);
  };

  // Step 2: triggered from inside the preview modal — actually saves
  const handleConfirmEfectivoSale = async () => {
    if (!selectedProductId || (!selectedCustomerId && !isAddingNew)) {
      alert(t('rp_alert_select_cust_prod'));
      return;
    }

    let checkEmail = '';
    let checkPhone = '';

    if (isAddingNew) {
      checkEmail = newCustomer.email;
      checkPhone = newCustomer.whatsapp;
    } else {
      const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
      if (cust) {
        checkEmail = cust.email;
        checkPhone = cust.whatsapp;
      }
    }

    setIsSaving(true);
    const prod = products.find(p => p.id === parseInt(selectedProductId));

    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';

      if (isAddingNew) {
        if (!newCustomer.commercial_name) {
          alert(t('rp_alert_cust_name_req'));
          setIsSaving(false); return;
        }
        const nifToUse = newCustomer.nif || `UNKNOWN-${Date.now()}`;
        const { data, error } = await safeInsertCustomer({
          fiscal_name: newCustomer.fiscal_name,
          commercial_name: newCustomer.commercial_name,
          nif: nifToUse,
          contact_name: newCustomer.contact_name,
          email: newCustomer.email,
          whatsapp: newCustomer.whatsapp,
          address: newCustomer.address,
          category: newCustomer.category,
          last_year_product: newCustomer.last_year_product
        });
        if (error) {
          alert(t('rp_alert_cust_db_error') + error.message);
          setIsSaving(false); return;
        }
        if (data && data.length > 0) {
          finalCustomerId = data[0].id;
          finalCustomerName = data[0].commercial_name || data[0].fiscal_name;
          checkEmail = data[0].email || '';
          checkPhone = data[0].whatsapp || '';
          setCustomers(prev => [...prev, data[0]]);
        } else {
          alert(t('rp_alert_cust_create_error'));
          setIsSaving(false); return;
        }
      } else {
        const cust = customers.find(c => c.id === finalCustomerId || c.nif === finalCustomerId);
        finalCustomerName = cust ? (cust.commercial_name || cust.fiscal_name) : (t('rp_unknown_customer') || 'Unknown Customer');
      }

      // Auto-assign page if Unassigned
      let targetPageNumber = selectedPage.page_number;
      if (targetPageNumber === 'Unassigned') {
        const fallbackPages = pages;
        let availablePages = fallbackPages.filter(p => p.status !== 'Locked' && productFitsInPage(prod, p));
        const normalAvailable = availablePages.filter(p => p.page_number !== 91 && p.page_number !== 92);
        if (normalAvailable.length > 0) availablePages = normalAvailable;
        if (assignmentPref === 'par') availablePages = availablePages.filter(p => p.page_number % 2 === 0);
        else if (assignmentPref === 'impar') availablePages = availablePages.filter(p => p.page_number % 2 !== 0);
        if (availablePages.length === 0) {
          alert(t('rp_alert_no_pages'));
          setIsSaving(false); return;
        }
        const randomIdx = Math.floor(Math.random() * availablePages.length);
        targetPageNumber = availablePages[randomIdx].page_number;
      }

      let artworkComment = "";
      if (artworkOption === '1') artworkComment = t('artwork_note_opt1');
      else if (artworkOption === '2') artworkComment = t('artwork_note_opt2');
      else if (artworkOption === '3') {
        if (designWorkOption === '1') artworkComment = t('artwork_note_opt3_1');
        else if (designWorkOption === '2') artworkComment = t('artwork_note_opt3_2');
        else if (designWorkOption === '3') artworkComment = t('artwork_note_opt3_3');
      }

      const basePrice = parseFloat(prod.price);
      let designPrice = 0;
      if (artworkOption === '3' && designWorkOption === '1') {
        designPrice = parseFloat(designWorkPrice) || 0;
      }

      const subtotal = basePrice + designPrice;
      const vatAmount = parseFloat((subtotal * 0.21).toFixed(2));
      const total = parseFloat((subtotal + vatAmount).toFixed(2));

      const adDetails = {
        ad_type: prod.name,
        customer_id: finalCustomerId || 'legacy',
        customer_name: finalCustomerName,
        isPreReserved: false,
        expiresAt: null,
        artworkOption: artworkOption,
        designWorkOption: designWorkOption || null,
        designWorkPrice: designPrice,
        isNew: true,
        isPaid: true,
        paymentMethod: 'Cash',
        isRecibo: false
      };

      const newInvoice = await addInvoiceWithReservation({
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice,
        vat: vatAmount,
        total,
        assignedPage: targetPageNumber,
        artworkComment,
        paymentMethod: 'Cash',
        isPaid: true,
        customerEmail: checkEmail,
        customerPhone: checkPhone
      }, adDetails);

      // Close preview, open the success modal with real invoice data
      setEfectivoPreviewOpen(false);
      setInvoiceDetails(newInvoice);
      setEmailStatus({ sending: false, status: null, error: '' });
      setInvoiceModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };



  const handleConfirmReciboAndClose = () => {
    setReciboModalOpen(false);
    if (onReservationComplete) {
      onReservationComplete();
    }
  };

  const handleConfirmPaymentAndClose = () => {
    updateInvoicePayment(invoiceDetails.id, paymentMethod, isPaid);
    setInvoiceModalOpen(false);
    if (onReservationComplete) {
      onReservationComplete();
    }
  };

  const handleCloseInvoice = () => {
    setInvoiceModalOpen(false);
    if (onReservationComplete) {
      onReservationComplete();
    }
  };

  const handleDeleteAd = async (idx) => {
    if (!window.confirm(t('rp_confirm_delete'))) return;
    
    const adToDelete = selectedPage.ads[idx];
    const customerName = adToDelete.customer_name;
    
    const invoiceToDelete = invoices.find(inv => 
      inv.assignedPage === selectedPage.page_number && 
      inv.customerName === customerName &&
      inv.productName === adToDelete.ad_type
    );
    if (invoiceToDelete) {
      await deleteInvoice(invoiceToDelete.id);
    }

    const orderToDelete = orders.find(o => 
      o.assignedPage === selectedPage.page_number && 
      o.customerName === customerName &&
      o.productName === adToDelete.ad_type
    );
    if (orderToDelete) {
      await deleteOrder(orderToDelete.id);
    }
    
    await deleteAdReservationDirect(selectedPage.page_number, customerName, adToDelete.ad_type);
    
    if (onReservationComplete) {
      onReservationComplete();
    }
  };

  const handleConfirmSale = async (ad, method) => {
    setIsSaving(true);
    try {
      const pendingOrder = orders.find(o => 
        o.assignedPage === selectedPage.page_number && 
        o.customerName?.toLowerCase() === ad.customer_name?.toLowerCase() &&
        o.productName === ad.ad_type &&
        o.status === 'Pending'
      );
      
      let orderToUse = pendingOrder;
      if (!orderToUse) {
        const prod = products.find(p => p.name === ad.ad_type);
        const basePrice = prod ? parseFloat(prod.price) : 0;
        const designPrice = parseFloat(ad.designWorkPrice) || 0;
        
        const customerObj = customers.find(c => c.id === ad.customer_id || c.nif === ad.customer_id || (c.commercial_name && c.commercial_name.toLowerCase() === ad.customer_name?.toLowerCase()));
        const customerEmail = customerObj ? customerObj.email : null;
        const customerPhone = customerObj ? customerObj.whatsapp : null;

        orderToUse = await addOrder({
          customerName: ad.customer_name,
          productName: ad.ad_type,
          price: basePrice,
          designPrice: designPrice,
          assignedPage: selectedPage.page_number,
          date: new Date().toLocaleDateString(),
          artworkComment: ad.artworkComment || '',
          orderType: 'transfer',
          customerId: ad.customer_id,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          status: 'Pending'
        }, true);
      }
      
      const invoice = await confirmOrderPayment(orderToUse, method, true);
      
      if (invoice) {
        setInvoiceDetails(invoice);
        setEmailStatus({ sending: false, status: null, error: '' });
        setInvoiceModalOpen(true);
      }
    } catch (error) {
      console.error("Error confirming sale:", error);
      alert((language === 'es' ? 'Error al confirmar la venta: ' : 'Error confirming sale: ') + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Find all pre-reserved ads
  const preReservedAds = selectedPage?.ads?.filter(ad => ad.isPreReserved) || [];
  const hasExpired = preReservedAds.some(ad => ad.expires_at && new Date() > new Date(ad.expires_at));
  const [resolvingAdIndex, setResolvingAdIndex] = useState(null);
  const [prolongDate, setProlongDate] = useState('');

  const handleResolveAction = async (ad, index, action) => {
    const customerName = ad.customer_name;
    const adType = ad.ad_type;

    if (action === 'cancel') {
      const confirmCancel = window.confirm(
        language === 'es'
          ? '¿Está seguro de que desea liberar esta pre-reserva? Se cancelará el pedido y se eliminará la factura asociada.'
          : 'Are you sure you want to liberate this pre-reservation? The order will be cancelled and associated invoice deleted.'
      );
      if (!confirmCancel) return;

      const invoiceToDelete = invoices.find(inv => 
        inv.assignedPage === selectedPage.page_number && 
        inv.customerName === customerName &&
        inv.productName === adType
      );
      if (invoiceToDelete) {
        await deleteInvoice(invoiceToDelete.id);
      }
      
      const orderToDelete = orders.find(o => 
        o.assignedPage === selectedPage.page_number && 
        o.customerName === customerName &&
        o.productName === adType
      );
      if (orderToDelete) {
        await updateOrder(orderToDelete.id, { status: 'Cancelled' });
      }
      
      await deleteAdReservationDirect(selectedPage.page_number, customerName, adType);
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'prolong') {
      if (!prolongDate) {
        alert(t('rp_alert_select_exp_date'));
        return;
      }
      await resolvePreReservation(selectedPage.page_number, customerName, adType, 'prolong', prolongDate);
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'confirm') {
      const prod = products.find(p => p.name === adType);
      const basePrice = prod ? parseFloat(prod.price) : 0;
      const designPrice = parseFloat(ad.designWorkPrice) || 0;
      
      let artworkComment = "";
      if (ad.artworkOption === '1') artworkComment = t('artwork_note_opt1');
      else if (ad.artworkOption === '2') artworkComment = t('artwork_note_opt2');
      else if (ad.artworkOption === '3') {
        if (ad.designWorkOption === '1') artworkComment = t('artwork_note_opt3_1');
        else if (ad.designWorkOption === '2') artworkComment = t('artwork_note_opt3_2');
        else if (ad.designWorkOption === '3') artworkComment = t('artwork_note_opt3_3');
      }

      // Update the old pre-reserved order to transfer instead of deleting and recreating it
      const oldOrder = orders.find(o => 
        o.assignedPage === selectedPage.page_number && 
        o.customerName === customerName &&
        o.productName === adType &&
        o.orderType === 'pre-reserved'
      );
      
      const customerObj = customers.find(c => c.id === ad.customer_id || c.nif === ad.customer_id || (c.commercial_name && c.commercial_name.toLowerCase() === customerName.toLowerCase()));
      const customerEmail = customerObj ? customerObj.email : null;
      const customerPhone = customerObj ? customerObj.whatsapp : null;

      let orderToUse;
      if (oldOrder) {
        await updateOrder(oldOrder.id, {
          orderType: 'transfer',
          price: basePrice,
          designPrice: designPrice,
          artworkComment: artworkComment,
          status: 'Pending',
          customerEmail: customerEmail,
          customerPhone: customerPhone
        });
        orderToUse = {
          ...oldOrder,
          orderType: 'transfer',
          price: basePrice,
          designPrice: designPrice,
          artworkComment: artworkComment,
          status: 'Pending',
          customerEmail: customerEmail,
          customerPhone: customerPhone
        };
      } else {
        orderToUse = await addOrder({
          customerName: customerName,
          productName: adType,
          price: basePrice,
          designPrice: designPrice,
          assignedPage: selectedPage.page_number,
          date: new Date().toLocaleDateString(),
          artworkComment: artworkComment,
          orderType: 'transfer',
          customerId: ad.customer_id,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          status: 'Pending'
        }, true);
      }
      
      await resolvePreReservation(selectedPage.page_number, customerName, adType, 'confirm');
      
      const invoice = await confirmOrderPayment(orderToUse, 'Transfer', true);
      setEmailStatus({ sending: false, status: null, error: '' });
      if (invoice) {
        setInvoiceDetails(invoice);
        setInvoiceModalOpen(true);
      } else {
        setOrderDetails(orderToUse);
        setOrderConfirmModalOpen(true);
      }
    }
  };

  const handleOpenPreBilling = (ad, idx) => {
    setPreBillingAd(ad);
    setPreBillingIndex(idx);
    setPreBillingModalOpen(true);
  };

  const handleConfirmPreReservation = async (ad, paymentMethod) => {
    setIsSaving(true);
    try {
      const customerName = ad.customer_name;
      const adType = ad.ad_type;
      const prod = products.find(p => p.name === adType);
      const basePrice = prod ? parseFloat(prod.price) : 0;
      const designPrice = parseFloat(ad.designWorkPrice) || 0;
      
      let artworkComment = "";
      if (ad.artworkOption === '1') artworkComment = t('artwork_note_opt1') || "";
      else if (ad.artworkOption === '2') artworkComment = t('artwork_note_opt2') || "";
      else if (ad.artworkOption === '3') {
        if (ad.designWorkOption === '1') artworkComment = t('artwork_note_opt3_1') || "";
        else if (ad.designWorkOption === '2') artworkComment = t('artwork_note_opt3_2') || "";
        else if (ad.designWorkOption === '3') artworkComment = t('artwork_note_opt3_3') || "";
      }

      // Update the old pre-reserved order
      const oldOrder = orders.find(o => 
        o.assignedPage === selectedPage.page_number && 
        o.customerName === customerName &&
        o.productName === adType &&
        o.orderType === 'pre-reserved'
      );
      
      const customerObj = customers.find(c => c.id === ad.customer_id || c.nif === ad.customer_id || (c.commercial_name && c.commercial_name.toLowerCase() === customerName.toLowerCase()));
      const customerEmail = customerObj ? customerObj.email : null;
      const customerPhone = customerObj ? customerObj.whatsapp : null;

      let orderToUse;
      const dbOrderType = paymentMethod === 'Cash' ? 'cash' : 'transfer';
      
      if (oldOrder) {
        await updateOrder(oldOrder.id, {
          orderType: dbOrderType,
          price: basePrice,
          designPrice: designPrice,
          artworkComment: artworkComment,
          status: 'Pending',
          customerEmail: customerEmail,
          customerPhone: customerPhone
        });
        orderToUse = {
          ...oldOrder,
          orderType: dbOrderType,
          price: basePrice,
          designPrice: designPrice,
          artworkComment: artworkComment,
          status: 'Pending',
          customerEmail: customerEmail,
          customerPhone: customerPhone
        };
      } else {
        orderToUse = await addOrder({
          customerName: customerName,
          productName: adType,
          price: basePrice,
          designPrice: designPrice,
          assignedPage: selectedPage.page_number,
          date: new Date().toLocaleDateString(),
          artworkComment: artworkComment,
          orderType: dbOrderType,
          customerId: ad.customer_id,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          status: 'Pending'
        }, true);
      }
      
      await resolvePreReservation(selectedPage.page_number, customerName, adType, 'confirm');
      
      const invoice = await confirmOrderPayment(orderToUse, paymentMethod, true);
      setPreBillingModalOpen(false);
      setEmailStatus({ sending: false, status: null, error: '' });
      if (invoice) {
        setInvoiceDetails(invoice);
        setInvoiceModalOpen(true);
      } else {
        setOrderDetails(orderToUse);
        setOrderConfirmModalOpen(true);
      }
    } catch (err) {
      console.error("Error confirming pre-reservation:", err);
      alert(language === 'es' ? 'Error al confirmar la pre-reserva: ' + err.message : 'Error confirming pre-reservation: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Customer Status Helper ────────────────────────────────────────────────
  // Returns 'ok' (paid), 'pt' (pending transfer), 'pr' (pre-reserved), or null.
  const getCustomerStatus = (customer) => {
    const pagesList = pages;
    const invoiceList = invoices;
    const reciboList = recibos;
    const orderList = orders;
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();
    const custId = customer.id;
    const custNif = customer.nif;

    const matchesCust = (ad) =>
      ad.customer_id === custId ||
      ad.customer_id === custNif ||
      (ad.customer_name && ad.customer_name.toLowerCase() === name);

    const hasPaidInvoice = invoiceList.some(inv => inv.isPaid && inv.customerName?.toLowerCase() === name);
    const hasRecibo = reciboList.some(r => r.customerName?.toLowerCase() === name);
    const hasPaidAd = pages.some(p => p.ads?.some(ad => matchesCust(ad) && ad.isPaid));
    if (hasRecibo) return 'recibo';
    if (hasPaidInvoice || hasPaidAd) return 'ok';

    let preReservedDate = null;
    pages.forEach(p => {
      p.ads?.forEach(ad => {
        if (matchesCust(ad) && ad.isPreReserved && ad.expires_at) {
          preReservedDate = ad.expires_at;
        }
      });
    });

    if (!preReservedDate) {
      const prOrder = orderList.find(o => o.orderType === 'pre-reserved' && o.customerName?.toLowerCase() === name);
      if (prOrder) {
        const created = new Date(prOrder.createdAt);
        created.setDate(created.getDate() + 7);
        preReservedDate = created.toISOString();
      }
    }

    if (preReservedDate) {
      const expDate = new Date(preReservedDate);
      const day = expDate.getDate().toString().padStart(2, '0');
      const month = (expDate.getMonth() + 1).toString().padStart(2, '0');
      return `pr:${day}/${month}`;
    }

    const hasPendingAd = pages.some(p => p.ads?.some(ad => matchesCust(ad) && !ad.isPreReserved && !ad.isPaid));
    const hasPendingOrder = orderList.some(o => o.orderType === 'transfer' && o.customerName?.toLowerCase() === name);
    if (hasPendingAd || hasPendingOrder) return 'pt';

    return null;
  };

  const availableProducts = products.filter(p => {
    if (usedProducts.has(p.id)) return false;
    if (!productFitsInPage(p, selectedPage)) return false;

    // Exclusivity filtering for cover pages (91 and 92) and their products
    if (selectedPage.page_number === 91) {
      if (p.id !== 12) return false;
    } else if (selectedPage.page_number === 92) {
      if (p.id !== 10) return false;
    } else {
      if (p.id === 10 || p.id === 11 || p.id === 12) return false;
    }

    // Parity and specific page filtering
    if (typeof selectedPage.page_number === 'number') {
      const isEven = selectedPage.page_number % 2 === 0;
      const isOdd = !isEven;
      const pNameLower = p.name.toLowerCase();
      
      // Hide 'libre adjudicación' (free assignment) products if a specific page is already selected
      if (pNameLower.includes('libre adjudicación')) return false;

      // If product is exclusively for odd pages
      if (pNameLower.includes('impar') && isEven) return false;
      
      // If product is exclusively for even pages (check for ' par' to avoid matching 'impar')
      if (pNameLower.includes(' par') && !pNameLower.includes('impar') && isOdd) return false;
    } else if (selectedPage.page_number === 'Unassigned') {
      // If unassigned, but user selected a preference, filter products
      const pNameLower = p.name.toLowerCase();
      if (assignmentPref === 'par' && pNameLower.includes('impar')) return false;
      if (assignmentPref === 'impar' && pNameLower.includes(' par') && !pNameLower.includes('impar')) return false;
    }

    return true;
  });

  const renderPDFTemplate = (inv) => {
    if (!inv) return null;
    const cust = customers.find(c => 
      (c.commercial_name && c.commercial_name.trim().toLowerCase() === inv.customerName?.trim().toLowerCase()) ||
      (c.fiscal_name && c.fiscal_name.trim().toLowerCase() === inv.customerName?.trim().toLowerCase())
    );
    const addrDetails = parseAddressDetails(cust?.address);

    return (
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
            {cust?.fiscal_name && cust.fiscal_name !== inv.customerName && (
              <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', margin: '2px 0 0' }}>{cust.fiscal_name}</p>
            )}
            {cust?.nif && (
              <p style={{ fontSize: '13px', fontFamily: 'monospace', color: '#374151', margin: '2px 0 0' }}>NIF/CIF: {cust.nif}</p>
            )}
            {cust?.address && (
              <p style={{ fontSize: '12px', color: '#4b5563', margin: '6px 0 0', lineHeight: '1.4' }}>
                {cust.address}
                {(addrDetails.zip || addrDetails.city) && (
                  <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                    {addrDetails.zip} {addrDetails.city} {addrDetails.province ? `(${addrDetails.province})` : ''}
                  </span>
                )}
              </p>
            )}
            {(inv.customerEmail || cust?.email) && (
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '4px 0 0' }}>Email: {inv.customerEmail || cust?.email}</p>
            )}
            {(inv.customerPhone || cust?.whatsapp) && (
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Tel: {inv.customerPhone || cust?.whatsapp}</p>
            )}
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

        {inv.isPaid ? (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '13px', color: '#047857' }}>
            <strong style={{ fontWeight: '700' }}>{t('inv_payment_status') || 'Estado de Pago:'}</strong> {t('inv_paid') || 'PAGADO'} ({t('rp_' + (inv.paymentMethod || 'transfer').toLowerCase()) || inv.paymentMethod})
          </div>
        ) : (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', color: '#1e3a8a' }}>
            <strong style={{ fontWeight: '700' }}>FORMA de PAGO:</strong> TRANSFERENCIA a IBAN: <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>ES0600492246812214008717</span>   / <strong style={{ fontWeight: '700' }}>REFEFERENCIA PAGO:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{inv.id}</span>
          </div>
        )}

        {/* Artwork note */}
        <div style={{ marginTop: '32px', paddingTop: '32px', borderTop: '1px solid #e5e7eb' }}>
          <h4 style={{ fontWeight: '700', color: '#1f2937', marginBottom: '8px' }}>{t('inv_important_info')}</h4>
          <p style={{ color: '#4b5563', backgroundColor: '#f9fafb', padding: '14px', borderRadius: '8px', margin: 0 }}>{inv.artworkComment}</p>
        </div>
      </div>
    );
  };

  const getPageSlots = (page) => {
    if (!page || !page.ads) return { top: null, middle: null, bottom: null };

    const filledSlots = new Set();
    const slotToAdMap = {};
    let hasAny1 = false;

    page.ads.forEach(ad => {
      const prod = products.find(p => p.name === ad.ad_type);
      if (prod) {
        prod.requiredSlots.forEach(slot => {
          if (slot === 'any_1') {
            hasAny1 = true;
            slotToAdMap['any_1'] = ad;
          } else {
            filledSlots.add(slot);
            slotToAdMap[slot] = ad;
          }
        });
      } else {
        filledSlots.add('top');
        filledSlots.add('middle');
        filledSlots.add('bottom');
        slotToAdMap['top'] = ad;
        slotToAdMap['middle'] = ad;
        slotToAdMap['bottom'] = ad;
      }
    });

    if (hasAny1) {
      const ad = slotToAdMap['any_1'];
      if (!filledSlots.has('top')) {
        filledSlots.add('top');
        slotToAdMap['top'] = ad;
      } else if (!filledSlots.has('middle')) {
        filledSlots.add('middle');
        slotToAdMap['middle'] = ad;
      } else if (!filledSlots.has('bottom')) {
        filledSlots.add('bottom');
        slotToAdMap['bottom'] = ad;
      }
    }

    return {
      top: filledSlots.has('top') ? slotToAdMap['top'] : null,
      middle: filledSlots.has('middle') ? slotToAdMap['middle'] : null,
      bottom: filledSlots.has('bottom') ? slotToAdMap['bottom'] : null,
    };
  };

  const renderVisualPagePreview = () => {
    if (selectedPage.page_number === 'Unassigned') return null;

    const slots = getPageSlots(selectedPage);
    
    const getAdBgColor = (ad) => {
      if (!ad) return 'bg-gray-50/50 border-gray-200 text-gray-400 border-dashed';
      if (ad.isPaid) return 'bg-green-500 border-green-600 text-white';
      if (ad.isPreReserved) return 'bg-orange-500 border-orange-600 text-white';
      if (ad.isNew) return 'bg-blue-500 border-blue-600 text-white';
      return 'bg-red-500 border-red-600 text-white';
    };

    const getAdCustomerName = (ad) => {
      if (!ad) return '';
      let cName = ad.customer_name;
      if (!cName && ad.customer_id !== 'legacy') {
        const c = customers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
        cName = c ? (c.commercial_name || c.fiscal_name) : null;
        if (!cName) {
          const fc = fallbackCustomers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
          cName = fc ? (fc.commercial_name || fc.fiscal_name) : (t('rp_unknown_customer') || 'Cliente Desconocido');
        }
      } else if (!cName) {
        cName = t('rp_legacy_customer') || 'Legacy Customer';
      }
      return cName;
    };

    const renderSlotBlock = (ad, heightClass, label, slotKey, forceStyle = null) => {
      const cName = getAdCustomerName(ad);
      const colorClass = getAdBgColor(ad);
      const isAvailable = !ad;
      
      const isSelected = forceStyle === 'selected' || (isAvailable && !forceStyle && (
        graphicalSelectedSlot === slotKey ||
        (slotKey === 'top' && (graphicalSelectedSlot === 'top_middle' || graphicalSelectedSlot === 'full')) ||
        (slotKey === 'middle' && (graphicalSelectedSlot === 'top_middle' || graphicalSelectedSlot === 'middle_bottom' || graphicalSelectedSlot === 'full')) ||
        (slotKey === 'bottom' && (graphicalSelectedSlot === 'middle_bottom' || graphicalSelectedSlot === 'full'))
      ));

      const isHovered = forceStyle === 'hovered' || (isAvailable && !forceStyle && hoveredLayoutSlots.includes(slotKey));

      let customColorClass = colorClass;
      let clickHandler = undefined;

      if (isSelected) {
        customColorClass = 'bg-green-500 border-green-600 text-white shadow-md scale-[1.02] ring-4 ring-green-200 cursor-pointer font-bold';
      } else if (isHovered) {
        customColorClass = 'bg-green-100 border-green-400 text-green-700 shadow-sm scale-[1.01] cursor-pointer';
      } else if (isAvailable) {
        customColorClass = 'bg-gray-50/50 border-gray-200 text-gray-400 border-dashed hover:bg-green-50 hover:border-green-300 hover:text-green-600 cursor-pointer hover:scale-[1.01]';
      }

      if (isAvailable) {
        clickHandler = () => handleSlotClick(slotKey);
      }

      return (
        <div 
          key={slotKey}
          onClick={clickHandler}
          className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-all duration-200 ${heightClass} ${customColorClass} shadow-inner text-center overflow-hidden`}
        >
          {ad ? (
            <>
              <span className="font-bold text-sm truncate max-w-full drop-shadow-sm">{cName}</span>
              <span className="text-xs opacity-90 truncate max-w-full mt-0.5">{ad.ad_type}</span>
            </>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-wider">
              {label} {isSelected ? `(${language === 'es' ? 'Seleccionado' : 'Selected'})` : `(${t('po_available') || 'Disponible'})`}
            </span>
          )}
        </div>
      );
    };

    const topAd = slots.top;
    const middleAd = slots.middle;
    const bottomAd = slots.bottom;

    const isFullPage = topAd && topAd === middleAd && middleAd === bottomAd;
    const isTopTwoThirds = topAd && topAd === middleAd && topAd !== bottomAd;
    const isBottomTwoThirds = middleAd && middleAd === bottomAd && topAd !== middleAd;

    // Determine the active slot configuration
    let activeSlotKey = null;
    let activeSlotStyle = null; // 'selected' or 'hovered'
    
    if (hoveredLayoutSlots && hoveredLayoutSlots.length > 0) {
      activeSlotStyle = 'hovered';
      if (hoveredLayoutSlots.length === 3) activeSlotKey = 'full';
      else if (hoveredLayoutSlots.includes('top') && hoveredLayoutSlots.includes('middle')) activeSlotKey = 'top_middle';
      else if (hoveredLayoutSlots.includes('middle') && hoveredLayoutSlots.includes('bottom')) activeSlotKey = 'middle_bottom';
      else activeSlotKey = hoveredLayoutSlots[0];
    } else if (graphicalSelectedSlot) {
      activeSlotStyle = 'selected';
      activeSlotKey = graphicalSelectedSlot;
    }

    // Now, let's build the blocks to render in the diagram container dynamically
    let blocksToRender = [];
    
    if (activeSlotKey) {
      if (activeSlotKey === 'full') {
        blocksToRender.push({
          key: 'full',
          heightClass: 'flex-1 h-full',
          label: language === 'es' ? 'Página Completa' : 'Full Page',
          ad: null,
          forceStyle: activeSlotStyle
        });
      } else if (activeSlotKey === 'top_middle') {
        blocksToRender.push({
          key: 'top_middle',
          heightClass: 'h-[66.6%]',
          label: language === 'es' ? '2/3 Página (Superior)' : '2/3 Page (Top)',
          ad: null,
          forceStyle: activeSlotStyle
        });
        if (bottomAd) {
          blocksToRender.push({ key: 'bottom', heightClass: 'h-[33.3%]', label: '1/3 Inferior', ad: bottomAd });
        } else {
          blocksToRender.push({ key: 'bottom_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
      } else if (activeSlotKey === 'middle_bottom') {
        if (topAd) {
          blocksToRender.push({ key: 'top', heightClass: 'h-[33.3%]', label: '1/3 Superior', ad: topAd });
        } else {
          blocksToRender.push({ key: 'top_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
        blocksToRender.push({
          key: 'middle_bottom',
          heightClass: 'h-[66.6%]',
          label: language === 'es' ? '2/3 Página (Inferior)' : '2/3 Page (Bottom)',
          ad: null,
          forceStyle: activeSlotStyle
        });
      } else if (activeSlotKey === 'top') {
        blocksToRender.push({
          key: 'top',
          heightClass: 'h-[33.3%]',
          label: language === 'es' ? '1/3 Superior' : '1/3 Top',
          ad: null,
          forceStyle: activeSlotStyle
        });
        if (middleAd) {
          blocksToRender.push({ key: 'middle', heightClass: 'h-[33.3%]', label: '1/3 Medio', ad: middleAd });
        } else {
          blocksToRender.push({ key: 'middle_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
        if (bottomAd) {
          blocksToRender.push({ key: 'bottom', heightClass: 'h-[33.3%]', label: '1/3 Inferior', ad: bottomAd });
        } else {
          blocksToRender.push({ key: 'bottom_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
      } else if (activeSlotKey === 'middle') {
        if (topAd) {
          blocksToRender.push({ key: 'top', heightClass: 'h-[33.3%]', label: '1/3 Superior', ad: topAd });
        } else {
          blocksToRender.push({ key: 'top_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
        blocksToRender.push({
          key: 'middle',
          heightClass: 'h-[33.3%]',
          label: language === 'es' ? '1/3 Medio' : '1/3 Middle',
          ad: null,
          forceStyle: activeSlotStyle
        });
        if (bottomAd) {
          blocksToRender.push({ key: 'bottom', heightClass: 'h-[33.3%]', label: '1/3 Inferior', ad: bottomAd });
        } else {
          blocksToRender.push({ key: 'bottom_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
      } else if (activeSlotKey === 'bottom') {
        if (topAd) {
          blocksToRender.push({ key: 'top', heightClass: 'h-[33.3%]', label: '1/3 Superior', ad: topAd });
        } else {
          blocksToRender.push({ key: 'top_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
        if (middleAd) {
          blocksToRender.push({ key: 'middle', heightClass: 'h-[33.3%]', label: '1/3 Medio', ad: middleAd });
        } else {
          blocksToRender.push({ key: 'middle_blank', heightClass: 'h-[33.3%]', isBlank: true });
        }
        blocksToRender.push({
          key: 'bottom',
          heightClass: 'h-[33.3%]',
          label: language === 'es' ? '1/3 Inferior' : '1/3 Bottom',
          ad: null,
          forceStyle: activeSlotStyle
        });
      }
    } else {
      if (isFullPage) {
        blocksToRender.push({ key: 'full', heightClass: 'flex-1 h-full', label: 'Página Completa', ad: topAd });
      } else if (isTopTwoThirds) {
        blocksToRender.push({ key: 'top_middle', heightClass: 'flex-[2]', label: '2/3 Página (Superior)', ad: topAd });
        blocksToRender.push({ key: 'bottom', heightClass: 'flex-1', label: '1/3 Página (Inferior)', ad: bottomAd });
      } else if (isBottomTwoThirds) {
        blocksToRender.push({ key: 'top', heightClass: 'flex-1', label: '1/3 Página (Superior)', ad: topAd });
        blocksToRender.push({ key: 'middle_bottom', heightClass: 'flex-[2]', label: '2/3 Página (Inferior)', ad: middleAd });
      } else {
        blocksToRender.push({ key: 'top', heightClass: 'flex-1', label: '1/3 Superior', ad: topAd });
        blocksToRender.push({ key: 'middle', heightClass: 'flex-1', label: '1/3 Medio', ad: middleAd });
        blocksToRender.push({ key: 'bottom', heightClass: 'flex-1', label: '1/3 Inferior', ad: bottomAd });
      }
    }

    // Generate list of bookable layouts dynamically based on availableProducts and occupied slots
    const layoutsToBook = [];
    
    availableProducts.forEach(p => {
      if (p.requiredSlots.length === 3) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? 'Página Completa' : 'Full Page',
          slots: ['top', 'middle', 'bottom'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('top') && p.requiredSlots.includes('middle')) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? '2/3 Página (Superior)' : '2/3 Page (Top)',
          slots: ['top', 'middle'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('middle') && p.requiredSlots.includes('bottom')) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? '2/3 Página (Inferior)' : '2/3 Page (Bottom)',
          slots: ['middle', 'bottom'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('top')) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? '1/3 Superior' : '1/3 Top',
          slots: ['top'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('middle')) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? '1/3 Medio' : '1/3 Middle',
          slots: ['middle'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('bottom')) {
        layoutsToBook.push({
          id: p.id,
          name: language === 'es' ? '1/3 Inferior' : '1/3 Bottom',
          slots: ['bottom'],
          desc: p.name,
          price: p.price
        });
      } else if (p.requiredSlots.includes('any_1')) {
        const slotsAvail = [];
        if (!slots.top) slotsAvail.push('top');
        if (!slots.middle) slotsAvail.push('middle');
        if (!slots.bottom) slotsAvail.push('bottom');
        
        slotsAvail.forEach(sKey => {
          let sLabel = '';
          if (sKey === 'top') sLabel = language === 'es' ? '1/3 Superior (Libre)' : '1/3 Top (Free)';
          else if (sKey === 'middle') sLabel = language === 'es' ? '1/3 Medio (Libre)' : '1/3 Middle (Free)';
          else if (sKey === 'bottom') sLabel = language === 'es' ? '1/3 Inferior (Libre)' : '1/3 Bottom (Free)';
          
          layoutsToBook.push({
            id: p.id,
            name: sLabel,
            slots: [sKey],
            desc: p.name,
            price: p.price,
            isGeneric: true
          });
        });
      }
    });

    return (
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
        {/* Left column: Diagram */}
        <div className="w-full max-w-[200px] shrink-0">
          <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
            {language === 'es' ? 'Distribución Visual' : 'Visual Page Distribution'}
          </h5>
          <div className="aspect-[3/4] bg-white border-4 border-slate-800 rounded-2xl p-2.5 flex flex-col gap-2 shadow-md relative overflow-hidden">
            {blocksToRender.map(block => {
              if (block.isBlank) {
                return <div key={block.key} className={block.heightClass} />;
              }
              return renderSlotBlock(block.ad, block.heightClass, block.label, block.key, block.forceStyle);
            })}
          </div>
        </div>

        {/* Right column: Layout Selection Grid */}
        <div className="flex-1 w-full space-y-2.5">
          <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">
            {language === 'es' ? 'Seleccionar Tamaño/Posición' : 'Select Size/Position'}
          </h5>
          {layoutsToBook.length === 0 ? (
            <div className="p-4 bg-white border border-slate-250 rounded-xl text-xs text-slate-500 text-center">
              {language === 'es' ? 'No hay más espacio disponible para reservar en esta página.' : 'No further space available for reservation on this page.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
              {layoutsToBook.map((layout, idx) => {
                const isSelected = selectedProductId === layout.id.toString() && (
                  graphicalSelectedSlot === layout.slots[0] || 
                  (layout.slots.length === 2 && graphicalSelectedSlot === (layout.slots[0] === 'top' ? 'top_middle' : 'middle_bottom')) ||
                  (layout.slots.length === 3 && graphicalSelectedSlot === 'full')
                );
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onMouseEnter={() => setHoveredLayoutSlots(layout.slots)}
                    onMouseLeave={() => setHoveredLayoutSlots([])}
                    onClick={() => {
                      let sKey = layout.slots[0];
                      if (layout.slots.length === 2) {
                        sKey = layout.slots[0] === 'top' ? 'top_middle' : 'middle_bottom';
                      } else if (layout.slots.length === 3) {
                        sKey = 'full';
                      }
                      
                      setSelectedProductId(layout.id.toString());
                      setGraphicalSelectedSlot(sKey);
                      setTimeout(() => {
                        setCollapsedPreview(true);
                      }, 400);
                    }}
                    className={`p-2.5 border rounded-xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected 
                        ? 'border-green-600 bg-green-50 text-green-950 shadow-sm font-bold ring-2 ring-green-100 scale-[1.01]' 
                        : 'border-slate-200 bg-white text-slate-700 hover:border-green-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center w-full gap-2">
                      <span className="text-xs font-bold truncate">{layout.name}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        isSelected ? 'bg-green-200 text-green-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {layout.price}€
                      </span>
                    </div>
                    <span className="text-[10px] opacity-75 mt-1 truncate max-w-full font-normal">{layout.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-100 shadow-sm relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">
          {selectedPage.page_number === 'Unassigned' 
            ? t('rp_title_new')
            : `${t('rp_title_page')} ${selectedPage.page_number} ${t('rp_title_page_selected')}`
          }
        </h3>
        <div className="flex items-center gap-3">
          {selectedPage.page_number !== 'Unassigned' && (
            <span className={`px-2 py-1 text-xs font-bold rounded-md ${selectedPage.status === 'Reserved' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {selectedPage.status === 'Reserved' 
                ? t('status_reserved') 
                : (selectedPage.status === 'Available' ? t('po_available') : selectedPage.status)}
            </span>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {selectedPage.page_number !== 'Unassigned' && (
        collapsedPreview && graphicalSelectedSlot ? (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              {renderMiniPageGraphic(graphicalSelectedSlot)}
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block leading-none mb-1">
                  {language === 'es' ? 'Distribución Visual' : 'Visual Page Distribution'}
                </span>
                <span className="text-xs text-slate-800 font-bold">
                  {getSlotLabel(graphicalSelectedSlot)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsedPreview(false)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2.5 py-1.5 rounded bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm"
            >
              {language === 'es' ? 'Editar' : 'Edit'}
            </button>
          </div>
        ) : (
          renderVisualPagePreview()
        )
      )}
      
      {/* Choice Selector Mode */}
      {activeViewMode === 'select_mode' && (
        <div className="space-y-6 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-sm">
            <p className="font-semibold">
              {language === 'es' 
                ? 'Esta página está parcialmente ocupada, pero aún queda espacio publicitario disponible.' 
                : 'This page is partially occupied, but there is still advertising space available.'}
            </p>
            <p className="text-xs mt-1 text-blue-700">
              {language === 'es'
                ? 'Seleccione una de las siguientes opciones para continuar:'
                : 'Select one of the following options to continue:'}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A */}
            <button
              onClick={() => setActiveViewModeAndLock('process_clients')}
              className="flex flex-col items-center justify-center p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-xl transition-all shadow-sm group text-center cursor-pointer font-sans"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                <span className="font-bold text-lg font-mono">A</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2">
                {language === 'es' ? 'Procesar estado de clientes' : 'Process customer status'}
              </h4>
              <p className="text-xs text-gray-500 max-w-[200px]">
                {language === 'es' 
                  ? 'Gestionar el estado, pagos y facturación de los clientes que ya tienen espacio reservado en esta página.'
                  : 'Manage status, payments, and billing for customers who already have space reserved on this page.'}
              </p>
            </button>
            
            {/* Option B */}
            <button
              onClick={() => setActiveViewModeAndLock('new_reservation')}
              className="flex flex-col items-center justify-center p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-orange-500 rounded-xl transition-all shadow-sm group text-center cursor-pointer font-sans"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-4 group-hover:scale-110 transition-transform">
                <span className="font-bold text-lg font-mono">B</span>
              </div>
              <h4 className="font-bold text-gray-800 mb-2">
                {language === 'es' ? 'Venta espacio restante' : 'Sell remaining space'}
              </h4>
              <p className="text-xs text-gray-500 max-w-[200px]">
                {language === 'es'
                  ? 'Crear una nueva reserva para ocupar el espacio publicitario que queda disponible en esta página.'
                  : 'Create a new reservation to occupy the remaining advertising space available on this page.'}
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Option A: Process Clients Mode */}
      {activeViewMode === 'process_clients' && (
        <div className="space-y-6">
          {/* Back button to choose options if both options are available */}
          {selectedPage.ads && selectedPage.ads.length > 0 && availableProducts.length > 0 && (
            <button
              onClick={() => setActiveViewModeAndLock('select_mode')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 mb-2 cursor-pointer"
            >
              &larr; {language === 'es' ? 'Volver a opciones' : 'Back to options'}
            </button>
          )}

          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3">
              {language === 'es' 
                ? 'Seleccione el cliente para procesar su estado o finalizar venta:' 
                : 'Select the customer to process status or finalize sale:'}
            </h4>
            
            <div className="space-y-3">
              {selectedPage.ads.map((ad, idx) => {
                const c = customers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
                const cName = c ? (c.commercial_name || c.fiscal_name) : (ad.customer_name || t('rp_legacy_customer') || 'Legacy Customer');
                const isSelected = selectedAdIndex === idx;
                
                // Determine status badge colors
                let statusLabel = '';
                let statusClass = '';
                if (ad.isPreReserved) {
                  const isExpired = ad.expires_at && new Date() > new Date(ad.expires_at);
                  statusLabel = isExpired 
                    ? (language === 'es' ? 'Pre-reserva Expirada' : 'Pre-reservation Expired') 
                    : (language === 'es' ? 'Pre-reserva Activa' : 'Pre-reservation Active');
                  statusClass = isExpired ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800';
                } else if (ad.isPaid) {
                  statusLabel = language === 'es' ? 'Pagado' : 'Paid';
                  statusClass = 'bg-green-100 text-green-800';
                } else {
                  statusLabel = language === 'es' ? 'Reservado (Pte. Pago)' : 'Reserved (Pending Payment)';
                  statusClass = 'bg-blue-100 text-blue-800';
                }

                return (
                  <div 
                    key={idx}
                    onClick={() => setSelectedAdIndex(isSelected ? null : idx)}
                    className={`p-4 border rounded-xl transition-all cursor-pointer flex items-center gap-4 ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // onClick handles toggle
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer shrink-0"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 truncate">{cName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{ad.ad_type}</span>
                        {ad.expires_at && (
                          <span className="opacity-80 font-mono text-gray-400">
                            (Exp: {new Date(ad.expires_at).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <span className={`text-xs font-semibold px-2 py-1 rounded shrink-0 ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Process details panel for the selected ad */}
          {selectedAdIndex !== null && selectedPage.ads[selectedAdIndex] && (
            (() => {
              const ad = selectedPage.ads[selectedAdIndex];
              const c = customers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
              const customerName = c ? (c.commercial_name || c.fiscal_name) : (ad.customer_name || 'Legacy');
              
              // detailed actions for this selected reservation
              return (
                <div className="p-5 border border-blue-200 bg-blue-50/30 rounded-xl space-y-4 animate-in slide-in-from-top-4 duration-200">
                  <div className="flex justify-between items-start pb-3 border-b border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900 text-base">{customerName}</h4>
                      <p className="text-xs text-gray-500">{ad.ad_type} - {language === 'es' ? `Página ${selectedPage.page_number}` : `Page ${selectedPage.page_number}`}</p>
                    </div>
                    {ad.isPaid && (
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-md">
                        {language === 'es' ? 'Venta Finalizada' : 'Sale Finalized'}
                      </span>
                    )}
                  </div>
                  
                  {/* Actions for Pre-Reservations */}
                  {ad.isPreReserved && (
                    <div className="space-y-3">
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                        {language === 'es' 
                          ? 'Esta es una pre-reserva temporal. Para finalizar la venta y registrar el cobro, haga clic en Confirmar y Facturar.' 
                          : 'This is a temporary pre-reservation. To finalize the sale and record payment, click Confirm & Invoice.'}
                      </p>
                      
                      {resolvingAdIndex === selectedAdIndex ? (
                        <div className="flex gap-2 items-center bg-white p-3 rounded-lg border border-gray-200">
                          <input 
                            type="date" 
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1" 
                            value={prolongDate} 
                            onChange={e => setProlongDate(e.target.value)} 
                          />
                          <button 
                            onClick={() => handleResolveAction(ad, selectedAdIndex, 'prolong')} 
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-bold rounded transition-colors cursor-pointer"
                          >
                            {t('save')}
                          </button>
                          <button 
                            onClick={() => setResolvingAdIndex(null)} 
                            className="text-gray-500 hover:text-gray-700 text-xs px-2 cursor-pointer"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button 
                            onClick={() => handleResolveAction(ad, selectedAdIndex, 'cancel')} 
                            className="flex-1 py-2 px-3 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
                          >
                            {language === 'es' ? 'Liberar/Cancelar Pre-reserva' : 'Liberate/Cancel Pre-reservation'}
                          </button>
                          <button 
                            onClick={() => setResolvingAdIndex(selectedAdIndex)} 
                            className="flex-1 py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            {language === 'es' ? 'Prolongar Fecha' : 'Prolong Date'}
                          </button>
                          <button 
                            onClick={() => handleOpenPreBilling(ad, selectedAdIndex)} 
                            className="flex-1 py-2 px-3 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>⚡</span> {language === 'es' ? 'Confirmar y Facturar' : 'Confirm & Invoice'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions for Regular Reserved but Unpaid */}
                  {!ad.isPreReserved && !ad.isPaid && (
                    <div className="space-y-3">
                      <p className="text-xs text-blue-800 bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        {language === 'es' 
                          ? 'Esta reserva está confirmada pero pendiente de pago. Seleccione el método para confirmar el cobro.' 
                          : 'This reservation is confirmed but pending payment. Select method to confirm collection.'}
                      </p>
                      
                      {(() => {
                        const matchingInvoice = invoices.find(inv => 
                          inv.assignedPage === selectedPage.page_number && 
                          inv.customerName === customerName &&
                          inv.productName === ad.ad_type &&
                          inv.status !== 'Cancelled'
                        );
                        
                        const handleConfirmCloseSale = async () => {
                          if (matchingInvoice) {
                            setIsSaving(true);
                            try {
                              await updateInvoicePayment(matchingInvoice.id, closeSalePaymentMethod, true);
                              alert(language === 'es' ? 'Pago registrado y venta finalizada con éxito.' : 'Payment registered and sale finalized successfully.');
                              if (onReservationComplete) onReservationComplete();
                            } catch (err) {
                              console.error(err);
                              alert(language === 'es' ? 'Error al actualizar el pago' : 'Error updating payment');
                            } finally {
                              setIsSaving(false);
                            }
                          } else {
                            await handleConfirmSale(ad, closeSalePaymentMethod);
                          }
                        };

                        return (
                          <div className="space-y-3">
                            {matchingInvoice ? (
                              <div className="bg-white p-3 rounded-lg border border-gray-200 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-550">{language === 'es' ? 'Factura:' : 'Invoice:'}</span>
                                  <span className="font-mono font-bold text-gray-800">{matchingInvoice.id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-550">{language === 'es' ? 'Total Factura:' : 'Total Invoice:'}</span>
                                  <span className="font-bold text-gray-900">{matchingInvoice.total.toFixed(2)}€</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-red-600 bg-red-50/50 p-2 rounded border border-red-100">
                                {language === 'es' 
                                  ? '⚠️ No se encontró factura activa para esta reserva. Al confirmar se generará la factura correspondiente.'
                                  : '⚠️ No active invoice found for this reservation. Confirming will generate the corresponding invoice.'}
                              </p>
                            )}

                            {/* Confirmar venta Card */}
                            <div className="border border-blue-200 bg-white p-4 rounded-xl space-y-3 shadow-sm my-1">
                              <h5 className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                                <span>🛒</span> {language === 'es' ? 'Confirmar venta' : 'Confirm sale'}
                              </h5>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-700 block">
                                  {language === 'es' ? 'Cliente ha pagado:' : 'Customer has paid:'}
                                </label>
                                <div className="flex gap-4">
                                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                                    <input
                                      type="radio"
                                      name="closeSaleMethod"
                                      value="Cash"
                                      checked={closeSalePaymentMethod === 'Cash'}
                                      onChange={() => setCloseSalePaymentMethod('Cash')}
                                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span>{language === 'es' ? 'Efectivo' : 'Cash'}</span>
                                  </label>
                                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                                    <input
                                      type="radio"
                                      name="closeSaleMethod"
                                      value="Transfer"
                                      checked={closeSalePaymentMethod === 'Transfer'}
                                      onChange={() => setCloseSalePaymentMethod('Transfer')}
                                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <span>{language === 'es' ? 'Transferencia' : 'Transfer'}</span>
                                  </label>
                                </div>
                              </div>
                              <button
                                onClick={handleConfirmCloseSale}
                                disabled={isSaving}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm text-center flex items-center justify-center gap-1 font-sans"
                              >
                                {isSaving 
                                  ? (language === 'es' ? 'Confirmando...' : 'Confirming...') 
                                  : (language === 'es' ? 'Confirmar' : 'Confirm')}
                              </button>
                            </div>

                            {matchingInvoice && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleSendEmail(matchingInvoice, false, false, true)}
                                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  ✉️ {language === 'es' ? 'Enviar por Email' : 'Send by Email'}
                                </button>
                                <a 
                                  href={`https://wa.me/${(matchingInvoice.customerPhone || c?.whatsapp || c?.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(getInvoiceWhatsAppMessage(matchingInvoice, templates))}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  💬 WhatsApp
                                </a>
                              </div>
                            )}
                            
                            <button 
                              onClick={() => handleDeleteAd(selectedAdIndex)}
                              className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors mt-1 cursor-pointer"
                            >
                              {language === 'es' ? 'Liberar/Cancelar Reserva' : 'Liberate/Cancel Reservation'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Actions for Paid Reservations */}
                  {ad.isPaid && (
                    <div className="space-y-3">
                      <p className="text-xs text-green-800 bg-green-50 border border-green-200 p-3 rounded-lg">
                        {language === 'es' 
                          ? 'Esta venta está completada y pagada. Puede ver los detalles de la factura o enviar recordatorios.' 
                          : 'This sale is completed and paid. You can view invoice details or send reminders.'}
                      </p>
                      
                      {(() => {
                        const matchingInvoice = invoices.find(inv => 
                          inv.assignedPage === selectedPage.page_number && 
                          inv.customerName === customerName &&
                          inv.productName === ad.ad_type &&
                          inv.status !== 'Cancelled'
                        );
                        
                        return (
                          <div className="space-y-2">
                            {matchingInvoice && (
                              <div className="bg-white p-3 rounded-lg border border-gray-250 text-xs space-y-1 mb-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">{language === 'es' ? 'Factura ID:' : 'Invoice ID:'}</span>
                                  <span className="font-mono font-bold text-gray-800">{matchingInvoice.id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-550">{language === 'es' ? 'Método Pago:' : 'Payment Method:'}</span>
                                  <span className="font-bold text-gray-800">{matchingInvoice.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-550">{language === 'es' ? 'Total Pagado:' : 'Total Paid:'}</span>
                                  <span className="font-bold text-emerald-700">{matchingInvoice.total.toFixed(2)}€</span>
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2">
                              {matchingInvoice && (
                                <>
                                  <button 
                                    onClick={() => handleSendEmail(matchingInvoice, false, false, true)}
                                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                  >
                                    ✉️ {language === 'es' ? 'Reenviar Email' : 'Resend Email'}
                                  </button>
                                  <a 
                                    href={`https://wa.me/${(matchingInvoice.customerPhone || c?.whatsapp || c?.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(getInvoiceWhatsAppMessage(matchingInvoice, templates))}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    💬 Reenviar WhatsApp
                                  </a>
                                </>
                              )}
                            </div>
                            
                            <button 
                              onClick={() => handleDeleteAd(selectedAdIndex)}
                              className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors mt-2 cursor-pointer"
                            >
                              {language === 'es' ? 'Liberar/Cancelar Reserva' : 'Liberate/Cancel Reservation'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* Option B: Standard New Reservation Screen */}
      {activeViewMode === 'new_reservation' && (
        <>
          {/* Back button to choose options if both options are available */}
          {selectedPage.ads && selectedPage.ads.length > 0 && availableProducts.length > 0 && (
            <button
              onClick={() => setActiveViewModeAndLock('select_mode')}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 mb-4 cursor-pointer"
            >
              &larr; {language === 'es' ? 'Volver a opciones' : 'Back to options'}
            </button>
          )}
          {preReservedAds.length > 0 && (
        <div className="space-y-4">
          {hasExpired ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900">
              <h4 className="font-bold flex items-center gap-2 mb-2">
                <span className="text-xl leading-none">⚠️</span> {t('rp_expired_title')}
              </h4>
              <p className="text-sm">{t('rp_expired_desc')}</p>
            </div>
          ) : (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-900">
              <h4 className="font-bold flex items-center gap-2 mb-2">
                <span className="text-xl leading-none">⏱️</span> {t('rp_active_title')}
              </h4>
              <p className="text-sm">{t('rp_active_desc')}</p>
            </div>
          )}
          
          <div className="space-y-4">
            {preReservedAds.map((ad, idx) => {
              const isAdExpired = ad.expires_at && new Date() > new Date(ad.expires_at);
              return (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-gray-900">{ad.customer_name}</div>
                    <div className="text-sm text-gray-500">{ad.ad_type}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${isAdExpired ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>
                    {isAdExpired ? t('rp_status_expired') : t('rp_status_pending')}
                  </span>
                </div>
                
                {resolvingAdIndex === idx ? (
                  <div className="flex gap-2 items-center mt-3">
                    <input type="date" className="border rounded px-2 py-1 text-sm flex-1" value={prolongDate} onChange={e => setProlongDate(e.target.value)} />
                    <button onClick={() => handleResolveAction(ad, idx, 'prolong')} className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700">{t('save')}</button>
                    <button onClick={() => setResolvingAdIndex(null)} className="text-gray-500 hover:text-gray-700 text-sm px-2">{t('cancel')}</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleResolveAction(ad, idx, 'cancel')} className="flex-1 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors">
                      {t('rp_liberate')}
                    </button>
                    <button onClick={() => setResolvingAdIndex(idx)} className="flex-1 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors">
                      {t('rp_prolong')}
                    </button>
                    <button onClick={() => handleOpenPreBilling(ad, idx)} className="flex-1 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                      {t('rp_confirm_red')}
                    </button>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      {availableProducts.length > 0 ? (
        <div className="space-y-4">
          <div className="pt-4 mt-2 border-t border-gray-100">
            <h4 className="font-bold text-gray-800 mb-4">{t('rp_add_new_reservation')}</h4>
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('rp_customer')}</label>
              <div className="flex gap-2 items-center w-full">
                <div className="relative flex-1" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm text-left flex items-center justify-between bg-white min-h-[38px]"
                  >
                    <span className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
                      {!selectedCustomerId ? (
                        <span className="text-gray-400">{t('rp_select_customer')}</span>
                      ) : selectedCustomerId === 'new' ? (
                        <span className="text-blue-600 font-bold">{t('rp_new_customer')}</span>
                      ) : (() => {
                        const c = customers.find(cust => (cust.id || cust.nif) === selectedCustomerId);
                        if (!c) return <span className="text-gray-400">{t('rp_select_customer')}</span>;
                        const status = getCustomerStatus(c);
                        return (
                          <>
                            {status === 'ok' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-green-500 text-white shrink-0">OK</span>}
                            {status === 'recibo' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-emerald-600 text-white shrink-0">Recibo</span>}
                            {status === 'pt' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-blue-600 text-white shrink-0">TP</span>}
                            {status?.startsWith('pr:') && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-orange-500 text-white shrink-0">RESERVA TEMPORAL ({status.split(':')[1]})</span>}
                            <span className="truncate">{c.commercial_name || c.fiscal_name}</span>
                          </>
                        );
                      })()}
                    </span>
                    <span className="text-gray-400 ml-2 shrink-0">&#9660;</span>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-80 flex flex-col">
                      <div className="p-2 border-b border-gray-100 bg-gray-50 rounded-t-lg sticky top-0 z-10">
                        <input
                          type="text"
                          placeholder={t('rp_search_placeholder')}
                          value={customerSearchQuery}
                          onChange={(e) => setCustomerSearchQuery(e.target.value)}
                          className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto flex-1 max-h-56">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-3 text-sm text-gray-500 text-center">
                            {language === 'en' ? 'No customers found' : 'No se encontraron clientes'}
                          </div>
                        ) : (
                          filteredCustomers.map(c => {
                            const status = getCustomerStatus(c);
                            const val = c.id || c.nif;
                            return (
                              <div
                                key={val}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent input blur
                                  setSelectedCustomerId(val);
                                  setIsAddingNew(false);
                                  setDropdownOpen(false);
                                }}
                                className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 transition-colors ${selectedCustomerId === val ? 'bg-blue-50 font-medium' : ''}`}
                              >
                                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                  {status === 'ok' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-green-500 text-white shrink-0">OK</span>}
                                  {status === 'recibo' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-emerald-600 text-white shrink-0">Recibo</span>}
                                  {status === 'pt' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-blue-600 text-white shrink-0">TP</span>}
                                  {status?.startsWith('pr:') && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-orange-500 text-white shrink-0">RESERVA TEMPORAL ({status.split(':')[1]})</span>}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="truncate text-gray-800 font-medium">{c.commercial_name || c.fiscal_name}</span>
                                  {(() => {
                                    const details = [
                                      c.contact_name && `${language === 'es' ? 'Contacto' : 'Contact'}: ${c.contact_name}`,
                                      c.category && `${language === 'es' ? 'Cat' : 'Cat'}: ${c.category}`,
                                      c.whatsapp && `${language === 'es' ? 'Tel' : 'Tel'}: ${c.whatsapp}`,
                                      c.email && c.email,
                                      c.nif && `NIF: ${c.nif}`
                                    ].filter(Boolean);
                                    if (details.length === 0) return null;
                                    return (
                                      <span className="text-xs text-gray-400 truncate mt-0.5">
                                        {details.join(' • ')}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input blur
                          setSelectedCustomerId('new');
                          setIsAddingNew(true);
                          setDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-bold text-blue-600 border-t border-gray-100 hover:bg-blue-50 transition-colors sticky bottom-0 bg-white"
                      >
                        + {t('rp_new_customer')}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedCustomerId('new');
                    setIsAddingNew(true);
                    setDropdownOpen(false);
                  }}
                  className="shrink-0 p-2 text-xl leading-none bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold border border-blue-200 flex items-center justify-center w-10 h-10"
                  title="Add New Customer"
                >
                  +
                </button>
              </div>

              {selectedCustomerId && selectedCustomerId !== 'new' && !isAddingNew && (
                <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-start mb-2 border-b border-slate-200/60 pb-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {(() => {
                          const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                          return cust ? (cust.commercial_name || cust.fiscal_name) : '';
                        })()}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        NIF: {(() => {
                          const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                          return cust ? (cust.nif || '—') : '';
                        })()}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditingExisting) {
                          const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                          if (cust) {
                            setEditedCustomer({
                              fiscal_name: cust.fiscal_name || '',
                              commercial_name: cust.commercial_name || '',
                              nif: cust.nif || '',
                              contact_name: cust.contact_name || '',
                              email: cust.email || '',
                              whatsapp: cust.whatsapp || '',
                              address: cust.address || '',
                              category: cust.category || '',
                              last_year_product: cust.last_year_product || ''
                            });
                          }
                        }
                        setIsEditingExisting(!isEditingExisting);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      {isEditingExisting ? (language === 'es' ? 'Cancelar' : 'Cancel') : (language === 'es' ? 'Editar Datos' : 'Edit Details')}
                    </button>
                  </div>

                  {/* Warning if no contact info */}
                  {(() => {
                    const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                    const hasEmail = cust && cust.email;
                    const hasPhone = cust && cust.whatsapp;
                    if (!hasEmail && !hasPhone) {
                      return (
                        <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded border border-red-200 font-medium">
                          ⚠️ {language === 'es' 
                            ? 'Falta correo electrónico o teléfono. Es obligatorio para continuar con la reserva.' 
                            : 'Missing email or telephone. Required to proceed with reservation.'}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {isEditingExisting ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('commercial_name') || 'Commercial Name'}</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.commercial_name} onChange={e => setEditedCustomer({...editedCustomer, commercial_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('fiscal_name') || 'Fiscal Name'}</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.fiscal_name} onChange={e => setEditedCustomer({...editedCustomer, fiscal_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">NIF / CIF</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.nif} onChange={e => setEditedCustomer({...editedCustomer, nif: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('category') || 'Category'}</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.category} onChange={e => setEditedCustomer({...editedCustomer, category: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('contact_name') || 'Contact Name'}</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.contact_name} onChange={e => setEditedCustomer({...editedCustomer, contact_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('email') || 'Email'}</label>
                          <input type="email" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.email} onChange={e => setEditedCustomer({...editedCustomer, email: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('whatsapp') || 'WhatsApp'} / {t('phone') || 'Phone'}</label>
                          <input type="tel" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.whatsapp} onChange={e => setEditedCustomer({...editedCustomer, whatsapp: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('address') || 'Address'}</label>
                          <input type="text" className="w-full p-2 border border-slate-200 rounded text-xs" value={editedCustomer.address} onChange={e => setEditedCustomer({...editedCustomer, address: e.target.value})} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-500 mb-0.5">{t('last_year_product') || 'Last Year Product'}</label>
                          <textarea className="w-full p-2 border border-slate-200 rounded text-xs resize-none" rows="2" value={editedCustomer.last_year_product} onChange={e => setEditedCustomer({...editedCustomer, last_year_product: e.target.value})}></textarea>
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button 
                          type="button"
                          onClick={handleUpdateExistingCustomer}
                          disabled={isSavingCustomer}
                          className="px-3.5 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          {isSavingCustomer ? t('rp_saving') || 'Saving...' : (language === 'es' ? 'Guardar Cambios' : 'Save Changes')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 mt-1">
                      <div><span className="font-semibold text-slate-700">{t('email') || 'Email'}:</span> {(() => {
                        const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                        return cust && cust.email ? cust.email : '—';
                      })()}</div>
                      <div><span className="font-semibold text-slate-700">{t('whatsapp') || 'WhatsApp'}:</span> {(() => {
                        const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                        return cust && cust.whatsapp ? cust.whatsapp : '—';
                      })()}</div>
                      {(() => {
                        const cust = customers.find(c => c.id === selectedCustomerId || c.nif === selectedCustomerId);
                        return cust && cust.address ? (
                          <div className="sm:col-span-2"><span className="font-semibold text-slate-700">{t('address') || 'Address'}:</span> {cust.address}</div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              )}

              {isAddingNew && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('commercial_name') || 'Commercial Name'}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.commercial_name} onChange={e => setNewCustomer({...newCustomer, commercial_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('fiscal_name') || 'Fiscal Name'}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.fiscal_name} onChange={e => setNewCustomer({...newCustomer, fiscal_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">NIF / CIF</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.nif} onChange={e => setNewCustomer({...newCustomer, nif: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('category') || 'Category'}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.category} onChange={e => setNewCustomer({...newCustomer, category: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('contact_name') || 'Contact Name'}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.contact_name} onChange={e => setNewCustomer({...newCustomer, contact_name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('email') || 'Email'}</label>
                      <input type="email" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('whatsapp') || 'WhatsApp'} / {t('phone') || 'Phone'}</label>
                      <input type="tel" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.whatsapp} onChange={e => setNewCustomer({...newCustomer, whatsapp: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('address') || 'Address'}</label>
                      <input type="text" className="w-full p-2 border border-gray-300 rounded text-sm" value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('last_year_product') || 'Last Year Product'}</label>
                      <textarea className="w-full p-2 border border-gray-300 rounded text-sm resize-none" rows="2" value={newCustomer.last_year_product} onChange={e => setNewCustomer({...newCustomer, last_year_product: e.target.value})}></textarea>
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button 
                      type="button"
                      onClick={async () => {
                        if (!newCustomer.commercial_name || !newCustomer.email) {
                          alert(t('rp_alert_provide_name_email'));
                          return;
                        }
                        setIsSavingCustomer(true);
                        const nifToUse = newCustomer.nif || `UNKNOWN-${Date.now()}`;
                        const { data, error } = await safeInsertCustomer({
                          fiscal_name: newCustomer.fiscal_name,
                          commercial_name: newCustomer.commercial_name,
                          nif: nifToUse,
                          contact_name: newCustomer.contact_name,
                          email: newCustomer.email,
                          whatsapp: newCustomer.whatsapp,
                          address: newCustomer.address,
                          category: newCustomer.category,
                          last_year_product: newCustomer.last_year_product
                        });
                        setIsSavingCustomer(false);
                        
                        if (error) {
                          alert(t('rp_alert_save_cust_error') + error.message);
                        } else if (data && data.length > 0) {
                          setCustomers(prev => [...prev, data[0]]);
                          setSelectedCustomerId(data[0].id);
                          setIsAddingNew(false);
                        }
                      }}
                      disabled={isSavingCustomer}
                      className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingCustomer ? t('rp_saving_customer') : t('rp_save_customer')}
                    </button>
                  </div>
                </div>
              )}
            </div>
        
        {selectedPage.page_number === 'Unassigned' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('rp_assignment_pref')}</label>
            <select 
              value={assignmentPref}
              onChange={(e) => setAssignmentPref(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-indigo-50 text-indigo-900 border-indigo-200"
            >
              <option value="aleatorio">{t('rp_assign_random')}</option>
              <option value="par">{t('rp_assign_even')}</option>
              <option value="impar">{t('rp_assign_odd')}</option>
            </select>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-2">{t('rp_product')}</label>
          <select 
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>{t('rp_select_product')}</option>
            {availableProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} - {p.price}€
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">{t('rp_artwork')}</label>
          
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input type="radio" name="artwork" value="1" checked={artworkOption === '1'} onChange={(e) => setArtworkOption(e.target.value)} className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 group-hover:text-black transition-colors">{t('rp_art_opt1')}</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input type="radio" name="artwork" value="2" checked={artworkOption === '2'} onChange={(e) => setArtworkOption(e.target.value)} className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 group-hover:text-black transition-colors">{t('rp_art_opt2')}</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input type="radio" name="artwork" value="3" checked={artworkOption === '3'} onChange={(e) => setArtworkOption(e.target.value)} className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 group-hover:text-black transition-colors">{t('rp_art_opt3')}</span>
            </label>
            
            {artworkOption === '3' && (
              <div className="ml-6 pl-4 border-l-2 border-blue-200 space-y-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="designWork" value="1" checked={designWorkOption === '1'} onChange={(e) => setDesignWorkOption(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium text-gray-700">{t('rp_design_opt1')}</span>
                </label>
                {designWorkOption === '1' && (
                  <div className="ml-6 flex items-center gap-2 mb-2 animate-in fade-in">
                    <span className="text-sm font-bold text-gray-600">{t('rp_design_price')}</span>
                    <input 
                      type="number" 
                      placeholder={t('rp_price_placeholder')} 
                      value={designWorkPrice}
                      onChange={(e) => setDesignWorkPrice(e.target.value)}
                      className="px-3 py-1 text-sm border rounded outline-none focus:ring-1 focus:ring-blue-500 w-32"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="designWork" value="2" checked={designWorkOption === '2'} onChange={(e) => setDesignWorkOption(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{t('rp_design_opt2')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="designWork" value="3" checked={designWorkOption === '3'} onChange={(e) => setDesignWorkOption(e.target.value)} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">{t('rp_design_opt3')}</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            {t('cl_liberate_payment_method') || 'Payment Method'}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Transfer', key: 'rp_transfer', default: 'Transfer' },
              { id: 'Bizum', key: 'rp_bizum', default: 'Bizum' }
            ].map(method => (
              <button
                key={method.id}
                type="button"
                onClick={() => setReservationPaymentMethod(method.id)}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                  reservationPaymentMethod === method.id
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t(method.key) || method.default}
              </button>
            ))}
          </div>
        </div>

        {/* Efectivo — standalone action button that opens the sale-closing modal */}
        <button
          type="button"
          onClick={handleOpenEfectivoPreview}
          disabled={isSaving}
          className="w-full py-3 mb-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          💵 {language === 'es' ? 'Efectivo' : 'Cash Payment'}
        </button>

        <button 
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
        >
          {isSaving ? t('rp_saving') : (
            reservationPaymentMethod === 'Transfer' ? t('rp_btn_reserve_transfer') :
            reservationPaymentMethod === 'Bizum' ? (language === 'en' ? 'Reserve (Pending Bizum)' : 'Reservar (Bizum Pendiente)') :
            (language === 'en' ? 'Reserve (Pending Cash)' : 'Reservar (Efectivo Pendiente)')
          )}
        </button>
        
        <button 
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 mt-2"
        >
          {isSaving ? t('rp_saving') : t('rp_btn_prereserve')}
        </button>



        <button 
          onClick={handleRecibo}
          disabled={isSaving}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold rounded-lg transition-colors flex justify-center items-center gap-2 mt-2"
        >
          {isSaving ? t('rp_saving') : t('rp_btn_recibo')}
        </button>
      </div>
      </div>
    ) : (
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-gray-500 text-sm text-center font-medium">{t('rp_fully_booked')}</p>
      </div>
    )}

      {/* Show Current Occupants - MOVED OUTSIDE OF THE ADD NEW RESERVATION BLOCK SO IT ALWAYS SHOWS */}
      {selectedPage.page_number !== 'Unassigned' && selectedPage.ads && selectedPage.ads.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-bold text-gray-700 mb-2">{t('rp_current_occupants')} {selectedPage.page_number}:</h4>
          <div className="space-y-2">
            {selectedPage.ads.map((ad, idx) => {
              const c = customers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
              const cName = c ? (c.commercial_name || c.fiscal_name) : (ad.customer_name || t('rp_legacy_customer') || 'Legacy Customer');
              return (
                <div key={idx} className="bg-red-50 text-red-800 text-xs px-3 py-2 rounded border border-red-100 flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-medium mr-2">{cName}</span>
                    <span className="opacity-80">{ad.ad_type}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteAd(idx)}
                    className="text-red-400 hover:text-red-700 p-1.5 rounded-md hover:bg-red-100 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title={t('rp_delete_res')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}


      {/* Order Confirmation Modal Overlay */}
      {orderConfirmModalOpen && orderDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto relative my-auto animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => {
                setOrderConfirmModalOpen(false);
                if (onReservationComplete) onReservationComplete();
              }} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
              title={t('rp_order_close') || 'Close'}
            >
              <X size={24} />
            </button>
            <div className="text-center w-full flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-orange-100 mb-3 sm:mb-4 shrink-0">
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 leading-tight">{t('rp_order_confirmed')}</h2>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-left mb-3 sm:mb-4 border border-gray-100 w-full">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm text-gray-700">{t('rp_invoice_summary')}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_customer_label')}</span>
                    <span className="font-medium text-gray-900">{orderDetails.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_product_label')}</span>
                    <span className="font-medium text-gray-900">{orderDetails.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_assigned_page_label')}</span>
                    <span className="font-bold text-blue-600">{orderDetails.assignedPage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_order_id_label')}</span>
                    <span className="font-medium text-gray-600 text-xs">{orderDetails.id}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">{t('rp_base_price_label')}</span>
                    <span className="font-medium text-gray-900">{(orderDetails.price || 0).toFixed(2)}&#8364;</span>
                  </div>
                  {orderDetails.designPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{t('rp_design_price_label')}</span>
                      <span className="font-medium text-gray-900">{orderDetails.designPrice.toFixed(2)}&#8364;</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('cl_liberate_payment_method') || 'Payment Method'}</span>
                    <span className="font-medium text-gray-900">{t(`rp_${(orderDetails.paymentMethod || 'transfer').toLowerCase()}`) || orderDetails.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                    <span className="text-gray-600 font-medium">Subtotal</span>
                    <span className="text-gray-900 font-medium">{((orderDetails.price || 0) + (orderDetails.designPrice || 0)).toFixed(2)}&#8364;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">{t('inv_vat') || 'IVA (21%)'}</span>
                    <span className="font-medium text-gray-900">{(((orderDetails.price || 0) + (orderDetails.designPrice || 0)) * 0.21).toFixed(2)}&#8364;</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200 font-bold">
                    <span className="text-gray-700">{t('inv_total') || 'Total'}</span>
                    <span className="text-blue-600">{(((orderDetails.price || 0) + (orderDetails.designPrice || 0)) * 1.21).toFixed(2)}&#8364;</span>
                  </div>
                </div>
              </div>

              {/* Manual Send Confirmation options */}
              <div className="mt-3 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left w-full">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-2 sm:mb-3">{language === 'es' ? 'Enviar Confirmación' : 'Send Confirmation'}</h4>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={!orderDetails.customerEmail || emailStatus.sending}
                    onClick={() => handleSendEmail(orderDetails, orderDetails.orderType === 'pre-reserved', false)}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors border flex items-center justify-center gap-2 ${
                      emailStatus.status === 'success'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 disabled:opacity-50'
                    }`}
                  >
                    {emailStatus.status === 'success' 
                      ? (language === 'es' ? '✓ Email Enviado' : '✓ Email Sent') 
                      : (emailStatus.sending ? (language === 'es' ? 'Enviando...' : 'Sending...') : '📧 Enviar Email')}
                  </button>

                  <a
                    href={`https://wa.me/${(orderDetails.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(getOrderWhatsAppMessage(orderDetails, language, templates))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-green-50 hover:bg-green-100 text-green-750 border border-green-300 transition-colors flex items-center justify-center gap-2 text-center"
                  >
                    📲 WhatsApp
                  </a>
                </div>

                {emailStatus.status === 'error' && (
                  <p className="text-[11px] text-red-600 font-medium mt-2">
                    ❌ Error: {emailStatus.error}
                  </p>
                )}
              </div>

              <div className="mb-3 p-2.5 bg-orange-50 rounded-lg border border-orange-200 text-left w-full">
                <p className="text-xs text-orange-800 font-medium leading-normal">&#9203; {t('rp_order_pending_msg')}</p>
              </div>

              <button
                onClick={() => {
                  setOrderConfirmModalOpen(false);
                  if (onReservationComplete) onReservationComplete();
                }}
                className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                {t('rp_order_close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── EFECTIVO PRE-SALE PREVIEW MODAL ── */}
      {efectivoPreviewOpen && invoiceDetails && invoiceDetails._preview && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[115] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92dvh] overflow-y-auto relative my-auto animate-in zoom-in-95 duration-200">
            
            {/* Close button */}
            <button
              onClick={() => setEfectivoPreviewOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
              title={language === 'es' ? 'Cancelar' : 'Cancel'}
            >
              <X size={22} />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <span className="text-2xl">💵</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {language === 'es' ? 'Cobrar en Efectivo' : 'Charge in Cash'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {language === 'es'
                  ? 'Revisa el resumen antes de cerrar la venta y generar la factura.'
                  : 'Review the summary before closing the sale and generating the invoice.'}
              </p>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between pb-2 border-b border-gray-200">
                <span className="text-gray-500 font-medium">{language === 'es' ? 'Cliente' : 'Customer'}</span>
                <span className="font-semibold text-gray-900">{invoiceDetails.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">{language === 'es' ? 'Producto' : 'Product'}</span>
                <span className="font-semibold text-gray-900">{invoiceDetails.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">{language === 'es' ? 'Página' : 'Page'}</span>
                <span className="font-bold text-blue-600">
                  {invoiceDetails.assignedPage === 'Unassigned'
                    ? (language === 'es' ? 'Auto-asignada' : 'Auto-assigned')
                    : `P${invoiceDetails.assignedPage}`}
                </span>
              </div>

              {/* Price breakdown */}
              <div className="pt-2 mt-1 border-t border-gray-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">{language === 'es' ? 'Base' : 'Base price'}</span>
                  <span className="text-gray-800">{invoiceDetails.price.toFixed(2)} €</span>
                </div>
                {invoiceDetails.designPrice > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{language === 'es' ? 'Diseño' : 'Design'}</span>
                    <span className="text-gray-800">{invoiceDetails.designPrice.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">IVA (21%)</span>
                  <span className="text-gray-800">{invoiceDetails.vat.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-base">
                  <span className="text-gray-800">TOTAL</span>
                  <span className="text-emerald-600">{invoiceDetails.total.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-5 text-sm text-emerald-800 font-medium">
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
              {language === 'es' ? 'Factura PAGADA — estado: Pagado' : 'Invoice PAID — status: Paid'}
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleConfirmEfectivoSale}
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-bold rounded-xl shadow transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isSaving
                  ? (language === 'es' ? 'Generando factura…' : 'Generating invoice…')
                  : (language === 'es' ? '✔ Confirmar y Generar Factura' : '✔ Confirm & Generate Invoice')}
              </button>
              <button
                type="button"
                onClick={() => setEfectivoPreviewOpen(false)}
                disabled={isSaving}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREPARACIÓN FACTURACIÓN MODAL ── */}
      {preBillingModalOpen && preBillingAd && (
        (() => {
          const prod = products.find(p => p.name === preBillingAd.ad_type);
          const basePrice = prod ? parseFloat(prod.price) : 0;
          const designPrice = parseFloat(preBillingAd.designWorkPrice) || 0;
          const subtotal = basePrice + designPrice;
          const vat = subtotal * 0.21;
          const total = subtotal * 1.21;

          return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[115] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92dvh] overflow-y-auto relative my-auto animate-in zoom-in-95 duration-200">
                
                {/* Close button */}
                <button
                  onClick={() => setPreBillingModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
                  title={language === 'es' ? 'Cancelar' : 'Cancel'}
                >
                  <X size={22} />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {language === 'es' ? 'Preparación facturación' : 'Billing Preparation'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {language === 'es'
                      ? 'Seleccione el método de pago para confirmar la reserva y generar la factura.'
                      : 'Select the payment method to confirm the reservation and generate the invoice.'}
                  </p>
                </div>

                {/* Summary Card */}
                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between pb-2 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">{language === 'es' ? 'Cliente' : 'Customer'}</span>
                    <span className="font-semibold text-gray-900">{preBillingAd.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">{language === 'es' ? 'Producto' : 'Product'}</span>
                    <span className="font-semibold text-gray-900">{preBillingAd.ad_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">{language === 'es' ? 'Página' : 'Page'}</span>
                    <span className="font-bold text-blue-600">
                      P{selectedPage.page_number}
                    </span>
                  </div>

                  {/* Price breakdown */}
                  <div className="pt-2 mt-1 border-t border-gray-200 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{language === 'es' ? 'Base' : 'Base price'}</span>
                      <span className="text-gray-800">{basePrice.toFixed(2)} €</span>
                    </div>
                    {designPrice > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">{language === 'es' ? 'Diseño' : 'Design'}</span>
                        <span className="text-gray-800">{designPrice.toFixed(2)} €</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">IVA (21%)</span>
                      <span className="text-gray-800">{vat.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-base">
                      <span className="text-gray-800">TOTAL</span>
                      <span className="text-blue-600">{total.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>

                {/* Pago Realizado Section */}
                <div className="mb-5">
                  <span className="block text-sm font-bold text-gray-700 mb-3 text-center">
                    {language === 'es' ? 'Pago realizado:' : 'Payment made:'}
                  </span>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleConfirmPreReservation(preBillingAd, 'Cash')}
                      disabled={isSaving}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      💵 {language === 'es' ? 'Efectivo' : 'Cash'}
                    </button>
                    
                    <button
                      onClick={() => handleConfirmPreReservation(preBillingAd, 'Transfer')}
                      disabled={isSaving}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-300 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      🏦 {language === 'es' ? 'Transferencia' : 'Transfer'}
                    </button>
                  </div>
                </div>

                {/* Cancel/Close Button */}
                <button
                  type="button"
                  onClick={() => setPreBillingModalOpen(false)}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-semibold rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>

              </div>
            </div>
          );
        })()
      )}

      {/* Invoice Success Modal Overlay */}
      {invoiceModalOpen && invoiceDetails && !invoiceDetails._preview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto relative my-auto animate-in zoom-in-95 duration-200">
            <button 
              onClick={handleCloseInvoice} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
              title={language === 'es' ? 'Cerrar' : 'Close'}
            >
              <X size={24} />
            </button>
            <div className="text-center w-full flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-100 mb-3 sm:mb-4 shrink-0">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 leading-tight">
                {language === 'es' ? 'Factura Generada' : 'Invoice Generated'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
                {invoiceDetails.paymentMethod === 'Cash' 
                  ? (language === 'es' ? 'Venta completada con IVA en efectivo' : 'Sale completed in cash with VAT') 
                  : (language === 'es' ? 'Venta completada con IVA por transferencia' : 'Sale completed by transfer with VAT')}
              </p>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-left mb-3 sm:mb-4 border border-gray-100 w-full">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm text-gray-700">
                    {language === 'es' ? 'Detalles de la Factura' : 'Invoice Details'}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_customer_label')}</span>
                    <span className="font-medium text-gray-900">{invoiceDetails.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_product_label')}</span>
                    <span className="font-medium text-gray-900">{invoiceDetails.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_assigned_page_label')}</span>
                    <span className="font-bold text-blue-600">{invoiceDetails.assignedPage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{language === 'es' ? 'Número Factura' : 'Invoice Number'}</span>
                    <span className="font-bold text-gray-800 font-mono">{invoiceDetails.id}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">{t('rp_base_price_label')}</span>
                    <span className="font-medium text-gray-900">{invoiceDetails.price.toFixed(2)}€</span>
                  </div>
                  {invoiceDetails.designPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{t('rp_design_price_label')}</span>
                      <span className="font-medium text-gray-900">{invoiceDetails.designPrice.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                    <span className="text-gray-500">{language === 'es' ? 'Subtotal' : 'Subtotal'}</span>
                    <span className="font-medium text-gray-900">{(invoiceDetails.price + invoiceDetails.designPrice).toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{language === 'es' ? 'IVA (21%)' : 'VAT (21%)'}</span>
                    <span className="font-medium text-gray-900">{invoiceDetails.vat.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-emerald-700 text-xs font-semibold uppercase tracking-wide">
                      {invoiceDetails.paymentMethod === 'Cash' 
                        ? (language === 'es' ? 'Total (Efectivo)' : 'Total (Cash)') 
                        : (language === 'es' ? 'Total (Transferencia)' : 'Total (Transfer)')}
                    </span>
                    <span className="font-bold text-emerald-700 text-lg">{invoiceDetails.total.toFixed(2)}€</span>
                  </div>
                </div>
              </div>

              {/* Manual Send Confirmation options */}
              <div className="mt-3 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left w-full">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-2 sm:mb-3">
                  {language === 'es' ? 'Enviar Confirmación' : 'Send Confirmation'}
                </h4>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={!invoiceDetails.customerEmail || emailStatus.sending}
                    onClick={() => handleSendEmail(invoiceDetails, false, false, true)}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors border flex items-center justify-center gap-2 ${
                      emailStatus.status === 'success'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 disabled:opacity-50'
                    }`}
                  >
                    {emailStatus.status === 'success' 
                      ? (language === 'es' ? '✓ Email Enviado' : '✓ Email Sent') 
                      : (emailStatus.sending ? (language === 'es' ? 'Enviando...' : 'Sending...') : '📧 Enviar Email')}
                  </button>

                  <a
                    href={`https://wa.me/${(invoiceDetails.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(getInvoiceWhatsAppMessage(invoiceDetails, templates))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-green-50 hover:bg-green-100 text-green-750 border border-green-300 transition-colors flex items-center justify-center gap-2 text-center"
                  >
                    📲 WhatsApp
                  </a>
                </div>

                {emailStatus.status === 'error' && (
                  <p className="text-[11px] text-red-600 font-medium mt-2">
                    ❌ Error: {emailStatus.error}
                  </p>
                )}
              </div>

              <button 
                onClick={handleCloseInvoice}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                {language === 'es' ? 'Confirmar y Cerrar' : 'Confirm and Close'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Recibo Success Modal Overlay */}
      {reciboModalOpen && reciboDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92dvh] sm:max-h-[85dvh] overflow-y-auto relative my-auto animate-in zoom-in-95 duration-200">
            <button 
              onClick={handleConfirmReciboAndClose} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
              title={t('rp_recibo_confirm_close') || 'Close'}
            >
              <X size={24} />
            </button>
            <div className="text-center w-full flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-100 mb-3 sm:mb-4 shrink-0">
                <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 leading-tight">{t('rp_recibo_title')}</h2>
              <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">{t('rp_recibo_subtitle')}</p>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-left mb-3 sm:mb-4 border border-gray-100 w-full">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-sm text-gray-700">{t('rp_recibo_summary')}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_customer_label')}</span>
                    <span className="font-medium text-gray-900">{reciboDetails.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_product_label')}</span>
                    <span className="font-medium text-gray-900">{reciboDetails.productName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_assigned_page_label')}</span>
                    <span className="font-bold text-blue-600">{reciboDetails.assignedPage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('rp_date_label')}</span>
                    <span className="font-medium text-gray-900">{reciboDetails.date}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-gray-200">
                    <span className="text-gray-500 font-medium">{t('rp_base_price_label')}</span>
                    <span className="font-medium text-gray-900">{reciboDetails.price.toFixed(2)}€</span>
                  </div>
                  {reciboDetails.designPrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-medium">{t('rp_design_price_label')}</span>
                      <span className="font-medium text-gray-900">{reciboDetails.designPrice.toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                    <span className="text-emerald-700 text-xs font-semibold uppercase tracking-wide">{t('rp_recibo_no_vat')}</span>
                    <span className="font-bold text-emerald-700 text-base">{reciboDetails.total.toFixed(2)}€</span>
                  </div>

                  <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600 leading-relaxed font-medium">
                    💬 {getReciboWhatsAppMessageLocal(reciboDetails, templates)}
                  </div>
                </div>
              </div>

              {/* Manual Send Confirmation options */}
              <div className="mt-3 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left w-full">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-2 sm:mb-3">{language === 'es' ? 'Enviar Confirmación' : 'Send Confirmation'}</h4>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={!reciboDetails.customerEmail || emailStatus.sending}
                    onClick={() => handleSendEmail(reciboDetails, false, true)}
                    className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-colors border flex items-center justify-center gap-2 ${
                      emailStatus.status === 'success'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 disabled:opacity-50'
                    }`}
                  >
                    {emailStatus.status === 'success' 
                      ? (language === 'es' ? '✓ Email Enviado' : '✓ Email Sent') 
                      : (emailStatus.sending ? (language === 'es' ? 'Enviando...' : 'Sending...') : '📧 Enviar Email')}
                  </button>

                  <a
                    href={`https://wa.me/${(reciboDetails.customerPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(getReciboWhatsAppMessageLocal(reciboDetails, templates))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-green-50 hover:bg-green-100 text-green-750 border border-green-300 transition-colors flex items-center justify-center gap-2 text-center"
                  >
                    📲 WhatsApp
                  </a>
                </div>

                {emailStatus.status === 'error' && (
                  <p className="text-[11px] text-red-600 font-medium mt-2">
                    ❌ Error: {emailStatus.error}
                  </p>
                )}
              </div>

              <button 
                onClick={handleConfirmReciboAndClose}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm"
              >
                {t('rp_recibo_confirm_close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Hidden Off-Screen Invoice Template for PDF Rendering */}
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
    </div>
  );
};

export default ReservationPanel;
