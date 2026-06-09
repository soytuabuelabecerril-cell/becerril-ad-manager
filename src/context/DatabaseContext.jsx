import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFullPages, fallbackPagesData } from '../utils/fallbackData';
import { getTemplateVariables, getHtmlEmailTemplate } from '../utils/notifications';

const DatabaseContext = createContext();

const DEFAULT_TEMPLATES = {
  invoice_email: {
    id: 'invoice_email',
    subject: 'Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. {id}',
    body: 'Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: {id}\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Precio Base: {price}€\n{designPrice}- Subtotal: {subtotal}€\n- IVA (21%): {vat}€\n- Total Pagado: {total}€\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFEFERENCIA PAGO: {id}\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  invoice_whatsapp: {
    id: 'invoice_whatsapp',
    subject: '',
    body: 'Confirmación de pago y Factura Nro. {id} – {productAbbreviation} – {customerName} – {total}€'
  },
  recibo_email: {
    id: 'recibo_email',
    subject: 'Recibo de Pago Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Precio Base: {price}€\n{designPrice}- Recibo: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  recibo_whatsapp: {
    id: 'recibo_whatsapp',
    subject: '',
    body: 'Recibí, pago a cuenta – {productAbbreviation} – {customerName} – {total}€'
  },
  order_reservation_email: {
    id: 'order_reservation_email',
    subject: 'Confirmación de Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFEFERENCIA PAGO: {productName}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_reservation_whatsapp: {
    id: 'order_reservation_whatsapp',
    subject: '',
    body: 'Confirmación de Reserva - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_prereservation_email: {
    id: 'order_prereservation_email',
    subject: 'Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFERENCIA PAGO: {productName}\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_prereservation_whatsapp: {
    id: 'order_prereservation_whatsapp',
    subject: '',
    body: 'Confirmación de Pre-reserva (temporal 1 semana) - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  }
};

export const useDatabase = () => useContext(DatabaseContext);

// --- Mapping Helpers ---

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
  artworkComment: row.artwork_comment,
  originalInvoiceId: row.original_invoice_id,
  emailSentAt: row.email_sent_at,
  customerEmail: row.customer_email || null,
  customerPhone: row.customer_phone || null
});

const toDbInvoice = (inv) => ({
  id: inv.id,
  status: inv.status,
  payment_method: inv.paymentMethod,
  is_paid: inv.isPaid,
  customer_name: inv.customerName,
  product_name: inv.productName,
  price: inv.price,
  design_price: inv.designPrice,
  vat: inv.vat,
  total: inv.total,
  assigned_page: inv.assignedPage,
  artwork_comment: inv.artworkComment,
  original_invoice_id: inv.originalInvoiceId,
  email_sent_at: inv.emailSentAt,
  customer_email: inv.customerEmail || null,
  customer_phone: inv.customerPhone || null
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
  assignedPage: row.assigned_page,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  artworkComment: row.artwork_comment,
  emailSentAt: row.email_sent_at
});

const toDbRecibo = (rec) => ({
  id: rec.id,
  status: rec.status,
  payment_method: rec.paymentMethod,
  is_paid: rec.isPaid,
  is_recibo: rec.isRecibo,
  customer_name: rec.customerName,
  product_name: rec.productName,
  price: rec.price,
  design_price: rec.designPrice,
  total: rec.total,
  assigned_page: rec.assignedPage,
  customer_email: rec.customerEmail,
  customer_phone: rec.customerPhone,
  artwork_comment: rec.artworkComment,
  email_sent_at: rec.emailSentAt
});
const fromDbOrder = (row) => ({
  id: row.id,
  createdAt: row.created_at,
  status: row.status,
  isPaid: row.is_paid,
  paymentMethod: row.payment_method,
  customerName: row.customer_name,
  productName: row.product_name,
  price: parseFloat(row.price || 0),
  designPrice: parseFloat(row.design_price || 0),
  assignedPage: row.assigned_page,
  artworkComment: row.artwork_comment,
  orderType: row.order_type,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  reminderSentAt: row.reminder_sent_at,
  emailReminderSentAt: row.email_reminder_sent_at,
  whatsappReminderSentAt: row.whatsapp_reminder_sent_at,
  emailRemindersCount: row.email_reminders_count || 0,
  whatsappRemindersCount: row.whatsapp_reminders_count || 0,
  lastAutoReminderDay: row.last_auto_reminder_day || 0,
  prolongedCount: row.prolonged_count || 0
});

const toDbOrder = (ord) => ({
  id: ord.id,
  status: ord.status,
  is_paid: ord.isPaid,
  payment_method: ord.paymentMethod,
  customer_name: ord.customerName,
  product_name: ord.productName,
  price: ord.price,
  design_price: ord.designPrice,
  assigned_page: ord.assignedPage,
  artwork_comment: ord.artworkComment,
  order_type: ord.orderType,
  customer_email: ord.customerEmail,
  customer_phone: ord.customerPhone,
  email_reminder_sent_at: ord.emailReminderSentAt || null,
  whatsapp_reminder_sent_at: ord.whatsappReminderSentAt || null,
  email_reminders_count: ord.emailRemindersCount || 0,
  whatsapp_reminders_count: ord.whatsappRemindersCount || 0
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
  createdAt: row.created_at,
  reminderSentAt: row.reminder_sent_at,
  emailReminderSentAt: row.email_reminder_sent_at,
  whatsappReminderSentAt: row.whatsapp_reminder_sent_at,
  emailRemindersCount: row.email_reminders_count || 0,
  whatsappRemindersCount: row.whatsapp_reminders_count || 0,
  lastAutoReminderDay: row.last_auto_reminder_day || 0,
  prolongedCount: row.prolonged_count || 0
});

const toDbAd = (ad, pageNum) => ({
  page_number: pageNum,
  customer_id: ad.customer_id,
  customer_name: ad.customer_name,
  ad_type: ad.ad_type,
  is_pre_reserved: ad.isPreReserved || false,
  expires_at: ad.expires_at || null,
  artwork_option: ad.artworkOption || null,
  design_work_option: ad.designWorkOption || null,
  design_work_price: ad.designWorkPrice || 0,
  is_paid: ad.isPaid || false,
  payment_method: ad.paymentMethod || 'Transfer',
  is_new: ad.isNew || false,
  is_recibo: ad.isRecibo || false,
  email_reminder_sent_at: ad.emailReminderSentAt || null,
  whatsapp_reminder_sent_at: ad.whatsappReminderSentAt || null,
  email_reminders_count: ad.emailRemindersCount || 0,
  whatsapp_reminders_count: ad.whatsappRemindersCount || 0
});
const fromDbSettings = (row) => ({
  isSequentialEnabled: true,
  nextInvoiceNumber: row.next_invoice_number
});

const toDbSettings = (settings) => ({
  id: 1,
  is_sequential_enabled: true,
  next_invoice_number: settings.nextInvoiceNumber
});

