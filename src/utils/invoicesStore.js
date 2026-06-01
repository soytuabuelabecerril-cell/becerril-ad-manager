// Simple in-memory store for generated invoices
// In a real production scenario, this would be backed by Supabase.

let invoices = [];

export const getInvoices = () => {
  return [...invoices];
};

export const addInvoice = (invoice) => {
  const newInvoice = {
    id: 'INV-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
    createdAt: new Date().toISOString(),
    status: 'Active',
    paymentMethod: 'Pending',
    isPaid: false,
    ...invoice
  };
  invoices.unshift(newInvoice);
  return newInvoice;
};

export const updateInvoicePayment = (id, paymentMethod, isPaid) => {
  const inv = invoices.find(i => i.id === id);
  if (inv) {
    inv.paymentMethod = paymentMethod;
    inv.isPaid = isPaid;
  }
};

export const cancelInvoice = (id, generateRefund = false) => {
  const invIndex = invoices.findIndex(i => i.id === id);
  if (invIndex === -1) return;
  
  const inv = invoices[invIndex];
  inv.status = 'Cancelled';
  
  if (generateRefund) {
    const refundInvoice = {
      id: 'REF-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
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
};

export const deleteInvoice = (id) => {
  invoices = invoices.filter(i => i.id !== id);
};

export const hardDeleteInvoice = (id) => {
  invoices = invoices.filter(i => i.id !== id && i.originalInvoiceId !== id);
};

// ─── Orders Store ─────────────────────────────────────────────────────────────
// Orders are pending reservations awaiting payment confirmation.
// They are promoted to invoices (with VAT) only when payment is confirmed ("liberación").

let orders = [];

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
  return newOrder;
};

export const deleteOrder = (id) => {
  orders = orders.filter(o => o.id !== id);
};

/**
 * Confirm payment for an order → remove the order and generate a final invoice (with VAT).
 * @param {string} orderId
 * @param {string} paymentMethod - 'Transfer' | 'Cash' | 'Bizum'
 * @returns {object|null} The newly created invoice, or null if order not found.
 */
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
  return invoice;
};

// ─── Recibos Store ────────────────────────────────────────────────────────────
// Recibos are simple cash receipts: no VAT, cash-only, stored separately.

let recibos = [];

export const getRecibos = () => {
  return [...recibos];
};

/**
 * Add a recibo (cash receipt without VAT).
 * @param {object} recibo - { customerName, productName, price, assignedPage, date, artworkComment }
 * @returns {object} The created recibo with id and timestamps.
 */
export const addRecibo = (recibo) => {
  const newRecibo = {
    id: 'REC-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
    createdAt: new Date().toISOString(),
    status: 'Active',
    paymentMethod: 'Cash',
    isPaid: true,   // Recibos are always paid in cash immediately
    isRecibo: true,
    vat: 0,
    designPrice: recibo.designPrice || 0,
    total: recibo.price + (recibo.designPrice || 0),
    ...recibo
  };
  recibos.unshift(newRecibo);
  return newRecibo;
};

export const deleteRecibo = (id) => {
  recibos = recibos.filter(r => r.id !== id);
};

/**
 * Build the abbreviated product label used in WhatsApp messages.
 * PC = Página completa, T = Tercio, 2T = Dos tercios
 */
export const getProductAbbreviation = (productName) => {
  if (!productName) return '';
  const lower = productName.toLowerCase();
  if (lower.includes('dos tercios') || lower.includes('⅔') || lower.includes('2/3')) {
    return '2T'; // Dos tercios
  }
  if (lower.includes('tercio') || lower.includes('⅓') || lower.includes('1/3')) {
    return 'T'; // Tercio
  }
  if (lower.includes('página completa') || lower.includes('pagina completa') || lower.includes('contraportada') || lower.includes('portada')) {
    return 'PC'; // Página completa
  }
  return productName.split(' ').slice(0, 3).join(' ');
};

/**
 * Generate the WhatsApp message text for a recibo.
 * Format: "Recibí, pago a cuenta – [Abbrev product] – [Customer]"
 */
export const getReciboWhatsAppMessage = (recibo) => {
  const abbrev = getProductAbbreviation(recibo.productName);
  const amount = recibo.total.toFixed(2);
  return `Recibí, pago a cuenta – ${abbrev} – ${recibo.customerName} – ${amount}€`;
};
