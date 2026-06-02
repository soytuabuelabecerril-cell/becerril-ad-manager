// Simple store for generated invoices with localStorage persistence
// In a real production scenario, this would be backed by Supabase.

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// ─── Invoices Store ───────────────────────────────────────────────────────────
let invoices = [];
if (isBrowser) {
  try {
    const stored = localStorage.getItem('becerril_invoices');
    if (stored) invoices = JSON.parse(stored);
  } catch (e) {
    console.error("Error loading invoices from localStorage", e);
  }
}

const saveInvoicesToLocalStorage = () => {
  if (isBrowser) {
    try {
      localStorage.setItem('becerril_invoices', JSON.stringify(invoices));
    } catch (e) {
      console.error("Error saving invoices to localStorage", e);
    }
  }
};

export const getInvoices = () => {
  return [...invoices];
};

// ─── Invoicing Settings ──────────────────────────────────────────────────────
let settings = {
  isSequentialEnabled: true,
  nextInvoiceNumber: 3
};

if (isBrowser) {
  try {
    const stored = localStorage.getItem('becerril_invoice_settings');
    if (stored) settings = JSON.parse(stored);
  } catch (e) {
    console.error("Error loading invoice settings from localStorage", e);
  }
}

const saveSettingsToLocalStorage = () => {
  if (isBrowser) {
    try {
      localStorage.setItem('becerril_invoice_settings', JSON.stringify(settings));
    } catch (e) {
      console.error("Error saving invoice settings to localStorage", e);
    }
  }
};

export const getInvoiceSettings = () => {
  return { ...settings };
};

export const saveInvoiceSettings = (newSettings) => {
  settings = { ...settings, ...newSettings };
  saveSettingsToLocalStorage();
};

export const addInvoice = (invoice) => {
  let invoiceId;
  if (settings.isSequentialEnabled && settings.nextInvoiceNumber) {
    const nextNum = parseInt(settings.nextInvoiceNumber, 10);
    invoiceId = String(nextNum).padStart(2, '0') + '_2601';
    settings.nextInvoiceNumber = nextNum + 1;
    saveSettingsToLocalStorage();
  } else {
    invoiceId = String(Math.floor(Math.random() * 1000000)).padStart(6, '0') + '_2601';
  }

  const newInvoice = {
    id: invoiceId,
    createdAt: new Date().toISOString(),
    status: 'Active',
    paymentMethod: 'Pending',
    isPaid: false,
    ...invoice
  };
  invoices.unshift(newInvoice);
  saveInvoicesToLocalStorage();
  return newInvoice;
};

export const updateInvoicePayment = (id, paymentMethod, isPaid) => {
  const inv = invoices.find(i => i.id === id);
  if (inv) {
    inv.paymentMethod = paymentMethod;
    inv.isPaid = isPaid;
    saveInvoicesToLocalStorage();
  }
};

export const cancelInvoice = (id, generateRefund = false) => {
  const invIndex = invoices.findIndex(i => i.id === id);
  if (invIndex === -1) return;
  
  const inv = invoices[invIndex];
  inv.status = 'Cancelled';
  
  if (generateRefund) {
    let refundId;
    if (settings.isSequentialEnabled && settings.nextInvoiceNumber) {
      const nextNum = parseInt(settings.nextInvoiceNumber, 10);
      refundId = 'REF-' + String(nextNum).padStart(2, '0') + '_2601';
      settings.nextInvoiceNumber = nextNum + 1;
      saveSettingsToLocalStorage();
    } else {
      refundId = 'REF-' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0') + '_2601';
    }

    const refundInvoice = {
      id: refundId,
      createdAt: new Date().toISOString(),
      status: 'Refund',
      originalInvoiceId: inv.id,
      customerName: inv.customerName,
      productName: 'Refund: ' + inv.productName,
      assignedPage: inv.assignedPage,
      price: -inv.price,
      vat: -inv.vat,
      total: -inv.total,
      artworkComment: 'Compensating invoice for cancelled order.',
      paymentMethod: inv.paymentMethod,
      isPaid: false // Pending manual return
    };
    invoices.unshift(refundInvoice);
  }
  saveInvoicesToLocalStorage();
};

export const deleteInvoice = (id) => {
  invoices = invoices.filter(i => i.id !== id);
  saveInvoicesToLocalStorage();
  if (invoices.length === 0) {
    settings.nextInvoiceNumber = 3;
    saveSettingsToLocalStorage();
  }
};

export const hardDeleteInvoice = (id) => {
  invoices = invoices.filter(i => i.id !== id && i.originalInvoiceId !== id);
  saveInvoicesToLocalStorage();
  if (invoices.length === 0) {
    settings.nextInvoiceNumber = 3;
    saveSettingsToLocalStorage();
  }
};

/**
 * Reserve/block the next sequential invoice number.
 * Creates a placeholder invoice with status 'Reserved'.
 * @param {string} note - Optional note/reason for the reservation
 * @returns {object|null} The reserved invoice, or null if sequential mode is off.
 */