export const DatabaseProvider = ({ children }) => {
  const [pages, setPages] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [orders, setOrders] = useState([]);
  const [actionLogs, setActionLogs] = useState([]);

  const logAction = async (actionType, targetId, customerName, productName, pageNumber, price, designPrice, vat, total, paymentMethod, isPaid, details = {}) => {
    let customerEmail = details?.customerEmail || details?.customer_email || details?.newInvoice?.customerEmail || details?.newInvoice?.customer_email || details?.customer?.email || details?.email || null;
    let customerPhone = details?.customerPhone || details?.customer_phone || details?.newInvoice?.customerPhone || details?.newInvoice?.customer_phone || details?.customer?.whatsapp || details?.whatsapp || details?.customer?.phone || details?.phone || null;

    if (customerName) {
      const nameLower = customerName.toLowerCase();
      if (!customerEmail || !customerPhone) {
        const matchOrder = orders.find(o => o.customerName?.toLowerCase() === nameLower && (o.customerEmail || o.customerPhone));
        if (matchOrder) {
          if (!customerEmail) customerEmail = matchOrder.customerEmail;
          if (!customerPhone) customerPhone = matchOrder.customerPhone;
        }
      }
      if (!customerEmail || !customerPhone) {
        const matchRec = recibos.find(r => r.customerName?.toLowerCase() === nameLower && (r.customerEmail || r.customerPhone));
        if (matchRec) {
          if (!customerEmail) customerEmail = matchRec.customerEmail;
          if (!customerPhone) customerPhone = matchRec.customerPhone;
        }
      }
    }

    const logData = {
      action_type: actionType,
      target_id: targetId ? String(targetId) : null,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      product_name: productName || null,
      page_number: pageNumber ? parseInt(pageNumber, 10) : null,
      price: price ? parseFloat(price) : 0,
      design_price: designPrice ? parseFloat(designPrice) : 0,
      vat: vat ? parseFloat(vat) : 0,
      total: total ? parseFloat(total) : 0,
      payment_method: paymentMethod || null,
      is_paid: isPaid || false,
      payment_status: details?.status || details?.payment_status || (isPaid ? 'Paid' : 'Pending'),
      details: details ? details : {},
      created_at: new Date().toISOString()
    };

    // 1. Save locally in localStorage immediately — this is the primary display source
    try {
      const localLogs = JSON.parse(localStorage.getItem('becerril_action_logs') || '[]');
      localLogs.unshift(logData);
      const trimmed = localLogs.slice(0, 2000);
      localStorage.setItem('becerril_action_logs', JSON.stringify(trimmed));
      setActionLogs(trimmed);
    } catch (e) {
      console.error("Failed to write log to localStorage:", e);
    }

    // 2. Try to save to Supabase — attempt full schema first, fall back to minimal (known working columns)
    try {
      const { error } = await supabase
        .from('action_logs')
        .insert([logData]);
      if (error) {
        console.warn("Full insert failed (schema may be missing columns), trying minimal insert:", error.message);
        // Fallback: use only the columns confirmed to exist in the current schema:
        // action_type, target_id, customer_name, product_name, page_number,
        // price, design_price, vat, total, payment_method, details (TEXT), created_at
        const minimalData = {
          action_type: logData.action_type,
          target_id: logData.target_id,
          customer_name: logData.customer_name,
          product_name: logData.product_name,
          page_number: logData.page_number,
          price: logData.price,
          design_price: logData.design_price,
          vat: logData.vat,
          total: logData.total,
          payment_method: logData.payment_method,
          // details is TEXT in current schema, so we stringify. Include all important info.
          details: JSON.stringify({
            customer_email: logData.customer_email,
            customer_phone: logData.customer_phone,
            payment_status: logData.payment_status,
            is_paid: logData.is_paid,
            ...logData.details
          }),
          created_at: logData.created_at,
        };
        const { error: minErr } = await supabase.from('action_logs').insert([minimalData]);
        if (minErr) {
          console.warn("Minimal insert also failed:", minErr.message);
        }
      }
    } catch (err) {
      console.error("Unexpected error saving action log to Supabase:", err);
    }
  };

  const fetchActionLogs = async () => {
    // Always start with localStorage logs (guaranteed to have recent activity)
    let localLogs = [];
    try {
      localLogs = JSON.parse(localStorage.getItem('becerril_action_logs') || '[]');
    } catch (e) {
      console.error("Local storage action logs load failed:", e);
    }

    try {
      const { data, error } = await supabase
        .from('action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      if (data && data.length > 0) {
        // Merge Supabase logs with local logs (deduplicate by created_at + action_type)
        const supabaseKeys = new Set(data.map(r => `${r.created_at}|${r.action_type}|${r.target_id}`));
        const localOnlyLogs = localLogs.filter(l => !supabaseKeys.has(`${l.created_at}|${l.action_type}|${l.target_id}`));
        const merged = [...data, ...localOnlyLogs].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        ).slice(0, 2000);
        setActionLogs(merged);
      } else {
        // Supabase has no logs (schema issue or empty) — show local logs
        setActionLogs(localLogs);
      }
    } catch (err) {
      console.warn("Could not load action logs from Supabase, using localStorage:", err.message);
      setActionLogs(localLogs);
    }
  };

  const [settings, setSettings] = useState({
    isSequentialEnabled: true,
    nextInvoiceNumber: 3
  });
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  // Load user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch functions
  const fetchAdsAndPages = async () => {
    try {
      const { data: pagesData, error: pagesErr } = await supabase
        .from('magazine_pages')
        .select('*')
        .order('page_number', { ascending: true });
      
      if (pagesErr) throw pagesErr;

      const { data: adsData, error: adsErr } = await supabase
        .from('ad_reservations')
        .select('*');

      if (adsErr) throw adsErr;

      const combined = pagesData.map(p => {
        const pageAds = adsData.filter(ad => ad.page_number === p.page_number).map(fromDbAd);
        return {
          ...p,
          ads: pageAds,
          status: pageAds.length > 0 ? 'Reserved' : p.status
        };
      });

      setPages(combined);
    } catch (err) {
      console.error("Error loading pages and ads:", err);
      // Fallback
      setPages(getFullPages());
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data.map(fromDbInvoice));
    } catch (err) {
      console.error("Error loading invoices:", err);
    }
  };

  const fetchRecibos = async () => {
    try {
      const { data, error } = await supabase
        .from('recibos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRecibos(data.map(fromDbRecibo));
    } catch (err) {
      console.error("Error loading recibos:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data.map(fromDbOrder));
    } catch (err) {
      console.error("Error loading orders:", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error && error.code !== 'PGRST116') throw error; // Ignore Not Found error
      if (data) {
        setSettings(fromDbSettings(data));
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const fetchTemplates = async () => {
    try {
      // Trigger database migration check over HTTP in the background
      fetch('/api/run-migration').catch(() => {});

      const { data, error } = await supabase
        .from('communication_templates')
        .select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        const mapped = {};
        data.forEach(t => {
          mapped[t.id] = { id: t.id, subject: t.subject || '', body: t.body || '' };
        });
        setTemplates(prev => ({ ...prev, ...mapped }));
      }
    } catch (err) {
      console.warn("Communication templates table not loaded, using local defaults/localStorage:", err);
      try {
        const saved = localStorage.getItem('becerril_communication_templates');
        if (saved) {
          setTemplates(prev => ({ ...prev, ...JSON.parse(saved) }));
        }
      } catch (e) {
        console.error("Local storage templates load failed:", e);
      }
    }
  };

  const saveCommunicationTemplate = async (id, subject, body) => {
    const updatedTemplate = { id, subject, body };
    setTemplates(prev => {
      const next = { ...prev, [id]: updatedTemplate };
      try {
        localStorage.setItem('becerril_communication_templates', JSON.stringify(next));
      } catch (e) {
        console.error("Error saving templates to localStorage:", e);
      }
      return next;
    });

    logAction('save_communication_template', id, null, null, null, 0, 0, 0, 0, null, false, { subject, body });

    if (!session) return;
    try {
      const { error } = await supabase
        .from('communication_templates')
        .upsert({
          id,
          subject,
          body,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    } catch (err) {
      console.error("Error saving communication template in Supabase:", err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAdsAndPages(),
      fetchInvoices(),
      fetchRecibos(),
      fetchOrders(),
      fetchSettings(),
      fetchTemplates(),
      fetchActionLogs()
    ]);
    setLoading(false);
  };

  // Trigger load when authenticated session is active
  useEffect(() => {
    if (session) {
      loadAllData();

      // Realtime subscriptions
      const adsSubscription = supabase
        .channel('ad-reservations-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ad_reservations' }, () => {
          fetchAdsAndPages();
        })
        .subscribe();

      const invoicesSubscription = supabase
        .channel('invoices-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
          fetchInvoices();
        })
        .subscribe();

      const recibosSubscription = supabase
        .channel('recibos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recibos' }, () => {
          fetchRecibos();
        })
        .subscribe();

      const ordersSubscription = supabase
        .channel('orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
        })
        .subscribe();

      const settingsSubscription = supabase
        .channel('settings-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoice_settings' }, () => {
          fetchSettings();
        })
        .subscribe();

      const templatesSubscription = supabase
        .channel('templates-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'communication_templates' }, () => {
          fetchTemplates();
        })
        .subscribe();

      const actionLogsSubscription = supabase
        .channel('action-logs-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'action_logs' }, () => {
          fetchActionLogs();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(adsSubscription);
        supabase.removeChannel(invoicesSubscription);
        supabase.removeChannel(recibosSubscription);
        supabase.removeChannel(ordersSubscription);
        supabase.removeChannel(settingsSubscription);
        supabase.removeChannel(templatesSubscription);
        supabase.removeChannel(actionLogsSubscription);
      };
    } else {
      setLoading(false);
    }
  }, [session]);

  // --- Sequential settings ---
  const saveInvoiceSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings, isSequentialEnabled: true };
    setSettings(updated);
    logAction('save_invoice_settings', '1', null, null, null, 0, 0, 0, 0, null, false, newSettings);
    if (!session) return;
    try {
      const { error } = await supabase
        .from('invoice_settings')
        .upsert(toDbSettings(updated));
      if (error) throw error;
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  };

  // Helper to generate Invoice ID
  const getNextInvoiceId = async () => {
    // Fetch latest settings from DB to prevent race conditions or stale state
    let nextNum = settings.nextInvoiceNumber;
    try {
      const { data: dbSettings, error: dbErr } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!dbErr && dbSettings) {
        const fetched = fromDbSettings(dbSettings);
        nextNum = fetched.nextInvoiceNumber;
      }
    } catch (e) {
      console.error("Error fetching settings for next invoice ID:", e);
    }

    // Always sequential numbering (frozen functionality)
    const parsedNum = nextNum ? parseInt(nextNum, 10) : 3;
    const invoiceId = String(parsedNum).padStart(2, '0') + '_2601';
    
    // Increment sequentially in DB and local state
    await saveInvoiceSettings({
      nextInvoiceNumber: parsedNum + 1
    });
    return invoiceId;
  };

  // --- Mutation Actions ---

  const addInvoice = async (invoiceData) => {
    const id = await getNextInvoiceId();
    const newInvoice = {
      id,
      createdAt: new Date().toISOString(),
      status: 'Active',
      paymentMethod: 'Pending',
      isPaid: false,
      ...invoiceData
    };

    try {
      const { error } = await supabase
        .from('invoices')
        .insert([toDbInvoice(newInvoice)]);
      if (error) throw error;
      setInvoices(prev => [newInvoice, ...prev]);
      logAction('create_invoice', id, newInvoice.customerName, newInvoice.productName, newInvoice.assignedPage, newInvoice.price, newInvoice.designPrice, newInvoice.vat, newInvoice.total, newInvoice.paymentMethod, newInvoice.isPaid, newInvoice);
      return newInvoice;
    } catch (err) {
      console.error("Error inserting invoice:", err);
      // Fallback update
      setInvoices(prev => [newInvoice, ...prev]);
      logAction('create_invoice', id, newInvoice.customerName, newInvoice.productName, newInvoice.assignedPage, newInvoice.price, newInvoice.designPrice, newInvoice.vat, newInvoice.total, newInvoice.paymentMethod, newInvoice.isPaid, newInvoice);
      return newInvoice;
    }
  };

  const updateInvoicePayment = async (id, paymentMethod, isPaid) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ payment_method: paymentMethod, is_paid: isPaid })
        .eq('id', id);
      if (error) throw error;

      // Also update isPaid inside matching ads
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice && invoice.assignedPage) {
        const { error: adErr } = await supabase
          .from('ad_reservations')
          .update({ is_paid: isPaid, payment_method: paymentMethod })
          .eq('page_number', invoice.assignedPage)
          .eq('customer_name', invoice.customerName)
          .eq('ad_type', invoice.productName);
        if (adErr) console.error("Ad update payment error:", adErr);
      }

      // Update local invoices state immediately on success
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, isPaid, paymentMethod } : inv
      ));

      // Update local pages state immediately on success
      if (invoice && invoice.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === invoice.assignedPage) {
              const pageAds = p.ads ? p.ads.map(ad => {
                if (ad.customer_name === invoice.customerName && ad.ad_type === invoice.productName) {
                  return { ...ad, isPaid, paymentMethod };
                }
                return ad;
              }) : [];
              return { ...p, ads: pageAds };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === invoice.assignedPage) {
                  const pageAds = p.ads ? p.ads.map(ad => {
                    if (ad.customer_name === invoice.customerName && ad.ad_type === invoice.productName) {
                      return { ...ad, isPaid, paymentMethod };
                    }
                    return ad;
                  }) : [];
                  fallbackPagesData[idx] = { ...p, ads: pageAds };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }
      logAction(isPaid ? 'pay_invoice' : 'unpay_invoice', id, invoice?.customerName, invoice?.productName, invoice?.assignedPage, invoice?.price, invoice?.designPrice, invoice?.vat, invoice?.total, paymentMethod, isPaid, { id, paymentMethod, isPaid });
    } catch (err) {
      console.error("Error updating invoice payment:", err);
      // Fallback local updates
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, isPaid, paymentMethod } : inv
      ));

      const invoice = invoices.find(inv => inv.id === id);
      if (invoice && invoice.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === invoice.assignedPage) {
              const pageAds = p.ads ? p.ads.map(ad => {
                if (ad.customer_name === invoice.customerName && ad.ad_type === invoice.productName) {
                  return { ...ad, isPaid, paymentMethod };
                }
                return ad;
              }) : [];
              return { ...p, ads: pageAds };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === invoice.assignedPage) {
                  const pageAds = p.ads ? p.ads.map(ad => {
                    if (ad.customer_name === invoice.customerName && ad.ad_type === invoice.productName) {
                      return { ...ad, isPaid, paymentMethod };
                    }
                    return ad;
                  }) : [];
                  fallbackPagesData[idx] = { ...p, ads: pageAds };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }
      logAction(isPaid ? 'pay_invoice' : 'unpay_invoice', id, invoice?.customerName, invoice?.productName, invoice?.assignedPage, invoice?.price, invoice?.designPrice, invoice?.vat, invoice?.total, paymentMethod, isPaid, { id, paymentMethod, isPaid });
    }
  };

  const markInvoiceEmailSent = async (id) => {
    try {
      const emailSentAt = new Date().toISOString();
      const { error } = await supabase
        .from('invoices')
        .update({ email_sent_at: emailSentAt })
        .eq('id', id);
      if (error) throw error;
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, emailSentAt } : inv));
      const invoice = invoices.find(inv => inv.id === id);
      logAction('send_invoice_email', id, invoice?.customerName, invoice?.productName, invoice?.assignedPage, invoice?.price, invoice?.designPrice, invoice?.vat, invoice?.total, invoice?.paymentMethod, invoice?.isPaid, { id, emailSentAt });
    } catch (err) {
      console.error("Error updating invoice email_sent_at:", err);
    }
  };

  const markReciboEmailSent = async (id) => {
    try {
      const emailSentAt = new Date().toISOString();
      const { error } = await supabase
        .from('recibos')
        .update({ email_sent_at: emailSentAt })
        .eq('id', id);
      if (error) throw error;
      setRecibos(prev => prev.map(rec => rec.id === id ? { ...rec, emailSentAt } : rec));
      const recibo = recibos.find(r => r.id === id);
      logAction('send_recibo_email', id, recibo?.customerName, recibo?.productName, recibo?.assignedPage, recibo?.price, recibo?.designPrice, 0, recibo?.total, recibo?.paymentMethod, recibo?.isPaid, { id, emailSentAt });
    } catch (err) {
      console.error("Error updating recibo email_sent_at:", err);
    }
  };

  const cancelInvoice = async (id, generateRefund = false) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'Cancelled' })
        .eq('id', id);
      if (error) throw error;

      const inv = invoices.find(i => i.id === id);
      if (!inv) return;

      // Liberate page - remove ads for this customer/product on this page
      if (inv.assignedPage) {
        const { error: delErr } = await supabase
          .from('ad_reservations')
          .delete()
          .eq('page_number', inv.assignedPage)
          .eq('customer_name', inv.customerName)
          .eq('ad_type', inv.productName);
        if (delErr) console.error("Error deleting ads on cancel:", delErr);
        await updatePageStatusIfEmpty(inv.assignedPage);
      }

      if (generateRefund) {
        let nextNum = settings.nextInvoiceNumber;
        try {
          const { data: dbSettings, error: dbErr } = await supabase
            .from('invoice_settings')
            .select('*')
            .eq('id', 1)
            .single();
          if (!dbErr && dbSettings) {
            const fetched = fromDbSettings(dbSettings);
            nextNum = fetched.nextInvoiceNumber;
          }
        } catch (e) {
          console.error("Error fetching settings for refund ID:", e);
        }

        // Always sequential numbering (frozen functionality)
        const parsedNum = nextNum ? parseInt(nextNum, 10) : 3;
        const refundId = 'REF-' + String(parsedNum).padStart(2, '0') + '_2601';
        await saveInvoiceSettings({ nextInvoiceNumber: parsedNum + 1 });

        const refundInvoice = {
          id: refundId,
          status: 'Refund',
          originalInvoiceId: inv.id,
          customerName: inv.customerName,
          productName: 'Refund: ' + inv.productName,
          assignedPage: inv.assignedPage,
          price: -inv.price,
          designPrice: -inv.designPrice,
          vat: -inv.vat,
          total: -inv.total,
          artworkComment: 'Compensating invoice for cancelled order.',
          paymentMethod: inv.paymentMethod,
          isPaid: false
        };

        const { error: refErr } = await supabase
          .from('invoices')
          .insert([toDbInvoice(refundInvoice)]);
        if (refErr) throw refErr;

        // Insert refund invoice to local state on success
        setInvoices(prev => [refundInvoice, ...prev]);
      }

      // Update local invoices status on success
      setInvoices(prev => prev.map(invoice => invoice.id === id ? { ...invoice, status: 'Cancelled' } : invoice));

      // Liberate page locally on success
      if (inv.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === inv.assignedPage) {
              const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === inv.customerName && ad.ad_type === inv.productName)) : [];
              return {
                ...p,
                ads: pageAds,
                status: pageAds.length > 0 ? 'Reserved' : 'Available'
              };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === inv.assignedPage) {
                  const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === inv.customerName && ad.ad_type === inv.productName)) : [];
                  fallbackPagesData[idx] = {
                    ...p,
                    ads: pageAds,
                    status: pageAds.length > 0 ? 'Reserved' : 'Available'
                  };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }
      logAction('cancel_invoice', id, inv?.customerName, inv?.productName, inv?.assignedPage, inv?.price, inv?.designPrice, inv?.vat, inv?.total, inv?.paymentMethod, inv?.isPaid, { id, generateRefund });
      if (generateRefund) {
        logAction('create_refund_invoice', refundId, inv?.customerName, 'Refund: ' + inv?.productName, inv?.assignedPage, -inv?.price, -inv?.designPrice, -inv?.vat, -inv?.total, inv?.paymentMethod, false, refundInvoice);
      }
    } catch (err) {
      console.error("Error cancelling invoice:", err);
      
      const invIndex = invoices.findIndex(i => i.id === id);
      if (invIndex === -1) return;
      const inv = invoices[invIndex];

      // Update local invoices status
      setInvoices(prev => prev.map(invoice => invoice.id === id ? { ...invoice, status: 'Cancelled' } : invoice));

      // Liberate page locally
      if (inv.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === inv.assignedPage) {
              const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === inv.customerName && ad.ad_type === inv.productName)) : [];
              return {
                ...p,
                ads: pageAds,
                status: pageAds.length > 0 ? 'Reserved' : 'Available'
              };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === inv.assignedPage) {
                  const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === inv.customerName && ad.ad_type === inv.productName)) : [];
                  fallbackPagesData[idx] = {
                    ...p,
                    ads: pageAds,
                    status: pageAds.length > 0 ? 'Reserved' : 'Available'
                  };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }

      let refundId;
      if (generateRefund) {
        // Always sequential numbering (frozen functionality)
        const nextNum = settings.nextInvoiceNumber ? parseInt(settings.nextInvoiceNumber, 10) : 3;
        refundId = 'REF-' + String(nextNum).padStart(2, '0') + '_2601';
        saveInvoiceSettings({ nextInvoiceNumber: nextNum + 1 });

        const refundInvoice = {
          id: refundId,
          createdAt: new Date().toISOString(),
          status: 'Refund',
          originalInvoiceId: inv.id,
          customerName: inv.customerName,
          productName: 'Refund: ' + inv.productName,
          assignedPage: inv.assignedPage,
          price: -inv.price,
          designPrice: -inv.designPrice,
          vat: -inv.vat,
          total: -inv.total,
          artworkComment: 'Compensating invoice for cancelled order.',
          paymentMethod: inv.paymentMethod,
          isPaid: false
        };

        setInvoices(prev => [refundInvoice, ...prev]);
        logAction('create_refund_invoice', refundId, inv?.customerName, 'Refund: ' + inv?.productName, inv?.assignedPage, -inv?.price, -inv?.designPrice, -inv?.vat, -inv?.total, inv?.paymentMethod, false, refundInvoice);
      }
      logAction('cancel_invoice', id, inv?.customerName, inv?.productName, inv?.assignedPage, inv?.price, inv?.designPrice, inv?.vat, inv?.total, inv?.paymentMethod, inv?.isPaid, { id, generateRefund, isFallback: true });
    }
  };

  const deleteInvoice = async (id) => {
    const invoiceToDelete = invoices.find(inv => inv.id === id);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Reset sequence if no invoices left
      const { count, error: countErr } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });
      if (!countErr && count === 0) {
        await saveInvoiceSettings({ nextInvoiceNumber: 3 });
      }

      // Update local state immediately on success
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      logAction('delete_invoice', id, invoiceToDelete?.customerName, invoiceToDelete?.productName, invoiceToDelete?.assignedPage, invoiceToDelete?.price, invoiceToDelete?.designPrice, invoiceToDelete?.vat, invoiceToDelete?.total, invoiceToDelete?.paymentMethod, invoiceToDelete?.isPaid, invoiceToDelete);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      // Fallback local update
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      logAction('delete_invoice', id, invoiceToDelete?.customerName, invoiceToDelete?.productName, invoiceToDelete?.assignedPage, invoiceToDelete?.price, invoiceToDelete?.designPrice, invoiceToDelete?.vat, invoiceToDelete?.total, invoiceToDelete?.paymentMethod, invoiceToDelete?.isPaid, invoiceToDelete);
    }
  };

  const hardDeleteInvoice = async (id) => {
    const invoiceToDelete = invoices.find(inv => inv.id === id);
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .or(`id.eq.${id},original_invoice_id.eq.${id}`);
      if (error) throw error;

      // Reset sequence if no invoices left
      const { count, error: countErr } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true });
      if (!countErr && count === 0) {
        await saveInvoiceSettings({ nextInvoiceNumber: 3 });
      }

      // Update local state immediately on success
      setInvoices(prev => prev.filter(inv => inv.id !== id && inv.originalInvoiceId !== id));
      logAction('hard_delete_invoice', id, invoiceToDelete?.customerName, invoiceToDelete?.productName, invoiceToDelete?.assignedPage, invoiceToDelete?.price, invoiceToDelete?.designPrice, invoiceToDelete?.vat, invoiceToDelete?.total, invoiceToDelete?.paymentMethod, invoiceToDelete?.isPaid, invoiceToDelete);
    } catch (err) {
      console.error("Error hard deleting invoice:", err);
      // Fallback local update
      setInvoices(prev => prev.filter(inv => inv.id !== id && inv.originalInvoiceId !== id));
      logAction('hard_delete_invoice', id, invoiceToDelete?.customerName, invoiceToDelete?.productName, invoiceToDelete?.assignedPage, invoiceToDelete?.price, invoiceToDelete?.designPrice, invoiceToDelete?.vat, invoiceToDelete?.total, invoiceToDelete?.paymentMethod, invoiceToDelete?.isPaid, invoiceToDelete);
    }
  };

  const reserveInvoiceNumber = async (note = '') => {
    let nextNum = settings.nextInvoiceNumber;
    try {
      const { data: dbSettings, error: dbErr } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!dbErr && dbSettings) {
        const fetched = fromDbSettings(dbSettings);
        nextNum = fetched.nextInvoiceNumber;
      }
    } catch (e) {
      console.error("Error fetching settings for reservation ID:", e);
    }

    // Always sequential numbering (frozen functionality)
    const parsedNum = nextNum ? parseInt(nextNum, 10) : 3;
    const invoiceId = String(parsedNum).padStart(2, '0') + '_2601';
    await saveInvoiceSettings({ nextInvoiceNumber: parsedNum + 1 });

    const reservedInvoice = {
      id: invoiceId,
      status: 'Reserved',
      customerName: 'System User',
      productName: note || 'Reserved ID',
      price: 0,
      designPrice: 0,
      vat: 0,
      total: 0,
      assignedPage: null,
      artworkComment: note || 'Factura externa al sistema.',
      paymentMethod: 'Pending',
      isPaid: false
    };

    try {
      const { error } = await supabase
        .from('invoices')
        .insert([toDbInvoice(reservedInvoice)]);
      if (error) throw error;
      setInvoices(prev => [reservedInvoice, ...prev]);
      logAction('reserve_invoice_number', reservedInvoice.id, reservedInvoice.customerName, reservedInvoice.productName, reservedInvoice.assignedPage, reservedInvoice.price, reservedInvoice.designPrice, reservedInvoice.vat, reservedInvoice.total, reservedInvoice.paymentMethod, reservedInvoice.isPaid, reservedInvoice);
      return reservedInvoice;
    } catch (err) {
      console.error("Error reserving invoice ID:", err);
      setInvoices(prev => [reservedInvoice, ...prev]);
      logAction('reserve_invoice_number', reservedInvoice.id, reservedInvoice.customerName, reservedInvoice.productName, reservedInvoice.assignedPage, reservedInvoice.price, reservedInvoice.designPrice, reservedInvoice.vat, reservedInvoice.total, reservedInvoice.paymentMethod, reservedInvoice.isPaid, reservedInvoice);
      return reservedInvoice;
    }
  };

  const addOrder = async (orderData, skipAdReservation = false) => {
    const id = 'ORD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const newOrder = {
      id,
      status: 'Pending',
      isPaid: false,
      paymentMethod: 'Transfer',
      ...orderData
    };

    // Prepare ad details
    const adDetails = {
      ad_type: orderData.productName,
      customer_id: orderData.customerId || 'legacy',
      customer_name: orderData.customerName,
      isPreReserved: orderData.orderType === 'pre-reserved',
      expires_at: orderData.orderType === 'pre-reserved' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      artworkOption: '1', // Default options, will match panel
      designWorkOption: null,
      designWorkPrice: orderData.designPrice || 0,
      isNew: true,
      isPaid: false,
      paymentMethod: orderData.paymentMethod || 'Transfer'
    };

    try {
      const { error } = await supabase
        .from('orders')
        .insert([toDbOrder(newOrder)]);
      if (error) throw error;

      if (!skipAdReservation) {
        const { error: adErr } = await supabase
          .from('ad_reservations')
          .insert([toDbAd(adDetails, orderData.assignedPage)]);
        if (adErr) throw adErr;
      }

      // Immediately update local pages state (don't wait for realtime)
      setOrders(prev => [newOrder, ...prev]);
      if (!skipAdReservation && orderData.assignedPage) {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === orderData.assignedPage) {
            const pageAds = p.ads ? [...p.ads] : [];
            pageAds.push(fromDbAd(toDbAd(adDetails, orderData.assignedPage)));
            return { ...p, ads: pageAds, status: 'Reserved' };
          }
          return p;
        }));
      }

      logAction(orderData.orderType === 'pre-reserved' ? 'pre_reserve_ad' : 'create_order', newOrder.id, orderData.customerName, orderData.productName, orderData.assignedPage, orderData.price, orderData.designPrice, (orderData.price + orderData.designPrice) * 0.21, (orderData.price + orderData.designPrice) * 1.21, orderData.paymentMethod, false, newOrder);
      return newOrder;
    } catch (err) {
      console.error("Error creating order:", err);
      
      // Fallback: update local orders state
      setOrders(prev => [newOrder, ...prev]);

      // Fallback: update local pages state
      if (!skipAdReservation && orderData.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === orderData.assignedPage) {
              const pageAds = p.ads ? [...p.ads] : [];
              pageAds.push(fromDbAd(toDbAd(adDetails, orderData.assignedPage)));
              return {
                ...p,
                ads: pageAds,
                status: 'Reserved'
              };
            }
            return p;
          });
          return updatedPages;
        });
      }

      logAction(orderData.orderType === 'pre-reserved' ? 'pre_reserve_ad' : 'create_order', newOrder.id, orderData.customerName, orderData.productName, orderData.assignedPage, orderData.price, orderData.designPrice, (orderData.price + orderData.designPrice) * 0.21, (orderData.price + orderData.designPrice) * 1.21, orderData.paymentMethod, false, newOrder);
      return newOrder;
    }
  };

  const deleteOrder = async (id, skipAdReservation = false) => {
    try {
      const ord = orders.find(o => o.id === id);
      if (!skipAdReservation && ord && ord.assignedPage) {
        // Remove from ad_reservations
        const { error: adErr } = await supabase
          .from('ad_reservations')
          .delete()
          .eq('page_number', ord.assignedPage)
          .eq('customer_name', ord.customerName)
          .eq('ad_type', ord.productName);
        if (adErr) console.error("Ad delete error for order deletion:", adErr);
        await updatePageStatusIfEmpty(ord.assignedPage);
      }

      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Immediately update local states (don't wait for realtime)
      setOrders(prev => prev.filter(o => o.id !== id));
      if (!skipAdReservation && ord && ord.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === ord.assignedPage) {
              const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === ord.customerName && ad.ad_type === ord.productName)) : [];
              return {
                ...p,
                ads: pageAds,
                status: pageAds.length > 0 ? 'Reserved' : 'Available'
              };
            }
            return p;
          });

          // Update fallbackPagesData and localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === ord.assignedPage) {
                  const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === ord.customerName && ad.ad_type === ord.productName)) : [];
                  fallbackPagesData[idx] = {
                    ...p,
                    ads: pageAds,
                    status: pageAds.length > 0 ? 'Reserved' : 'Available'
                  };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }
      logAction('delete_order', id, ord?.customerName, ord?.productName, ord?.assignedPage, ord?.price, ord?.designPrice, 0, 0, ord?.paymentMethod, ord?.isPaid, ord);
    } catch (err) {
      console.error("Error deleting order:", err);
      
      const ord = orders.find(o => o.id === id);
      if (ord) {
        // Fallback: update local orders state
        setOrders(prev => prev.filter(o => o.id !== id));

        // Fallback: remove ad reservation from local pages state
        if (!skipAdReservation && ord.assignedPage) {
          setPages(prevPages => {
            const updatedPages = prevPages.map(p => {
              if (p.page_number === ord.assignedPage) {
                const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === ord.customerName && ad.ad_type === ord.productName)) : [];
                return {
                  ...p,
                  ads: pageAds,
                  status: pageAds.length > 0 ? 'Reserved' : 'Available'
                };
              }
              return p;
            });

            // Update fallbackPagesData and localStorage
            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                fallbackPagesData.forEach((p, idx) => {
                  if (p.page_number === ord.assignedPage) {
                    const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === ord.customerName && ad.ad_type === ord.productName)) : [];
                    fallbackPagesData[idx] = {
                      ...p,
                      ads: pageAds,
                      status: pageAds.length > 0 ? 'Reserved' : 'Available'
                    };
                  }
                });
                localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
              } catch (e) {
                console.error("Error persisting to localStorage:", e);
              }
            }
            return updatedPages;
          });
        }
      }
      logAction('delete_order', id, ord?.customerName, ord?.productName, ord?.assignedPage, ord?.price, ord?.designPrice, 0, 0, ord?.paymentMethod, ord?.isPaid, ord);
    }
  };

  const updateOrder = async (id, orderData) => {
    try {
      const dbUpdate = {};
      if (orderData.status !== undefined) dbUpdate.status = orderData.status;
      if (orderData.isPaid !== undefined) dbUpdate.is_paid = orderData.isPaid;
      if (orderData.paymentMethod !== undefined) dbUpdate.payment_method = orderData.paymentMethod;
      if (orderData.customerName !== undefined) dbUpdate.customer_name = orderData.customerName;
      if (orderData.productName !== undefined) dbUpdate.product_name = orderData.productName;
      if (orderData.price !== undefined) dbUpdate.price = orderData.price;
      if (orderData.designPrice !== undefined) dbUpdate.design_price = orderData.designPrice;
      if (orderData.assignedPage !== undefined) dbUpdate.assigned_page = orderData.assignedPage;
      if (orderData.artworkComment !== undefined) dbUpdate.artwork_comment = orderData.artworkComment;
      if (orderData.orderType !== undefined) dbUpdate.order_type = orderData.orderType;
      if (orderData.customerEmail !== undefined) dbUpdate.customer_email = orderData.customerEmail;
      if (orderData.customerPhone !== undefined) dbUpdate.customer_phone = orderData.customerPhone;
      if (orderData.emailReminderSentAt !== undefined) dbUpdate.email_reminder_sent_at = orderData.emailReminderSentAt;
      if (orderData.whatsappReminderSentAt !== undefined) dbUpdate.whatsapp_reminder_sent_at = orderData.whatsappReminderSentAt;
      if (orderData.emailRemindersCount !== undefined) dbUpdate.email_reminders_count = orderData.emailRemindersCount;
      if (orderData.whatsappRemindersCount !== undefined) dbUpdate.whatsapp_reminders_count = orderData.whatsappRemindersCount;

      const { error } = await supabase
        .from('orders')
        .update(dbUpdate)
        .eq('id', id);
      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...orderData } : o));
      const order = orders.find(o => o.id === id);
      logAction('update_order', id, orderData.customerName || order?.customerName, orderData.productName || order?.productName, orderData.assignedPage || order?.assignedPage, orderData.price || order?.price, orderData.designPrice || order?.designPrice, 0, 0, orderData.paymentMethod || order?.paymentMethod, orderData.isPaid || order?.isPaid, { id, ...orderData });
    } catch (err) {
      console.error("Error updating order:", err);
      setOrders(prev => prev.map(o => o.id === id ? { ...o, ...orderData } : o));
      const order = orders.find(o => o.id === id);
      logAction('update_order', id, orderData.customerName || order?.customerName, orderData.productName || order?.productName, orderData.assignedPage || order?.assignedPage, orderData.price || order?.price, orderData.designPrice || order?.designPrice, 0, 0, orderData.paymentMethod || order?.paymentMethod, orderData.isPaid || order?.isPaid, { id, ...orderData, isFallback: true });
    }
  };

  const confirmOrderPayment = async (orderIdOrObj, paymentMethod = 'Transfer', skipEmail = false) => {
    let order;
    if (typeof orderIdOrObj === 'object' && orderIdOrObj !== null) {
      order = orderIdOrObj;
    } else {
      order = orders.find(o => o.id === orderIdOrObj);
      if (!order && typeof orderIdOrObj === 'string') {
        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderIdOrObj)
            .single();
          if (data && !error) {
            order = fromDbOrder(data);
          }
        } catch (err) {
          console.error("Error fetching order in confirmOrderPayment fallback:", err);
        }
      }
    }
    if (!order) return null;

    const orderId = order.id;

    const basePrice = order.price || 0;
    const designPrice = order.designPrice || 0;
    const vatAmount = (basePrice + designPrice) * 0.21;
    const total = basePrice + designPrice + vatAmount;

    try {
      // 1. Add invoice
      const invoice = await addInvoice({
        customerName: order.customerName,
        productName: order.productName,
        price: basePrice,
        designPrice: designPrice,
        vat: vatAmount,
        total,
        assignedPage: order.assignedPage,
        artworkComment: order.artworkComment || '',
        paymentMethod,
        isPaid: true,
        customerEmail: order.customerEmail || null,
        customerPhone: order.customerPhone || null
      });

      // Send automatic payment confirmation email in the background
      if (order.customerEmail && !skipEmail) {
        const subject = `Confirmación de Pago: Factura Nro. ${invoice.id} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola,\n\nConfirmamos que hemos recibido el pago correspondiente a su espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: ${invoice.id}\n- Producto: ${invoice.productName}\n- Página Asignada: ${invoice.assignedPage}\n- Método de Pago: ${paymentMethod}\n- Precio Base: ${invoice.price.toFixed(2)}€\n${invoice.designPrice > 0 ? `- Precio Diseño: ${invoice.designPrice.toFixed(2)}€\n` : ''}- Subtotal: ${(invoice.price + invoice.designPrice).toFixed(2)}€\n- IVA (21%): ${invoice.vat.toFixed(2)}€\n- Total Pagado: ${invoice.total.toFixed(2)}€\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        const vars = getTemplateVariables(invoice, 'es');
        const html = getHtmlEmailTemplate(vars);
        
        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: order.customerEmail, subject, text, html, background: true })
        }).catch(err => console.error("Error sending automatic payment confirmation email:", err));
      }

      // 2. Update matching ad status in ad_reservations to isPaid=true
      const { error: adErr } = await supabase
        .from('ad_reservations')
        .update({ is_paid: true, is_pre_reserved: false, expires_at: null, payment_method: paymentMethod })
        .eq('page_number', order.assignedPage)
        .eq('customer_name', order.customerName)
        .eq('ad_type', order.productName);
      if (adErr) throw adErr;

      // 3. Update order status to Paid instead of deleting it
      const { error: ordErr } = await supabase
        .from('orders')
        .update({ is_paid: true, status: 'Paid' })
        .eq('id', orderId);
      if (ordErr) throw ordErr;

      // Update local pages ad status on success
      if (order.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === order.assignedPage) {
              const pageAds = p.ads ? p.ads.map(ad => {
                if (ad.customer_name === order.customerName && ad.ad_type === order.productName) {
                  return { ...ad, isPaid: true, isPreReserved: false, expires_at: null, paymentMethod };
                }
                return ad;
              }) : [];
              return {
                ...p,
                ads: pageAds
              };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === order.assignedPage) {
                  const pageAds = p.ads ? p.ads.map(ad => {
                    if (ad.customer_name === order.customerName && ad.ad_type === order.productName) {
                      return { ...ad, isPaid: true, isPreReserved: false, expires_at: null, paymentMethod };
                    }
                    return ad;
                  }) : [];
                  fallbackPagesData[idx] = {
                    ...p,
                    ads: pageAds
                  };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }

      // Update order locally on success
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPaid: true, status: 'Paid' } : o));

      logAction('confirm_order_payment', orderId, order.customerName, order.productName, order.assignedPage, basePrice, designPrice, vatAmount, total, paymentMethod, true, { orderId, invoiceId: invoice.id });

      return invoice;
    } catch (err) {
      console.error("Error confirming order payment:", err);
      
      // Fallback: 1. Add invoice locally
      const invoice = await addInvoice({
        customerName: order.customerName,
        productName: order.productName,
        price: basePrice,
        designPrice: designPrice,
        vat: vatAmount,
        total,
        assignedPage: order.assignedPage,
        artworkComment: order.artworkComment || '',
        paymentMethod,
        isPaid: true,
        customerEmail: order.customerEmail || null,
        customerPhone: order.customerPhone || null
      });

      // Send automatic payment confirmation email in the background (fallback)
      if (order.customerEmail && !skipEmail) {
        const subject = `Confirmación de Pago: Factura Nro. ${invoice.id} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola,\n\nConfirmamos que hemos recibido el pago correspondiente a su espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: ${invoice.id}\n- Producto: ${invoice.productName}\n- Página Asignada: ${invoice.assignedPage}\n- Método de Pago: ${paymentMethod}\n- Precio Base: ${invoice.price.toFixed(2)}€\n${invoice.designPrice > 0 ? `- Precio Diseño: ${invoice.designPrice.toFixed(2)}€\n` : ''}- Subtotal: ${(invoice.price + invoice.designPrice).toFixed(2)}€\n- IVA (21%): ${invoice.vat.toFixed(2)}€\n- Total Pagado: ${invoice.total.toFixed(2)}€\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        const vars = getTemplateVariables(invoice, 'es');
        const html = getHtmlEmailTemplate(vars);
        
        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: order.customerEmail, subject, text, html, background: true })
        }).catch(err => console.error("Error sending automatic payment confirmation email (fallback):", err));
      }

      // 2. Update local pages ad status
      if (order.assignedPage) {
        setPages(prevPages => {
          const updatedPages = prevPages.map(p => {
            if (p.page_number === order.assignedPage) {
              const pageAds = p.ads ? p.ads.map(ad => {
                if (ad.customer_name === order.customerName && ad.ad_type === order.productName) {
                  return { ...ad, isPaid: true, isPreReserved: false, expires_at: null, paymentMethod };
                }
                return ad;
              }) : [];
              return {
                ...p,
                ads: pageAds
              };
            }
            return p;
          });

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              fallbackPagesData.forEach((p, idx) => {
                if (p.page_number === order.assignedPage) {
                  const pageAds = p.ads ? p.ads.map(ad => {
                    if (ad.customer_name === order.customerName && ad.ad_type === order.productName) {
                      return { ...ad, isPaid: true, isPreReserved: false, expires_at: null, paymentMethod };
                    }
                    return ad;
                  }) : [];
                  fallbackPagesData[idx] = {
                    ...p,
                    ads: pageAds
                  };
                }
              });
              localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
            } catch (e) {
              console.error("Error persisting to localStorage:", e);
            }
          }
          return updatedPages;
        });
      }

      // 3. Update order locally
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPaid: true, status: 'Paid' } : o));

      logAction('confirm_order_payment', orderId, order.customerName, order.productName, order.assignedPage, basePrice, designPrice, vatAmount, total, paymentMethod, true, { orderId, invoiceId: invoice.id, isFallback: true });

      return invoice;
    }
  };

  const sendPaymentReminder = async (customerName, productName, pageNum, expiresAt, customerEmail, customerPhone, targetId, isOrder = false) => {
    let emailSuccess = false;
    const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : '';

    if (customerEmail) {
      try {
        const subject = `Recordatorio de Reserva: Pág. ${pageNum} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola,\n\nLe recordamos que tiene una reserva de espacio publicitario pendiente de pago en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n` +
          `- Cliente: ${customerName}\n` +
          `- Producto: ${productName}\n` +
          `- Página Asignada: ${pageNum}\n` +
          `- Fecha límite para confirmar (pago): ${formattedDate}\n\n` +
          `Por favor, complete el pago para garantizar que su espacio no sea liberado.\n\n` +
          `Gracias,\nEquipo de Coordinación Publicitaria`;

        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerEmail, subject, text, background: true })
        });
        const data = await response.json();
        if (data.success) {
          emailSuccess = true;
        }
      } catch (err) {
        console.error('Error sending payment reminder email:', err);
      }
    }

    const now = new Date().toISOString();
    try {
      if (isOrder) {
        const currentOrder = orders.find(o => o.id === targetId);
        const currentCount = currentOrder?.emailRemindersCount || 0;
        const newCount = currentCount + 1;

        const { error } = await supabase
          .from('orders')
          .update({ 
            reminder_sent_at: now, 
            email_reminder_sent_at: now,
            email_reminders_count: newCount
          })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, reminderSentAt: now, emailReminderSentAt: now, emailRemindersCount: newCount } : o));
      } else {
        let currentCount = 0;
        pages.forEach(p => {
          if (p.page_number === pageNum && p.ads) {
            const ad = p.ads.find(a => a.id === targetId);
            if (ad) currentCount = ad.emailRemindersCount || 0;
          }
        });
        const newCount = currentCount + 1;

        const { error } = await supabase
          .from('ad_reservations')
          .update({ 
            reminder_sent_at: now, 
            email_reminder_sent_at: now,
            email_reminders_count: newCount
          })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state inside pages
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, reminderSentAt: now, emailReminderSentAt: now, emailRemindersCount: newCount } : ad) : [];
            return {
              ...p,
              ads: updatedAds
            };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error('Error updating database with reminder timestamp:', err);
      // Local fallback updates
      if (isOrder) {
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, reminderSentAt: now, emailReminderSentAt: now, emailRemindersCount: (o.emailRemindersCount || 0) + 1 } : o));
      } else {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, reminderSentAt: now, emailReminderSentAt: now, emailRemindersCount: (ad.emailRemindersCount || 0) + 1 } : ad) : [];
            return {
              ...p,
              ads: updatedAds
            };
          }
          return p;
        }));
      }
    }

    logAction('send_email_payment_reminder', targetId, customerName, productName, pageNum, 0, 0, 0, 0, null, false, { isOrder, expiresAt, customerEmail, customerPhone, emailSuccess });

    return { emailSuccess };
  };

  const trackWhatsAppReminderSent = async (targetId, pageNum, isOrder = false) => {
    const now = new Date().toISOString();
    try {
      if (isOrder) {
        const currentOrder = orders.find(o => o.id === targetId);
        const currentCount = currentOrder?.whatsappRemindersCount || 0;
        const newCount = currentCount + 1;

        const { error } = await supabase
          .from('orders')
          .update({ 
            whatsapp_reminder_sent_at: now,
            whatsapp_reminders_count: newCount
          })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, whatsappReminderSentAt: now, whatsappRemindersCount: newCount } : o));
      } else {
        let currentCount = 0;
        pages.forEach(p => {
          if (p.page_number === pageNum && p.ads) {
            const ad = p.ads.find(a => a.id === targetId);
            if (ad) currentCount = ad.whatsappRemindersCount || 0;
          }
        });
        const newCount = currentCount + 1;

        const { error } = await supabase
          .from('ad_reservations')
          .update({ 
            whatsapp_reminder_sent_at: now,
            whatsapp_reminders_count: newCount
          })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state inside pages
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, whatsappReminderSentAt: now, whatsappRemindersCount: newCount } : ad) : [];
            return {
              ...p,
              ads: updatedAds
            };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error('Error updating database with whatsapp reminder timestamp:', err);
      // Local fallback updates
      if (isOrder) {
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, whatsappReminderSentAt: now, whatsappRemindersCount: (o.whatsappRemindersCount || 0) + 1 } : o));
      } else {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, whatsappReminderSentAt: now, whatsappRemindersCount: (ad.whatsappRemindersCount || 0) + 1 } : ad) : [];
            return {
              ...p,
              ads: updatedAds
            };
          }
          return p;
        }));
      }
    }
    logAction('send_whatsapp_payment_reminder', targetId, null, null, pageNum, 0, 0, 0, 0, null, false, { isOrder });
  };

  const addInvoiceWithReservation = async (invoiceData, adDetails) => {
    const id = await getNextInvoiceId();
    const newInvoice = {
      id,
      createdAt: new Date().toISOString(),
      status: 'Active',
      paymentMethod: 'Cash',
      isPaid: true,
      ...invoiceData
    };

    const pageNum = invoiceData.assignedPage;

    try {
      const { error: invErr } = await supabase
        .from('invoices')
        .insert([toDbInvoice(newInvoice)]);
      if (invErr) throw invErr;

      const { error: adErr } = await supabase
        .from('ad_reservations')
        .insert([toDbAd(adDetails, pageNum)]);
      if (adErr) throw adErr;

      // Immediately update local states (don't wait for realtime)
      setInvoices(prev => [newInvoice, ...prev]);
      if (pageNum) {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const pageAds = p.ads ? [...p.ads] : [];
            pageAds.push(fromDbAd(toDbAd(adDetails, pageNum)));
            return { ...p, ads: pageAds, status: 'Reserved' };
          }
          return p;
        }));
      }

      logAction('create_invoice_with_reservation', newInvoice.id, newInvoice.customerName, newInvoice.productName, newInvoice.assignedPage, newInvoice.price, newInvoice.designPrice, newInvoice.vat, newInvoice.total, newInvoice.paymentMethod, newInvoice.isPaid, { newInvoice, adDetails });
      return newInvoice;
    } catch (err) {
      console.error("Error creating invoice with reservation:", err);
      // Fallback update
      setInvoices(prev => [newInvoice, ...prev]);
      if (pageNum) {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const pageAds = p.ads ? [...p.ads] : [];
            pageAds.push(fromDbAd(toDbAd(adDetails, pageNum)));
            return { ...p, ads: pageAds, status: 'Reserved' };
          }
          return p;
        }));
      }
      logAction('create_invoice_with_reservation', newInvoice.id, newInvoice.customerName, newInvoice.productName, newInvoice.assignedPage, newInvoice.price, newInvoice.designPrice, newInvoice.vat, newInvoice.total, newInvoice.paymentMethod, newInvoice.isPaid, { newInvoice, adDetails, isFallback: true });
      return newInvoice;
    }
  };

  const addRecibo = async (reciboData) => {
    const id = 'REC-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const newRecibo = {
      id,
      status: 'Active',
      paymentMethod: 'Cash',
      isPaid: true,
      isRecibo: true,
      vat: 0,
      designPrice: reciboData.designPrice || 0,
      total: reciboData.price + (reciboData.designPrice || 0),
      ...reciboData
    };

    const adDetails = {
      ad_type: reciboData.productName,
      customer_id: reciboData.customerId || 'legacy',
      customer_name: reciboData.customerName,
      isPreReserved: false,
      expires_at: null,
      artworkOption: '1',
      designWorkOption: null,
      designWorkPrice: reciboData.designPrice || 0,
      isNew: true,
      isRecibo: true,
      isPaid: true,
      paymentMethod: 'Cash'
    };

    try {
      const { error } = await supabase
        .from('recibos')
        .insert([toDbRecibo(newRecibo)]);
      if (error) throw error;

      // Save ad on page
      const { error: adErr } = await supabase
        .from('ad_reservations')
        .insert([toDbAd(adDetails, reciboData.assignedPage)]);
      if (adErr) throw adErr;

      // Immediately update local pages state (don't wait for realtime)
      setRecibos(prev => [newRecibo, ...prev]);
      setPages(prevPages => prevPages.map(p => {
        if (p.page_number === reciboData.assignedPage) {
          const pageAds = p.ads ? [...p.ads] : [];
          pageAds.push(fromDbAd(toDbAd(adDetails, reciboData.assignedPage)));
          return { ...p, ads: pageAds, status: 'Reserved' };
        }
        return p;
      }));

      logAction('create_recibo', newRecibo.id, newRecibo.customerName, newRecibo.productName, newRecibo.assignedPage, newRecibo.price, newRecibo.designPrice, 0, newRecibo.total, newRecibo.paymentMethod, newRecibo.isPaid, newRecibo);
      return newRecibo;
    } catch (err) {
      console.error("Error inserting recibo:", err);
      
      // Fallback: update recibos state
      setRecibos(prev => [newRecibo, ...prev]);

      // Fallback: update local pages state
      setPages(prevPages => prevPages.map(p => {
        if (p.page_number === reciboData.assignedPage) {
          const pageAds = p.ads ? [...p.ads] : [];
          pageAds.push(fromDbAd(toDbAd(adDetails, reciboData.assignedPage)));
          return { ...p, ads: pageAds, status: 'Reserved' };
        }
        return p;
      }));

      logAction('create_recibo', newRecibo.id, newRecibo.customerName, newRecibo.productName, newRecibo.assignedPage, newRecibo.price, newRecibo.designPrice, 0, newRecibo.total, newRecibo.paymentMethod, newRecibo.isPaid, newRecibo);
      return newRecibo;
    }
  };

  const deleteRecibo = async (id) => {
    const rec = recibos.find(r => r.id === id);
    try {
      if (rec && rec.assignedPage) {
        const { error: adErr } = await supabase
          .from('ad_reservations')
          .delete()
          .eq('page_number', rec.assignedPage)
          .eq('customer_name', rec.customerName)
          .eq('ad_type', rec.productName);
        if (adErr) console.error("Ad delete error for recibo deletion:", adErr);
        await updatePageStatusIfEmpty(rec.assignedPage);
      }

      const { error } = await supabase
        .from('recibos')
        .delete()
        .eq('id', id);
      if (error) throw error;

      // Immediately update local states
      setRecibos(prev => prev.filter(r => r.id !== id));
      if (rec && rec.assignedPage) {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === rec.assignedPage) {
            const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === rec.customerName && ad.ad_type === rec.productName)) : [];
            return { ...p, ads: pageAds, status: pageAds.length > 0 ? 'Reserved' : 'Available' };
          }
          return p;
        }));
      }

      logAction('delete_recibo', id, rec?.customerName, rec?.productName, rec?.assignedPage, rec?.price, rec?.designPrice, 0, rec?.total, rec?.paymentMethod, rec?.isPaid, rec);
    } catch (err) {
      console.error("Error deleting recibo:", err);
      
      const rec = recibos.find(r => r.id === id);
      if (rec) {
        setRecibos(prev => prev.filter(r => r.id !== id));
        if (rec.assignedPage) {
          setPages(prevPages => {
            const updatedPages = prevPages.map(p => {
              if (p.page_number === rec.assignedPage) {
                const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === rec.customerName && ad.ad_type === rec.productName)) : [];
                return {
                  ...p,
                  ads: pageAds,
                  status: pageAds.length > 0 ? 'Reserved' : 'Available'
                };
              }
              return p;
            });

            if (typeof window !== 'undefined' && window.localStorage) {
              try {
                fallbackPagesData.forEach((p, idx) => {
                  if (p.page_number === rec.assignedPage) {
                    const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === rec.customerName && ad.ad_type === rec.productName)) : [];
                    fallbackPagesData[idx] = {
                      ...p,
                      ads: pageAds,
                      status: pageAds.length > 0 ? 'Reserved' : 'Available'
                    };
                  }
                });
                localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
              } catch (e) {
                console.error("Error persisting to localStorage:", e);
              }
            }
            return updatedPages;
          });
        }
      }
      logAction('delete_recibo', id, rec?.customerName, rec?.productName, rec?.assignedPage, rec?.price, rec?.designPrice, 0, rec?.total, rec?.paymentMethod, rec?.isPaid, rec);
    }
  };

  // Actions for page ads directly (ReservationPanel.jsx deletion logic / resolving)
  const addAdReservation = async (pageNum, ad) => {
    try {
      const { error } = await supabase
        .from('ad_reservations')
        .insert([toDbAd(ad, pageNum)]);
      if (error) throw error;
    } catch (err) {
      console.error("Error adding ad reservation:", err);
      
      setPages(prevPages => {
        const updatedPages = prevPages.map(p => {
          if (p.page_number === pageNum) {
            const pageAds = p.ads ? [...p.ads] : [];
            pageAds.push(fromDbAd(toDbAd(ad, pageNum)));
            return {
              ...p,
              ads: pageAds,
              status: 'Reserved'
            };
          }
          return p;
        });

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            fallbackPagesData.forEach((p, idx) => {
              if (p.page_number === pageNum) {
                const pageAds = p.ads ? [...p.ads] : [];
                pageAds.push(fromDbAd(toDbAd(ad, pageNum)));
                fallbackPagesData[idx] = {
                  ...p,
                  ads: pageAds,
                  status: 'Reserved'
                };
              }
            });
            localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
          } catch (e) {
            console.error("Error persisting to localStorage:", e);
          }
        }
        return updatedPages;
      });
    }
  };

  const updatePageStatusIfEmpty = async (pageNum) => {
    if (!pageNum) return;
    try {
      const { data: remainingAds, error: remainingErr } = await supabase
        .from('ad_reservations')
        .select('id')
        .eq('page_number', pageNum);
      
      if (!remainingErr && (!remainingAds || remainingAds.length === 0)) {
        const { error: pageErr } = await supabase
          .from('magazine_pages')
          .update({ status: 'Available' })
          .eq('page_number', pageNum);
        if (pageErr) console.error("Error updating page status to Available:", pageErr);
      }
    } catch (e) {
      console.error("Error checking remaining ads or updating page status:", e);
    }
  };

  const deleteAdReservationDirect = async (pageNum, customerName, adType) => {
    try {
      const { error } = await supabase
        .from('ad_reservations')
        .delete()
        .eq('page_number', pageNum)
        .eq('customer_name', customerName)
        .eq('ad_type', adType);
      if (error) throw error;
      await updatePageStatusIfEmpty(pageNum);
    } catch (err) {
      console.error("Error deleting ad reservation:", err);
      
      setPages(prevPages => {
        const updatedPages = prevPages.map(p => {
          if (p.page_number === pageNum) {
            const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === customerName && ad.ad_type === adType)) : [];
            return {
              ...p,
              ads: pageAds,
              status: pageAds.length > 0 ? 'Reserved' : 'Available'
            };
          }
          return p;
        });

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            fallbackPagesData.forEach((p, idx) => {
              if (p.page_number === pageNum) {
                const pageAds = p.ads ? p.ads.filter(ad => !(ad.customer_name === customerName && ad.ad_type === adType)) : [];
                fallbackPagesData[idx] = {
                  ...p,
                  ads: pageAds,
                  status: pageAds.length > 0 ? 'Reserved' : 'Available'
                };
              }
            });
            localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
          } catch (e) {
            console.error("Error persisting to localStorage:", e);
          }
        }
        return updatedPages;
      });
    }
    logAction('delete_ad_reservation', null, customerName, adType, pageNum, 0, 0, 0, 0, null, false, { pageNum, customerName, adType });
  };

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

  const publicConfirmPurchase = async (targetId, isOrder, customerEmail, customerName, pageNum) => {
    try {
      if (isOrder) {
        const { error } = await supabase
          .from('orders')
          .update({ order_type: 'transfer', status: 'Pending', is_paid: false })
          .eq('id', targetId);
        if (error) throw error;
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, orderType: 'transfer', status: 'Pending', isPaid: false } : o));
      } else {
        const { error } = await supabase
          .from('ad_reservations')
          .update({ is_pre_reserved: false, expires_at: null })
          .eq('id', targetId);
        if (error) throw error;
        setPages(prev => prev.map(p => {
          if (p.page_number === pageNum) {
            const ads = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, isPreReserved: false, expires_at: null } : ad) : [];
            return { ...p, ads };
          }
          return p;
        }));
      }

      // Send confirmation email
      if (customerEmail) {
        const subject = `Compra Confirmada: Reserva Pág. ${pageNum} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola ${customerName || 'Cliente'},\n\nConfirmamos que ha elegido comprar el anuncio y realizar una transferencia para la reserva de la página ${pageNum}.\n\nPor favor, realice la transferencia bancaria lo antes posible para completar su compra.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        const html = getEmailHtml(
          'Compra Confirmada',
          `<p>Hola <strong>${customerName || 'Cliente'}</strong>,</p>
           <p>Confirmamos que ha elegido comprar el anuncio y realizar una transferencia para la reserva de la <strong>página ${pageNum}</strong>.</p>
           <p>Por favor, realice la transferencia bancaria lo antes posible para completar su compra.</p>
           <p>Si tiene alguna pregunta, no dude en responder a este correo.</p>`
        );
        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerEmail, subject, text, html, background: true })
        });
      }
      logAction('public_confirm_purchase', targetId, customerName, null, pageNum, 0, 0, 0, 0, 'Transfer', false, { isOrder, customerEmail });
      return true;
    } catch (err) {
      console.error("Error confirming purchase publicly:", err);
      return false;
    }
  };

  const publicProlongReservation = async (targetId, newExpiresAt, isOrder, customerEmail, customerName, pageNum) => {
    try {
      const formattedDate = new Date(newExpiresAt).toLocaleDateString();
      if (isOrder) {
        const { error } = await supabase
          .from('orders')
          .update({ expires_at: newExpiresAt })
          .eq('id', targetId);
        if (error) throw error;
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, expires_at: newExpiresAt, prolongedCount: 1 } : o));
      } else {
        const { error } = await supabase
          .from('ad_reservations')
          .update({ expires_at: newExpiresAt })
          .eq('id', targetId);
        if (error) throw error;
        setPages(prev => prev.map(p => {
          if (p.page_number === pageNum) {
            const ads = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, expires_at: newExpiresAt, prolongedCount: 1 } : ad) : [];
            return { ...p, ads };
          }
          return p;
        }));
      }

      // Send confirmation email
      if (customerEmail) {
        const subject = `Pre-reserva Prolongada: Pág. ${pageNum} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola ${customerName || 'Cliente'},\n\nSu pre-reserva para la página ${pageNum} ha sido prolongada con éxito hasta el ${formattedDate}.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        const html = getEmailHtml(
          'Pre-reserva Prolongada',
          `<p>Hola <strong>${customerName || 'Cliente'}</strong>,</p>
           <p>Su pre-reserva para la <strong>página ${pageNum}</strong> ha sido prolongada con éxito.</p>
           <p>La nueva fecha de vencimiento es el <strong>${formattedDate}</strong>.</p>
           <p>Asegúrese de realizar el pago antes de esa fecha para confirmar su espacio definitivamente.</p>`
        );
        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerEmail, subject, text, html, background: true })
        });
      }
      logAction('public_prolong_reservation', targetId, customerName, null, pageNum, 0, 0, 0, 0, null, false, { isOrder, newExpiresAt, customerEmail });
      return true;
    } catch (err) {
      console.error("Error prolonging pre-reservation publicly:", err);
      return false;
    }
  };

  const publicCancelReservation = async (targetId, pageNum, customerName, adType, isOrder, customerEmail) => {
    try {
      if (isOrder) {
        await deleteOrder(targetId);
      } else {
        await deleteAdReservationDirect(pageNum, customerName, adType);
      }

      // Send confirmation email
      if (customerEmail) {
        const subject = `Reserva Cancelada: Pág. ${pageNum} - Revista de Fiestas Patronales Becerril de la Sierra 2026`;
        const text = `Hola ${customerName || 'Cliente'},\n\nConfirmamos que su pre-reserva para la página ${pageNum} ha sido cancelada y el espacio ha sido liberado.\n\nGracias,\nEquipo de Coordinación Publicitaria`;
        const html = getEmailHtml(
          'Pre-reserva Cancelada',
          `<p>Hola <strong>${customerName || 'Cliente'}</strong>,</p>
           <p>Confirmamos que su pre-reserva para la <strong>página ${pageNum}</strong> ha sido cancelada y el espacio publicitario ha sido liberado.</p>
           <p>Esperamos volver a colaborar con usted en futuras ediciones.</p>`
        );
        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerEmail, subject, text, html, background: true })
        });
      }
      logAction('public_cancel_reservation', targetId, customerName, adType, pageNum, 0, 0, 0, 0, null, false, { isOrder, customerEmail });
      return true;
    } catch (err) {
      console.error("Error cancelling pre-reservation publicly:", err);
      return false;
    }
  };

  const resolvePreReservation = async (pageNum, customerName, adType, action, prolongDateStr = '') => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const dateToUse = prolongDateStr ? new Date(prolongDateStr).toISOString() : nextWeek;

    const updateLocalState = () => {
      setPages(prevPages => {
        const updatedPages = prevPages.map(p => {
          if (p.page_number === pageNum) {
            const pageAds = p.ads ? p.ads.map(ad => {
              if (ad.customer_name === customerName && ad.ad_type === adType) {
                if (action === 'confirm') {
                  return { ...ad, isPreReserved: false, expires_at: null };
                } else if (action === 'prolong') {
                  return { ...ad, expires_at: dateToUse };
                }
              }
              return ad;
            }) : [];
            return {
              ...p,
              ads: pageAds
            };
          }
          return p;
        });

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            fallbackPagesData.forEach((p, idx) => {
              if (p.page_number === pageNum) {
                const pageAds = p.ads ? p.ads.map(ad => {
                  if (ad.customer_name === customerName && ad.ad_type === adType) {
                    if (action === 'confirm') {
                      return { ...ad, isPreReserved: false, expires_at: null };
                    } else if (action === 'prolong') {
                      return { ...ad, expires_at: dateToUse };
                    }
                  }
                  return ad;
                }) : [];
                fallbackPagesData[idx] = {
                  ...p,
                  ads: pageAds,
                  status: 'Reserved'
                };
              }
            });
            localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
          } catch (e) {
            console.error("Error persisting to localStorage:", e);
          }
        }
        return updatedPages;
      });
    };

    try {
      if (action === 'confirm') {
        const { error } = await supabase
          .from('ad_reservations')
          .update({ is_pre_reserved: false, expires_at: null })
          .eq('page_number', pageNum)
          .eq('customer_name', customerName)
          .eq('ad_type', adType);
        if (error) throw error;
      } else if (action === 'prolong') {
        const { error } = await supabase
          .from('ad_reservations')
          .update({ expires_at: dateToUse })
          .eq('page_number', pageNum)
          .eq('customer_name', customerName)
          .eq('ad_type', adType);
        if (error) throw error;
      } else if (action === 'cancel') {
        await deleteAdReservationDirect(pageNum, customerName, adType);
      }

      if (action !== 'cancel') {
        updateLocalState();
      }
    } catch (err) {
      console.error("Error resolving pre-reservation:", err);
      if (action !== 'cancel') {
        updateLocalState();
      }
    }
    logAction('resolve_pre_reservation', null, customerName, adType, pageNum, 0, 0, 0, 0, null, false, { action, prolongDateStr });
  };

  // ============================================================
  // PAGE SIZE MANAGEMENT
  // ============================================================

  // Persisted "original" snapshot (92-page layout). Saved once on first load.
  const ORIGINAL_PAGE_COUNT = 92;

  const saveOriginalSnapshot = (pagesArray) => {
    try {
      const existing = localStorage.getItem('becerril_original_snapshot');
      if (!existing) {
        // Only save snapshot pages up to 92 (the editorial ones)
        const snapshot = pagesArray
          .filter(p => typeof p.page_number === 'number' && p.page_number <= ORIGINAL_PAGE_COUNT)
          .map(p => ({ page_number: p.page_number, status: p.status, ad_type: p.ad_type || null }));
        localStorage.setItem('becerril_original_snapshot', JSON.stringify(snapshot));
      }
    } catch (e) {
      console.error('Error saving original snapshot:', e);
    }
  };

  // Save snapshot whenever pages first load (runs once)
  useEffect(() => {
    if (pages && pages.length > 0) {
      saveOriginalSnapshot(pages);
    }
  }, [pages.length > 0]);

  /**
   * Expand the magazine by `additionalCount` pages (multiples of 4).
   * New pages are inserted before the back-covers (which get renumbered to the end).
   */
  const expandPages = async (additionalCount) => {
    const currentTotal = pages.length;

    // Identify back-cover pages (91 and 92 in original; or the last 2 in expanded layout)
    // We find the 2 pages at the very end that are marked as cover candidates
    const currentPageNums = pages.map(p => p.page_number).filter(n => typeof n === 'number').sort((a, b) => a - b);
    const backCoverA = currentPageNums[currentPageNums.length - 2]; // e.g. 91
    const backCoverB = currentPageNums[currentPageNums.length - 1]; // e.g. 92
    const insertPoint = backCoverA; // insert new pages starting here
    const newTotal = currentTotal + additionalCount;

    // Build new page objects
    const newPageNumbers = [];
    for (let i = insertPoint; i < insertPoint + additionalCount; i++) {
      newPageNumbers.push(i);
    }
    const newBackCoverA = insertPoint + additionalCount;     // e.g. 91+4 = 95
    const newBackCoverB = insertPoint + additionalCount + 1; // e.g. 96

    // 1. Renumber back covers in Supabase
    try {
      // Update back-cover A
      await supabase.from('magazine_pages')
        .update({ page_number: newBackCoverA })
        .eq('page_number', backCoverA);
      // Update back-cover B
      await supabase.from('magazine_pages')
        .update({ page_number: newBackCoverB })
        .eq('page_number', backCoverB);

      // Insert new Available pages
      const insertRows = newPageNumbers.map(num => ({
        page_number: num,
        status: 'Available',
        ad_type: null
      }));
      await supabase.from('magazine_pages').insert(insertRows);
    } catch (err) {
      console.error('Error expanding pages in Supabase:', err);
    }

    // 2. Update local state
    setPages(prev => {
      const updated = prev.map(p => {
        if (p.page_number === backCoverA) return { ...p, page_number: newBackCoverA };
        if (p.page_number === backCoverB) return { ...p, page_number: newBackCoverB };
        return p;
      });
      const newPages = newPageNumbers.map(num => ({
        page_number: num,
        status: 'Available',
        ad_type: null,
        ads: []
      }));
      // Insert new pages at the correct position
      const insertIdx = updated.findIndex(p => p.page_number === newBackCoverA);
      const result = [
        ...updated.slice(0, insertIdx),
        ...newPages,
        ...updated.slice(insertIdx)
      ].sort((a, b) => a.page_number - b.page_number);

      // Persist to localStorage
      try {
        localStorage.setItem('becerril_magazine_pages', JSON.stringify(result));
        localStorage.setItem('becerril_page_count', String(newTotal));
      } catch (e) { /* ignore */ }

      return result;
    });

    logAction('expand_pages', null, null, null, null, 0, 0, 0, 0, null, false, {
      additionalCount,
      newTotal,
      newBackCoverA,
      newBackCoverB
    });

    return { newTotal, newBackCoverA, newBackCoverB };
  };

  /**
   * Helper: send a page-change notification email to a customer.
   */
  const sendPageChangeEmail = async ({ to, productName, oldPage, newPage, deleted = false }) => {
    if (!to) return;
    const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
    const subject = `Actualización de su reserva – Revista de Fiestas Patronales Becerril de la Sierra 2026`;
    let text;
    if (deleted) {
      text =
        `Hola,\n\n` +
        `Le informamos de que la Revista de Fiestas Patronales Becerril de la Sierra 2026 ha experimentado cambios en su estructura de páginas.\n\n` +
        `Como resultado, el espacio publicitario que tenía reservado en la página ${oldPage} (${productName || 'Anuncio'}) ha sido liberado y ya no está disponible en esa ubicación.\n\n` +
        `Por favor, póngase en contacto con nosotros para que podamos reasignarle un espacio alternativo.\n\n` +
        `Gracias por su comprensión,\n` +
        `Equipo de Coordinación Publicitaria`;
    } else {
      text =
        `Hola,\n\n` +
        `Le informamos de que la Revista de Fiestas Patronales Becerril de la Sierra 2026 ha experimentado cambios en su estructura de páginas.\n\n` +
        `Los detalles actualizados de su reserva son:\n` +
        `- Producto: ${productName || 'Anuncio'}\n` +
        `- Su página asignada actual es ahora: ${newPage}\n\n` +
        `Si tiene alguna pregunta, no dude en contactarnos.\n\n` +
        `Gracias,\n` +
        `Equipo de Coordinación Publicitaria`;
    }
    try {
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, background: true })
      });
    } catch (err) {
      console.error('Error sending page change email:', err);
    }
  };

  /**
   * Restore the magazine to the original 92-page layout.
   * Pages beyond #90 (excluding 91/92) are removed, and back-covers are re-mapped to 91/92.
   * Sends email notifications to affected customers.
   */
  const restoreOriginalPages = async () => {
    const currentPageNums = pages.map(p => p.page_number).filter(n => typeof n === 'number').sort((a, b) => a - b);
    const backCoverA = currentPageNums[currentPageNums.length - 2];
    const backCoverB = currentPageNums[currentPageNums.length - 1];
    const extraPages = currentPageNums.filter(n => n > 90 && n !== backCoverA && n !== backCoverB);

    if (extraPages.length === 0 && backCoverA === 91 && backCoverB === 92) {
      return { alreadyOriginal: true };
    }

    // 0. Collect affected customers BEFORE deletion for email notifications
    const affectedForEmail = [];
    for (const pageNum of extraPages) {
      const pageOrders = orders.filter(o => o.assignedPage === String(pageNum) && o.customerEmail);
      pageOrders.forEach(o => affectedForEmail.push({
        to: o.customerEmail,
        productName: o.productName,
        oldPage: pageNum,
        deleted: true
      }));
    }

    // 1. Delete extra ad reservations for pages being removed
    if (extraPages.length > 0) {
      try {
        await supabase.from('ad_reservations').delete().in('page_number', extraPages);
        await supabase.from('magazine_pages').delete().in('page_number', extraPages);
      } catch (err) {
        console.error('Error deleting extra pages from Supabase:', err);
      }
    }

    // 2. Renumber back covers back to 91 and 92
    if (backCoverA !== 91 || backCoverB !== 92) {
      try {
        await supabase.from('magazine_pages').update({ page_number: 91 }).eq('page_number', backCoverA);
        await supabase.from('magazine_pages').update({ page_number: 92 }).eq('page_number', backCoverB);
        await supabase.from('ad_reservations').update({ page_number: 91 }).eq('page_number', backCoverA);
        await supabase.from('ad_reservations').update({ page_number: 92 }).eq('page_number', backCoverB);
        await supabase.from('orders').update({ assigned_page: '91' }).eq('assigned_page', String(backCoverA));
        await supabase.from('orders').update({ assigned_page: '92' }).eq('assigned_page', String(backCoverB));
        await supabase.from('invoices').update({ assigned_page: '91' }).eq('assigned_page', String(backCoverA));
        await supabase.from('invoices').update({ assigned_page: '92' }).eq('assigned_page', String(backCoverB));
      } catch (err) {
        console.error('Error renumbering back covers in Supabase:', err);
      }
    }

    // 3. Update local state
    setPages(prev => {
      const trimmed = prev
        .filter(p => !extraPages.includes(p.page_number))
        .map(p => {
          if (p.page_number === backCoverA) return { ...p, page_number: 91 };
          if (p.page_number === backCoverB) return { ...p, page_number: 92 };
          return p;
        })
        .sort((a, b) => a.page_number - b.page_number);

      try {
        localStorage.setItem('becerril_magazine_pages', JSON.stringify(trimmed));
        localStorage.setItem('becerril_page_count', '92');
      } catch (e) { /* ignore */ }

      return trimmed;
    });

    // 4. Update local orders and invoices
    if (backCoverA !== 91) {
      setOrders(prev => prev.map(o => {
        if (o.assignedPage === String(backCoverA)) return { ...o, assignedPage: '91' };
        if (o.assignedPage === String(backCoverB)) return { ...o, assignedPage: '92' };
        return o;
      }));
      setInvoices(prev => prev.map(inv => {
        if (inv.assignedPage === String(backCoverA)) return { ...inv, assignedPage: '91' };
        if (inv.assignedPage === String(backCoverB)) return { ...inv, assignedPage: '92' };
        return inv;
      }));
    }

    logAction('restore_original_pages', null, null, null, null, 0, 0, 0, 0, null, false, {
      removedPages: extraPages,
      backCoverA,
      backCoverB
    });

    // 5. Send email notifications (fire-and-forget)
    affectedForEmail.forEach(info => sendPageChangeEmail(info));

    return { restored: true, removedCount: extraPages.length };
  };

  /**
   * Reorder: move fromPageNum to toPageNum position, shifting all pages between.
   * - Moving forward (from < to): pages from+1..to each shift back by 1, from→to
   * - Moving backward (from > to): pages to..from-1 each shift forward by 1, from→to
   * Cascades to: ad_reservations, orders, invoices, recibos.
   * Sends email notification to any customer whose page number changed.
   */
  const reorderPage = async (fromPageNum, toPageNum) => {
    if (fromPageNum === toPageNum) return;

    const sortedNums = pages
      .map(p => p.page_number)
      .filter(n => typeof n === 'number')
      .sort((a, b) => a - b);

    // Build mapping: oldPageNum → newPageNum
    const mapping = new Map();
    if (fromPageNum < toPageNum) {
      mapping.set(fromPageNum, toPageNum);
      for (let p = fromPageNum + 1; p <= toPageNum; p++) {
        if (sortedNums.includes(p)) mapping.set(p, p - 1);
      }
    } else {
      mapping.set(fromPageNum, toPageNum);
      for (let p = toPageNum; p < fromPageNum; p++) {
        if (sortedNums.includes(p)) mapping.set(p, p + 1);
      }
    }

    const OFFSET = 100000;
    const affectedOldNums = Array.from(mapping.keys());

    // Collect customers who will have their page number changed for email notifications
    const emailQueue = [];
    for (const [oldNum, newNum] of mapping.entries()) {
      if (oldNum === newNum) continue;
      const affected = orders.filter(o => o.assignedPage === String(oldNum) && o.customerEmail);
      affected.forEach(o => emailQueue.push({
        to: o.customerEmail,
        productName: o.productName,
        oldPage: oldNum,
        newPage: newNum,
        deleted: false
      }));
    }

    try {
      // Step 1: Offset all affected magazine_pages to avoid unique PK conflicts
      for (const oldNum of affectedOldNums) {
        await supabase.from('magazine_pages').update({ page_number: oldNum + OFFSET }).eq('page_number', oldNum);
      }
      // Also offset ad_reservations and string-based tables
      for (const oldNum of affectedOldNums) {
        await supabase.from('ad_reservations').update({ page_number: oldNum + OFFSET }).eq('page_number', oldNum);
        await supabase.from('orders').update({ assigned_page: String(oldNum + OFFSET) }).eq('assigned_page', String(oldNum));
        await supabase.from('invoices').update({ assigned_page: String(oldNum + OFFSET) }).eq('assigned_page', String(oldNum));
        await supabase.from('recibos').update({ assigned_page: String(oldNum + OFFSET) }).eq('assigned_page', String(oldNum));
      }

      // Step 2: Set each to its final new value
      for (const [oldNum, newNum] of mapping.entries()) {
        await supabase.from('magazine_pages').update({ page_number: newNum }).eq('page_number', oldNum + OFFSET);
        await supabase.from('ad_reservations').update({ page_number: newNum }).eq('page_number', oldNum + OFFSET);
        await supabase.from('orders').update({ assigned_page: String(newNum) }).eq('assigned_page', String(oldNum + OFFSET));
        await supabase.from('invoices').update({ assigned_page: String(newNum) }).eq('assigned_page', String(oldNum + OFFSET));
        await supabase.from('recibos').update({ assigned_page: String(newNum) }).eq('assigned_page', String(oldNum + OFFSET));
      }
    } catch (err) {
      console.error('Error reordering pages in Supabase:', err);
      throw err;
    }

    // Update local state
    setPages(prev => {
      const result = prev.map(p => {
        const newNum = mapping.get(p.page_number);
        if (newNum !== undefined) return { ...p, page_number: newNum };
        return p;
      }).sort((a, b) => a.page_number - b.page_number);
      try { localStorage.setItem('becerril_magazine_pages', JSON.stringify(result)); } catch (e) {}
      return result;
    });

    setOrders(prev => prev.map(o => {
      const oldNum = parseInt(o.assignedPage);
      const newNum = mapping.get(oldNum);
      return newNum !== undefined ? { ...o, assignedPage: String(newNum) } : o;
    }));

    setInvoices(prev => prev.map(inv => {
      const oldNum = parseInt(inv.assignedPage);
      const newNum = mapping.get(oldNum);
      return newNum !== undefined ? { ...inv, assignedPage: String(newNum) } : inv;
    }));

    setRecibos(prev => prev.map(r => {
      const oldNum = parseInt(r.assignedPage);
      const newNum = mapping.get(oldNum);
      return newNum !== undefined ? { ...r, assignedPage: String(newNum) } : r;
    }));

    logAction('reorder_pages', null, null, null, null, 0, 0, 0, 0, null, false, {
      fromPageNum,
      toPageNum,
      pagesAffected: affectedOldNums.length
    });

    // Send email notifications (fire-and-forget)
    emailQueue.forEach(info => sendPageChangeEmail(info));
  };

  return (
    <DatabaseContext.Provider value={{
      pages,
      invoices,
      recibos,
      orders,
      settings,
      templates,
      loading,
      session,
      addInvoice,
      addInvoiceWithReservation,
      updateInvoicePayment,
      cancelInvoice,
      deleteInvoice,
      hardDeleteInvoice,
      reserveInvoiceNumber,
      addOrder,
      deleteOrder,
      updateOrder,
      confirmOrderPayment,
      addRecibo,
      deleteRecibo,
      markInvoiceEmailSent,
      markReciboEmailSent,
      saveInvoiceSettings,
      saveCommunicationTemplate,
      addAdReservation,
      deleteAdReservationDirect,
      resolvePreReservation,
      sendPaymentReminder,
      trackWhatsAppReminderSent,
      publicConfirmPurchase,
      publicProlongReservation,
      publicCancelReservation,
      actionLogs,
      logAction,
      fetchActionLogs,
      expandPages,
      restoreOriginalPages,
      reorderPage,
      reload: loadAllData
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
