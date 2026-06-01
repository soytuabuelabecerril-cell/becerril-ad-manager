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