export const reserveInvoiceNumber = (note = '') => {
  if (!settings.isSequentialEnabled || !settings.nextInvoiceNumber) return null;
  
  const nextNum = parseInt(settings.nextInvoiceNumber, 10);
  const invoiceId = String(nextNum).padStart(2, '0') + '_2601';
  settings.nextInvoiceNumber = nextNum + 1;
  saveSettingsToLocalStorage();

  const reservedInvoice = {
    id: invoiceId,
    createdAt: new Date().toISOString(),
    status: 'Reserved',
    customerName: 'System User', // Will be rendered localized in the UI using t('system_user')
    productName: note || 'Reserved ID', // Will show note or t('reserved_id_desc')
    price: 0,
    designPrice: 0,
    vat: 0,
    total: 0,
    assignedPage: null,
    artworkComment: note || 'Blocked out-of-system ID.',
    paymentMethod: 'Pending',
    isPaid: false
  };

  invoices.unshift(reservedInvoice);
  saveInvoicesToLocalStorage();
  return reservedInvoice;
};

// ─── Orders Store ─────────────────────────────────────────────────────────────
// Orders are pending reservations awaiting payment confirmation.
let orders = [];
if (isBrowser) {
  try {
    const stored = localStorage.getItem('becerril_orders');
    if (stored) orders = JSON.parse(stored);
  } catch (e) {
    console.error("Error loading orders from localStorage", e);
  }
}

const saveOrdersToLocalStorage = () => {
  if (isBrowser) {
    try {
      localStorage.setItem('becerril_orders', JSON.stringify(orders));
    } catch (e) {
      console.error("Error saving orders to localStorage", e);
    }
  }
};

export const getOrders = () => [...orders];

export const addOrder = (order) => {
  const newOrder = {
    id: 'ORD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
    createdAt: new Date().toISOString(),
    status: 'Pending',
    isPaid: false,
    paymentMethod: 'Transfer',
    ...order,
  };
  orders.unshift(newOrder);
  saveOrdersToLocalStorage();
  return newOrder;
};

export const deleteOrder = (id) => {
  orders = orders.filter(o => o.id !== id);
  saveOrdersToLocalStorage();
};

export const confirmOrderPayment = (orderId, paymentMethod = 'Transfer') => {
  const order = orders.find(o => o.id === orderId);
  if (!order) return null;
  const basePrice = order.price || 0;
  const designPrice = order.designPrice || 0;
  const vatAmount = (basePrice + designPrice) * 0.21;
  const total = basePrice + designPrice + vatAmount;
  const invoice = addInvoice({
    customerName: order.customerName,
    productName: order.productName,
    price: basePrice,
    designPrice: designPrice,
    vat: vatAmount,
    total,
    assignedPage: order.assignedPage,
    date: new Date().toLocaleDateString(),
    artworkComment: order.artworkComment || '',
    paymentMethod,
    isPaid: true,
  });
  orders = orders.filter(o => o.id !== orderId);
  saveOrdersToLocalStorage();
  return invoice;
};

// ─── Recibos Store ────────────────────────────────────────────────────────────
// Recibos are simple cash receipts: no VAT, cash-only, stored separately.
let recibos = [];
if (isBrowser) {
  try {
    const stored = localStorage.getItem('becerril_recibos');
    if (stored) recibos = JSON.parse(stored);
  } catch (e) {
    console.error("Error loading recibos from localStorage", e);
  }
}

const saveRecibosToLocalStorage = () => {
  if (isBrowser) {
    try {
      localStorage.setItem('becerril_recibos', JSON.stringify(recibos));
    } catch (e) {
      console.error("Error saving recibos to localStorage", e);
    }
  }
};

export const getRecibos = () => {
  return [...recibos];
};

export const addRecibo = (recibo) => {
  const newRecibo = {
    id: 'REC-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
    createdAt: new Date().toISOString(),
    status: 'Active',
    paymentMethod: 'Cash',
    isPaid: true,
    isRecibo: true,
    vat: 0,
    designPrice: recibo.designPrice || 0,
    total: recibo.price + (recibo.designPrice || 0),
    ...recibo
  };
  recibos.unshift(newRecibo);
  saveRecibosToLocalStorage();
  return newRecibo;
};

export const deleteRecibo = (id) => {
  recibos = recibos.filter(r => r.id !== id);
  saveRecibosToLocalStorage();
};

export const getProductAbbreviation = (productName) => {
  if (!productName) return '';
  const lower = productName.toLowerCase();
  if (lower.includes('dos tercios') || lower.includes('⅔') || lower.includes('2/3')) {
    return '2T';
  }
  if (lower.includes('tercio') || lower.includes('⅓') || lower.includes('1/3')) {
    return 'T';
  }
  if (lower.includes('página completa') || lower.includes('pagina completa') || lower.includes('contraportada') || lower.includes('portada')) {
    return 'PC';
  }
  return productName.split(' ').slice(0, 3).join(' ');
};

export const getReciboWhatsAppMessage = (recibo) => {
  const abbrev = getProductAbbreviation(recibo.productName);
  const amount = recibo.total.toFixed(2);
  return `Recibí, pago a cuenta – ${abbrev} – ${recibo.customerName} – ${amount}€`;
};
