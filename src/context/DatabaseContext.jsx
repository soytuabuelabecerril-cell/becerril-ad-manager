import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFullPages, fallbackPagesData } from '../utils/fallbackData';

const DatabaseContext = createContext();

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
  originalInvoiceId: row.original_invoice_id
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
  original_invoice_id: inv.originalInvoiceId
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
  artworkComment: row.artwork_comment
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
  artwork_comment: rec.artworkComment
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
  reminderSentAt: row.reminder_sent_at
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
  customer_phone: ord.customerPhone
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
  reminderSentAt: row.reminder_sent_at
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
  is_recibo: ad.isRecibo || false
});

const fromDbSettings = (row) => ({
  isSequentialEnabled: row.is_sequential_enabled,
  nextInvoiceNumber: row.next_invoice_number
});

const toDbSettings = (settings) => ({
  id: 1,
  is_sequential_enabled: settings.isSequentialEnabled,
  next_invoice_number: settings.nextInvoiceNumber
});

export const DatabaseProvider = ({ children }) => {
  const [pages, setPages] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    isSequentialEnabled: true,
    nextInvoiceNumber: 3
  });
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

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAdsAndPages(),
      fetchInvoices(),
      fetchRecibos(),
      fetchOrders(),
      fetchSettings()
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

      return () => {
        supabase.removeChannel(adsSubscription);
        supabase.removeChannel(invoicesSubscription);
        supabase.removeChannel(recibosSubscription);
        supabase.removeChannel(ordersSubscription);
        supabase.removeChannel(settingsSubscription);
      };
    } else {
      setLoading(false);
    }
  }, [session]);

  // --- Sequential settings ---
  const saveInvoiceSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
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
    let isSeq = settings.isSequentialEnabled;
    let nextNum = settings.nextInvoiceNumber;
    try {
      const { data: dbSettings, error: dbErr } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!dbErr && dbSettings) {
        const fetched = fromDbSettings(dbSettings);
        isSeq = fetched.isSequentialEnabled;
        nextNum = fetched.nextInvoiceNumber;
      }
    } catch (e) {
      console.error("Error fetching settings for next invoice ID:", e);
    }

    if (isSeq && nextNum) {
      const parsedNum = parseInt(nextNum, 10);
      const invoiceId = String(parsedNum).padStart(2, '0') + '_2601';
      
      // Increment sequentially in DB and local state
      await saveInvoiceSettings({
        nextInvoiceNumber: parsedNum + 1
      });
      return invoiceId;
    } else {
      return String(Math.floor(Math.random() * 1000000)).padStart(6, '0') + '_2601';
    }
  };

  // --- Mutation Actions ---

  const addInvoice = async (invoiceData) => {
    const id = await getNextInvoiceId();
    const newInvoice = {
      id,
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
      return newInvoice;
    } catch (err) {
      console.error("Error inserting invoice:", err);
      // Fallback update
      setInvoices(prev => [newInvoice, ...prev]);
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
    } catch (err) {
      console.error("Error updating invoice payment:", err);
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
      }

      if (generateRefund) {
        let isSeq = settings.isSequentialEnabled;
        let nextNum = settings.nextInvoiceNumber;
        try {
          const { data: dbSettings, error: dbErr } = await supabase
            .from('invoice_settings')
            .select('*')
            .eq('id', 1)
            .single();
          if (!dbErr && dbSettings) {
            const fetched = fromDbSettings(dbSettings);
            isSeq = fetched.isSequentialEnabled;
            nextNum = fetched.nextInvoiceNumber;
          }
        } catch (e) {
          console.error("Error fetching settings for refund ID:", e);
        }

        let refundId = '';
        if (isSeq && nextNum) {
          const parsedNum = parseInt(nextNum, 10);
          refundId = 'REF-' + String(parsedNum).padStart(2, '0') + '_2601';
          await saveInvoiceSettings({ nextInvoiceNumber: parsedNum + 1 });
        } else {
          refundId = 'REF-' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0') + '_2601';
        }

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

      if (generateRefund) {
        let refundId;
        if (settings.isSequentialEnabled && settings.nextInvoiceNumber) {
          const nextNum = parseInt(settings.nextInvoiceNumber, 10);
          refundId = 'REF-' + String(nextNum).padStart(2, '0') + '_2601';
          saveInvoiceSettings({ nextInvoiceNumber: nextNum + 1 });
        } else {
          refundId = 'REF-' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0') + '_2601';
        }

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

        setInvoices(prev => [refundInvoice, ...prev]);
      }
    }
  };

  const deleteInvoice = async (id) => {
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
    } catch (err) {
      console.error("Error deleting invoice:", err);
    }
  };

  const hardDeleteInvoice = async (id) => {
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
    } catch (err) {
      console.error("Error hard deleting invoice:", err);
    }
  };

  const reserveInvoiceNumber = async (note = '') => {
    let isSeq = settings.isSequentialEnabled;
    let nextNum = settings.nextInvoiceNumber;
    try {
      const { data: dbSettings, error: dbErr } = await supabase
        .from('invoice_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (!dbErr && dbSettings) {
        const fetched = fromDbSettings(dbSettings);
        isSeq = fetched.isSequentialEnabled;
        nextNum = fetched.nextInvoiceNumber;
      }
    } catch (e) {
      console.error("Error fetching settings for reservation ID:", e);
    }

    if (!isSeq || !nextNum) return null;
    const parsedNum = parseInt(nextNum, 10);
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
      return reservedInvoice;
    } catch (err) {
      console.error("Error reserving invoice ID:", err);
      setInvoices(prev => [reservedInvoice, ...prev]);
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
    }
  };

  const confirmOrderPayment = async (orderId, paymentMethod = 'Transfer') => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return null;

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
        isPaid: true
      });

      // 2. Update matching ad status in ad_reservations to isPaid=true
      const { error: adErr } = await supabase
        .from('ad_reservations')
        .update({ is_paid: true, is_pre_reserved: false, expires_at: null, payment_method: paymentMethod })
        .eq('page_number', order.assignedPage)
        .eq('customer_name', order.customerName)
        .eq('ad_type', order.productName);
      if (adErr) throw adErr;

      // 3. Delete order
      const { error: ordErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);
      if (ordErr) throw ordErr;

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
        isPaid: true
      });

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

      // 3. Remove order locally
      setOrders(prev => prev.filter(o => o.id !== orderId));

      return invoice;
    }
  };

  const sendPaymentReminder = async (customerName, productName, pageNum, expiresAt, customerEmail, customerPhone, targetId, isOrder = false) => {
    let emailSuccess = false;
    const formattedDate = expiresAt ? new Date(expiresAt).toLocaleDateString() : '';

    if (customerEmail) {
      try {
        const subject = `Recordatorio de Reserva: Pág. ${pageNum} - Revista Becerril`;
        const text = `Hola,\n\nLe recordamos que tiene una reserva de espacio publicitario pendiente de pago en la Revista Becerril:\n\n` +
          `- Cliente: ${customerName}\n` +
          `- Producto: ${productName}\n` +
          `- Página Asignada: ${pageNum}\n` +
          `- Fecha límite para confirmar (pago): ${formattedDate}\n\n` +
          `Por favor, complete el pago para garantizar que su espacio no sea liberado.\n\n` +
          `Gracias,\nEquipo Revista Becerril`;

        const apiUrl = import.meta.env.VITE_API_URL || '/api/send-email';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: customerEmail, subject, text })
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
        const { error } = await supabase
          .from('orders')
          .update({ reminder_sent_at: now })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, reminderSentAt: now } : o));
      } else {
        const { error } = await supabase
          .from('ad_reservations')
          .update({ reminder_sent_at: now })
          .eq('id', targetId);
        if (error) throw error;

        // Also update local state inside pages
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, reminderSentAt: now } : ad) : [];
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
        setOrders(prev => prev.map(o => o.id === targetId ? { ...o, reminderSentAt: now } : o));
      } else {
        setPages(prevPages => prevPages.map(p => {
          if (p.page_number === pageNum) {
            const updatedAds = p.ads ? p.ads.map(ad => ad.id === targetId ? { ...ad, reminderSentAt: now } : ad) : [];
            return {
              ...p,
              ads: updatedAds
            };
          }
          return p;
        }));
      }
    }

    return { emailSuccess };
  };

  const addInvoiceWithReservation = async (invoiceData, adDetails) => {
    const id = await getNextInvoiceId();
    const newInvoice = {
      id,
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

      return newRecibo;
    }
  };

  const deleteRecibo = async (id) => {
    try {
      const rec = recibos.find(r => r.id === id);
      if (rec && rec.assignedPage) {
        const { error: adErr } = await supabase
          .from('ad_reservations')
          .delete()
          .eq('page_number', rec.assignedPage)
          .eq('customer_name', rec.customerName)
          .eq('ad_type', rec.productName);
        if (adErr) console.error("Ad delete error for recibo deletion:", adErr);
      }

      const { error } = await supabase
        .from('recibos')
        .delete()
        .eq('id', id);
      if (error) throw error;
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

  const deleteAdReservationDirect = async (pageNum, customerName, adType) => {
    try {
      const { error } = await supabase
        .from('ad_reservations')
        .delete()
        .eq('page_number', pageNum)
        .eq('customer_name', customerName)
        .eq('ad_type', adType);
      if (error) throw error;
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
  };

  return (
    <DatabaseContext.Provider value={{
      pages,
      invoices,
      recibos,
      orders,
      settings,
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
      confirmOrderPayment,
      addRecibo,
      deleteRecibo,
      saveInvoiceSettings,
      addAdReservation,
      deleteAdReservationDirect,
      resolvePreReservation,
      sendPaymentReminder,
      reload: loadAllData
    }}>
      {children}
    </DatabaseContext.Provider>
  );
};
