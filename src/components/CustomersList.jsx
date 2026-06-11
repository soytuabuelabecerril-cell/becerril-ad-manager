import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, FileText, Search, Clock, Bookmark, CheckCircle, Edit2, Bell, X } from 'lucide-react';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import CustomerModal from './CustomerModal';

const CustomersList = ({ onSelectPage }) => {
  const { t, language } = useLanguage();
  const {
    pages,
    invoices,
    recibos,
    orders,
    confirmOrderPayment,
    sendPaymentReminder,
    trackWhatsAppReminderSent,
    logAction
  } = useDatabase();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpenRaw] = useState(() => {
    return localStorage.getItem('cs_isModalOpen') === 'true';
  });
  const setIsModalOpen = (val) => {
    setIsModalOpenRaw(val);
    localStorage.setItem('cs_isModalOpen', val);
  };

  const [selectedCustomer, setSelectedCustomerRaw] = useState(() => {
    const saved = localStorage.getItem('cs_selectedCustomer');
    return saved ? JSON.parse(saved) : null;
  });
  const setSelectedCustomer = (val) => {
    setSelectedCustomerRaw(val);
    if (val) localStorage.setItem('cs_selectedCustomer', JSON.stringify(val));
    else localStorage.removeItem('cs_selectedCustomer');
  };

  const [searchTerm, setSearchTerm] = useState('');

  const [activeState, setActiveStateRaw] = useState(() => {
    return localStorage.getItem('cs_activeState') || 'pending';
  });
  const setActiveState = (val) => {
    setActiveStateRaw(val);
    localStorage.setItem('cs_activeState', val);
  };

  const [liberateModalOpen, setLiberateModalOpen] = useState(false);
  const [liberateCustomer, setLiberateCustomer] = useState(null);
  const [liberatePaymentMethod, setLiberatePaymentMethod] = useState('Transfer');
  const [liberateSuccess, setLiberateSuccess] = useState(false);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState(null);
  const [reminderAd, setReminderAd] = useState(null);
  const [emailReminderStatus, setEmailReminderStatus] = useState({ sending: false, success: false, error: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch customers
        const { data: custData, error: custError } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (custError) throw custError;
        
        if (custData && custData.length > 0) {
          setCustomers(custData);
        } else {
          setCustomers(fallbackCustomers);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
        setCustomers(fallbackCustomers);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);



  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (customerData) => {
    const cleanData = {
      fiscal_name: customerData.fiscal_name || '',
      commercial_name: customerData.commercial_name || '',
      nif: customerData.nif || '',
      category: customerData.category || '',
      address: customerData.address || '',
      email: customerData.email || '',
      whatsapp: customerData.whatsapp || '',
      last_year_product: customerData.last_year_product || '',
      contact_name: customerData.contact_name || ''
    };

    try {
      if (selectedCustomer && selectedCustomer.id && !selectedCustomer.id.startsWith('ext-')) {
        // Update existing in Supabase
        const { error } = await supabase
          .from('customers')
          .update(cleanData)
          .eq('id', selectedCustomer.id);
          
        if (error) throw error;
        
        // Update local state
        setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, ...customerData } : c));
        logAction('update_customer', selectedCustomer.id, cleanData.commercial_name || cleanData.fiscal_name, null, null, 0, 0, 0, 0, null, false, cleanData);
      } else {
        if (selectedCustomer && selectedCustomer.id && selectedCustomer.id.startsWith('ext-')) {
           // Mock update for fallback data
           setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, ...customerData } : c));
        } else {
          // Create new
          const { data, error } = await supabase
            .from('customers')
            .insert([cleanData])
            .select();
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            setCustomers([data[0], ...customers]);
            logAction('create_customer', data[0].id, data[0].commercial_name || data[0].fiscal_name, null, null, 0, 0, 0, 0, null, false, data[0]);
          } else {
            // If data is not returned, add to local state anyway
            const tempId = Date.now().toString();
            setCustomers([{ id: tempId, ...customerData }, ...customers]);
            logAction('create_customer', tempId, customerData.commercial_name || customerData.fiscal_name, null, null, 0, 0, 0, 0, null, false, customerData);
          }
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving customer:", err);
      alert(t('error_saving_customer') || 'Error saving customer details');
    }
  };

  const getCustomerAds = (customer) => {
    const customerAds = [];
    pages.forEach(page => {
      if (page.ads && page.ads.length > 0) {
        page.ads.forEach(ad => {
          if (
            ad.customer_id === customer.id ||
            ad.customer_id === customer.nif ||
            (ad.customer_name && (
              ad.customer_name.toLowerCase() === (customer.commercial_name || '').toLowerCase() ||
              ad.customer_name.toLowerCase() === (customer.fiscal_name || '').toLowerCase()
            ))
          ) {
            customerAds.push({ ...ad, page_number: page.page_number });
          }
        });
      } else if (
        page.customer_id === customer.id ||
        page.customer_id === customer.nif
      ) {
        customerAds.push({
          ad_type: page.ad_type,
          customer_id: page.customer_id,
          isPreReserved: page.status === 'Reserved' && page.payment_status === 'Pending',
          isPaid: page.payment_status === 'Paid',
          paymentMethod: page.payment_status === 'Paid' ? 'Cash' : 'Transfer',
          page_number: page.page_number,
          expires_at: page.expires_at || null
        });
      }
    });
    return customerAds;
  };

  const getCustomerPreReservedAd = (customer) => {
    // First check ad_reservations via pages
    const ads = getCustomerAds(customer);
    const fromAds = ads.find(ad => ad.isPreReserved);
    if (fromAds) return fromAds;

    // Fallback: check orders table (pre-reservations that haven't been confirmed yet
    // live in orders, not in ad_reservations, on the production flow)
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();
    const order = orders.find(o =>
      o.orderType === 'pre-reserved' &&
      o.status !== 'Cancelled' &&
      !o.isPaid &&
      o.customerName?.toLowerCase() === name
    );
    if (order) {
      // Derive expires_at: orders don't store it directly; estimate 7 days from creation
      const expiresAt = order.expires_at ||
        (order.createdAt ? new Date(new Date(order.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null);
      return {
        ad_type: order.productName,
        customer_name: order.customerName,
        page_number: order.assignedPage,
        expires_at: expiresAt,
        isPreReserved: true,
        id: order.id,
        _fromOrder: true,
        emailReminderSentAt: order.emailReminderSentAt,
        whatsappReminderSentAt: order.whatsappReminderSentAt
      };
    }
    return undefined;
  };

  const getCustomerPageNumbersStr = (customer) => {
    const pagesList = [];
    
    // 1. Ads from database/pages
    const ads = getCustomerAds(customer);
    ads.forEach(ad => {
      if (ad.page_number) {
        pagesList.push(ad.page_number);
      }
    });

    // 2. Orders from database/orders
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();
    if (orders && orders.length > 0 && name) {
      orders.forEach(o => {
        if (o.customerName?.toLowerCase() === name && o.assignedPage) {
          pagesList.push(o.assignedPage);
        }
      });
    }

    if (pagesList.length === 0) return '';

    // Get unique page numbers, sorted numerically
    const uniquePages = [...new Set(pagesList)].sort((a, b) => Number(a) - Number(b));
    return uniquePages.map(p => `P${p}`).join(', ');
  };

  // const getCustomerExpirationDate = (customer) => {
  //   const preReservedAd = getCustomerPreReservedAd(customer);
  //   return preReservedAd ? preReservedAd.expires_at : null;
  // };

  const handleReminderClick = (customer, ad = null) => {
    setReminderCustomer(customer);
    setReminderAd(ad);
    setEmailReminderStatus({ sending: false, success: false, error: '' });
    setReminderModalOpen(true);
  };

  const handleSendEmailReminder = async () => {
    if (!reminderCustomer) return;
    const preReservedAd = reminderAd || getCustomerPreReservedAd(reminderCustomer);
    if (!preReservedAd) return;

    setEmailReminderStatus({ sending: true, success: false, error: '' });
    try {
      const res = await sendPaymentReminder(
        preReservedAd.customer_name || reminderCustomer.commercial_name || reminderCustomer.fiscal_name,
        preReservedAd.ad_type,
        preReservedAd.page_number,
        preReservedAd.expires_at,
        reminderCustomer.email,
        reminderCustomer.whatsapp,
        preReservedAd.id,
        preReservedAd._fromOrder === true  // isOrder flag: true when sourced from orders table
      );
      if (res && res.emailSuccess) {
        setEmailReminderStatus({ sending: false, success: true, error: '' });
      } else {
        setEmailReminderStatus({ sending: false, success: false, error: 'Failed to send email reminder' });
      }
    } catch (err) {
      console.error("Error sending email reminder:", err);
      setEmailReminderStatus({ sending: false, success: false, error: err.message || 'Error' });
    }
  };

  const getWhatsAppReminderUrl = (customer, preReservedAd) => {
    if (!customer || !preReservedAd) return '#';
    const isEs = language === 'es';
    const phone = (customer.whatsapp || '').replace(/\D/g, '');
    const expDate = new Date(preReservedAd.expires_at);
    const formattedDate = `${expDate.getDate()}/${expDate.getMonth() + 1}/${expDate.getFullYear()}`;
    const text = isEs
      ? `Hola, le recordamos que su espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026 (Pág. ${preReservedAd.page_number}) está reservado temporalmente y vencerá el ${formattedDate}. Por favor, realice el pago para confirmar su reserva. ¡Muchas gracias!`
      : `Hello, we remind you that your advertising space in Revista de Fiestas Patronales Becerril de la Sierra 2026 (Pg. ${preReservedAd.page_number}) is temporarily reserved and will expire on ${formattedDate}. Please complete the payment to confirm your reservation. Thank you very much!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  // Automatic reminders check on mount
  useEffect(() => {
    const runAutoReminders = async () => {
      const now = new Date();
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      let sentCount = 0;

      for (const page of pages) {
        if (page.ads) {
          for (const ad of page.ads) {
            if (
              ad.isPreReserved &&
              ad.expires_at &&
              !ad.reminderSentAt &&
              ad.customer_id !== 'legacy'
            ) {
              const expDate = new Date(ad.expires_at);
              if (expDate > now && expDate <= threeDaysFromNow) {
                const customer = customers.find(c => c.id === ad.customer_id || c.nif === ad.customer_id || (c.commercial_name && c.commercial_name.toLowerCase() === ad.customer_name?.toLowerCase()));
                if (customer && customer.email) {
                  await sendPaymentReminder(
                    ad.customer_name,
                    ad.ad_type,
                    page.page_number,
                    ad.expires_at,
                    customer.email,
                    customer.whatsapp,
                    ad.id,
                    false
                  );
                  sentCount++;
                }
              }
            }
          }
        }
      }

      if (sentCount > 0) {
        console.log(`Sent ${sentCount} automatic payment reminders.`);
      }
    };

    if (!loading && customers.length > 0 && pages.length > 0) {
      runAutoReminders();
    }
  }, [loading, customers, pages]);

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full"><div className="text-gray-500 font-medium">{t('loading_customers')}</div></div>;
  }

  const getCustomerInvoices = (customer) => {
    return invoices.filter(inv => 
      (inv.customerName && (
        inv.customerName.toLowerCase() === (customer.commercial_name || '').toLowerCase() ||
        inv.customerName.toLowerCase() === (customer.fiscal_name || '').toLowerCase()
      ))
    );
  };

  const isCustomerPending = (customer) => {
    const ads = getCustomerAds(customer);
    const customerInvoices = getCustomerInvoices(customer);
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();

    const hasPendingTransferAd = ads.some(ad => 
      !ad.isPreReserved && 
      !ad.isPaid && 
      (ad.paymentMethod === 'Transfer' || !ad.paymentMethod)
    );
    const hasPendingTransferInvoice = customerInvoices.some(inv => 
      !inv.isPaid && 
      inv.status !== 'Cancelled' &&
      (inv.paymentMethod === 'Transfer' || inv.paymentMethod === 'Pending')
    );
    const hasPendingOrder = orders.some(o =>
      o.orderType === 'transfer' &&
      o.status !== 'Cancelled' &&
      !o.isPaid &&
      o.customerName?.toLowerCase() === name
    );
    return hasPendingTransferAd || hasPendingTransferInvoice || hasPendingOrder;
  };

  const isCustomerPreReserved = (customer) => {
    const ads = getCustomerAds(customer);
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();
    const hasPreReservedAd = ads.some(ad => ad.isPreReserved);
    const hasPreReservedOrder = orders.some(o =>
      o.orderType === 'pre-reserved' &&
      o.status !== 'Cancelled' &&
      o.customerName?.toLowerCase() === name
    );
    return hasPreReservedAd || hasPreReservedOrder;
  };

  const isCustomerClosed = (customer) => {
    const ads = getCustomerAds(customer);
    const customerInvoices = getCustomerInvoices(customer);
    
    const customerRecibos = recibos.filter(r => 
      (r.customerName && (
        r.customerName.toLowerCase() === (customer.commercial_name || '').toLowerCase() ||
        r.customerName.toLowerCase() === (customer.fiscal_name || '').toLowerCase()
      ))
    );

    const hasPaidAd = ads.some(ad => ad.isPaid);
    const hasPaidInvoice = customerInvoices.some(inv => inv.isPaid);
    const hasRecibo = customerRecibos.length > 0;

    return hasPaidAd || hasPaidInvoice || hasRecibo;
  };

  const getClosedSales = () => {
    const salesMap = new Map();

    // 1. Paid ads from pages
    pages.forEach(page => {
      if (page.ads && page.ads.length > 0) {
        page.ads.forEach((ad, idx) => {
          if (ad.isPaid) {
            const key = `${page.page_number}-${(ad.customer_name || '').toLowerCase()}-${(ad.ad_type || '').toLowerCase()}`;
            salesMap.set(key, {
              id: `ad-${page.page_number}-${ad.id || ad.customer_id || idx}`,
              page_number: page.page_number,
              customer_name: ad.customer_name,
              customer_id: ad.customer_id,
              ad_type: ad.ad_type,
              paymentMethod: ad.paymentMethod || 'Transfer',
              date: ad.createdAt || page.created_at || null,
              source: 'ad'
            });
          }
        });
      } else if (page.status === 'Reserved' && page.payment_status === 'Paid') {
        if (!page.customer_id || page.customer_id === 'legacy') {
          return;
        }
        const key = `${page.page_number}-${(page.customer_name || '').toLowerCase()}-${(page.ad_type || '').toLowerCase()}`;
        salesMap.set(key, {
          id: `page-${page.page_number}`,
          page_number: page.page_number,
          customer_name: page.customer_name || 'Legacy Customer',
          customer_id: page.customer_id,
          ad_type: page.ad_type,
          paymentMethod: 'Transfer',
          date: page.created_at || null,
          source: 'page-direct'
        });
      }
    });

    // 2. Paid invoices
    invoices.forEach(inv => {
      if (inv.isPaid && inv.status !== 'Cancelled' && inv.status !== 'Refund' && inv.status !== 'Reserved') {
        const key = `${inv.assignedPage}-${(inv.customerName || '').toLowerCase()}-${(inv.productName || '').toLowerCase()}`;
        if (!salesMap.has(key)) {
          salesMap.set(key, {
            id: `invoice-${inv.id}`,
            page_number: inv.assignedPage,
            customer_name: inv.customerName,
            customer_id: inv.customerId,
            ad_type: inv.productName,
            paymentMethod: inv.paymentMethod || 'Transfer',
            date: inv.createdAt,
            source: 'invoice'
          });
        }
      }
    });

    // 3. Recibos (cash receipts)
    recibos.forEach(rec => {
      if (rec.status !== 'Cancelled') {
        const key = `${rec.assignedPage}-${(rec.customerName || '').toLowerCase()}-${(rec.productName || '').toLowerCase()}`;
        if (!salesMap.has(key)) {
          salesMap.set(key, {
            id: `recibo-${rec.id}`,
            page_number: rec.assignedPage,
            customer_name: rec.customerName,
            customer_id: rec.customerId,
            ad_type: rec.productName,
            paymentMethod: 'Cash',
            date: rec.createdAt,
            source: 'recibo'
          });
        }
      }
    });

    return Array.from(salesMap.values()).sort((a, b) => Number(a.page_number) - Number(b.page_number));
  };

  const getPreReservedSales = () => {
    const preReservedMap = new Map();

    // 1. Pre-reserved ads from pages
    pages.forEach(page => {
      if (page.ads && page.ads.length > 0) {
        page.ads.forEach((ad, idx) => {
          if (ad.isPreReserved) {
            const key = `${page.page_number}-${(ad.customer_name || '').toLowerCase()}-${(ad.ad_type || '').toLowerCase()}`;
            preReservedMap.set(key, {
              id: `ad-${page.page_number}-${ad.id || ad.customer_id || idx}`,
              page_number: page.page_number,
              customer_name: ad.customer_name,
              customer_id: ad.customer_id,
              ad_type: ad.ad_type,
              expires_at: ad.expires_at || null,
              emailReminderSentAt: ad.emailReminderSentAt || ad.reminderSentAt || null,
              whatsappReminderSentAt: ad.whatsappReminderSentAt || null,
              emailRemindersCount: ad.emailRemindersCount || 0,
              whatsappRemindersCount: ad.whatsappRemindersCount || 0,
              _fromOrder: false,
              source: 'ad'
            });
          }
        });
      } else if (page.status === 'Reserved' && page.payment_status === 'Pending') {
        if (!page.customer_id || page.customer_id === 'legacy') {
          return;
        }
        const key = `${page.page_number}-${(page.customer_name || '').toLowerCase()}-${(page.ad_type || '').toLowerCase()}`;
        preReservedMap.set(key, {
          id: `page-${page.page_number}`,
          page_number: page.page_number,
          customer_name: page.customer_name || 'Legacy Customer',
          customer_id: page.customer_id,
          ad_type: page.ad_type,
          expires_at: page.expires_at || null,
          emailReminderSentAt: page.reminderSentAt || null,
          whatsappReminderSentAt: null,
          emailRemindersCount: 0,
          whatsappRemindersCount: 0,
          _fromOrder: false,
          source: 'page-direct'
        });
      }
    });

    // 2. Pre-reserved orders
    orders.forEach(o => {
      if (o.orderType === 'pre-reserved' && o.status !== 'Cancelled' && !o.isPaid) {
        const key = `${o.assignedPage}-${(o.customerName || '').toLowerCase()}-${(o.productName || '').toLowerCase()}`;
        
        // Derive expiresAt: estimate 7 days if not provided
        const expiresAt = o.expires_at ||
          (o.createdAt ? new Date(new Date(o.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null);

        if (!preReservedMap.has(key)) {
          preReservedMap.set(key, {
            id: `order-${o.id}`,
            page_number: o.assignedPage,
            customer_name: o.customerName,
            customer_id: o.customerId,
            ad_type: o.productName,
            expires_at: expiresAt,
            emailReminderSentAt: o.emailReminderSentAt || null,
            whatsappReminderSentAt: o.whatsappReminderSentAt || null,
            emailRemindersCount: o.emailRemindersCount || 0,
            whatsappRemindersCount: o.whatsappRemindersCount || 0,
            _fromOrder: true,
            source: 'order'
          });
        }
      }
    });

    return Array.from(preReservedMap.values()).sort((a, b) => Number(a.page_number) - Number(b.page_number));
  };

  const findCustomerForSale = (sale) => {
    const saleCustName = (sale.customer_name || '').toLowerCase();
    return customers.find(c =>
      (c.id && c.id === sale.customer_id) ||
      (c.nif && c.nif === sale.customer_id) ||
      (c.commercial_name && c.commercial_name.toLowerCase() === saleCustName) ||
      (c.fiscal_name && c.fiscal_name.toLowerCase() === saleCustName)
    ) || {
      commercial_name: sale.customer_name || t('rp_unknown_customer'),
      fiscal_name: '',
      nif: '—',
      email: '',
      whatsapp: '',
      address: '',
      last_year_product: ''
    };
  };

  const closedSales = getClosedSales();
  const preReservedSales = getPreReservedSales();

  const customersByState = {
    pending: [],
    'pre-reserved': preReservedSales,
    closed: closedSales
  };

  customers.forEach(c => {
    if (isCustomerPending(c)) {
      customersByState.pending.push(c);
    }
  });

  const activeCustomers = customersByState[activeState] || [];

  const filteredCustomers = activeCustomers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.commercial_name && c.commercial_name.toLowerCase().includes(term)) ||
      (c.fiscal_name && c.fiscal_name.toLowerCase().includes(term)) ||
      (c.nif && c.nif.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  });

  const filteredClosedSales = closedSales.filter(sale => {
    const customer = findCustomerForSale(sale);
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (customer.commercial_name && customer.commercial_name.toLowerCase().includes(term)) ||
      (customer.fiscal_name && customer.fiscal_name.toLowerCase().includes(term)) ||
      (customer.nif && customer.nif.toLowerCase().includes(term)) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (`p${sale.page_number}`.includes(term)) ||
      (sale.ad_type && sale.ad_type.toLowerCase().includes(term))
    );
  });

  const filteredPreReservedSales = preReservedSales.filter(sale => {
    const customer = findCustomerForSale(sale);
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (customer.commercial_name && customer.commercial_name.toLowerCase().includes(term)) ||
      (customer.fiscal_name && customer.fiscal_name.toLowerCase().includes(term)) ||
      (customer.nif && customer.nif.toLowerCase().includes(term)) ||
      (customer.email && customer.email.toLowerCase().includes(term)) ||
      (`p${sale.page_number}`.includes(term)) ||
      (sale.ad_type && sale.ad_type.toLowerCase().includes(term))
    );
  });

  const displayItems =
    activeState === 'closed'
      ? filteredClosedSales
      : activeState === 'pre-reserved'
        ? filteredPreReservedSales
        : filteredCustomers;

  const getActiveStateTitle = () => {
    switch (activeState) {
      case 'pending':
        return t('cs_pending');
      case 'pre-reserved':
        return t('cs_pre_reserved');
      case 'closed':
        return t('cs_closed');
      default:
        return t('customers_title');
    }
  };

  return (
    <div className="p-0 sm:p-2 md:p-4">
      {/* Customer State Subareas Header */}
      <div className="mb-4 md:mb-8 bg-white p-3 sm:p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 sm:mb-4">
          {t('customer_state')}
        </h3>
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          {/* Pending Subarea */}
          <button
            onClick={() => setActiveState('pending')}
            className={`flex flex-col sm:flex-row items-center sm:justify-between p-2 sm:p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'pending'
                ? 'bg-red-50/60 border-red-200 text-red-700 shadow-sm ring-1 ring-red-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeState === 'pending' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
              }`}>
                <Clock size={14} className="sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="font-bold text-[11px] sm:text-sm leading-tight">{t('cs_pending')}</div>
                <div className="text-[9px] sm:text-xs opacity-75 hidden sm:block">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xs sm:text-xl font-extrabold mt-1 sm:mt-0">{customersByState.pending.length}</div>
          </button>

          {/* Pre-reserved Subarea */}
          <button
            onClick={() => setActiveState('pre-reserved')}
            className={`flex flex-col sm:flex-row items-center sm:justify-between p-2 sm:p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'pre-reserved'
                ? 'bg-orange-50/60 border-orange-200 text-orange-700 shadow-sm ring-1 ring-orange-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeState === 'pre-reserved' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>
                <Bookmark size={14} className="sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="font-bold text-[11px] sm:text-sm leading-tight">{t('cs_pre_reserved')}</div>
                <div className="text-[9px] sm:text-xs opacity-75 hidden sm:block">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xs sm:text-xl font-extrabold mt-1 sm:mt-0">{customersByState['pre-reserved'].length}</div>
          </button>

          {/* Closed Subarea */}
          <button
            onClick={() => setActiveState('closed')}
            className={`flex flex-col sm:flex-row items-center sm:justify-between p-2 sm:p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'closed'
                ? 'bg-green-50/60 border-green-200 text-green-700 shadow-sm ring-1 ring-green-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-3 text-center sm:text-left">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                activeState === 'closed' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
              }`}>
                <CheckCircle size={14} className="sm:w-4 sm:h-4" />
              </div>
              <div>
                <div className="font-bold text-[11px] sm:text-sm leading-tight">{t('cs_closed')}</div>
                <div className="text-[9px] sm:text-xs opacity-75 hidden sm:block">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xs sm:text-xl font-extrabold mt-1 sm:mt-0">{customersByState.closed.length}</div>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 md:mb-8 px-1">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">
            {getActiveStateTitle()} <span className="text-gray-500 font-medium ml-2 text-base md:text-lg">({activeCustomers.length})</span>
          </h2>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5 md:mt-1 hidden sm:block">{t('customers_desc')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={t('cl_search_placeholder') || 'Search customers...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 text-sm"
            />
          </div>
          <button 
            onClick={handleAddCustomer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm whitespace-nowrap text-center"
          >
            {t('add_customer')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop View */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm tracking-wider uppercase">
                <th className="p-4 font-semibold">{t('business')}</th>
                <th className="p-4 font-semibold">{t('contact_details')}</th>
                <th className="p-4 font-semibold">
                  {activeState === 'pre-reserved' ? t('fecha_exp') : t('location')}
                </th>
                <th className="p-4 font-semibold">{t('customer_state')}</th>
                <th className="p-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayItems.map((item) => {
                const isClosed = activeState === 'closed';
                const isPreReserved = activeState === 'pre-reserved';
                const sale = isClosed || isPreReserved ? item : null;
                const customer = isClosed || isPreReserved ? findCustomerForSale(item) : item;
                const itemKey = isClosed || isPreReserved ? sale.id : customer.id;
                return (
                  <tr key={itemKey} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          {customer.commercial_name ? customer.commercial_name.charAt(0) : customer.fiscal_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                            {(() => {
                              if (isClosed || isPreReserved) {
                                return (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                                    P{sale.page_number}
                                  </span>
                                );
                              }
                              const pagesStr = getCustomerPageNumbersStr(customer);
                              return pagesStr ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                                  {pagesStr}
                                </span>
                              ) : null;
                            })()}
                          <span>{customer.commercial_name || customer.fiscal_name}</span>
                        </div>
                        <div className="text-xs text-gray-500">NIF: {customer.nif}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2 text-sm text-gray-600 max-w-xs">
                      {customer.email && (() => {
                        const preReservedAd = activeState === 'pre-reserved' ? item : getCustomerPreReservedAd(customer);
                        const hasEmailSent = preReservedAd?.emailReminderSentAt;
                        const formattedSentDate = hasEmailSent ? new Date(preReservedAd.emailReminderSentAt).toLocaleDateString() : '';
                        const emailCount = preReservedAd?.emailRemindersCount || 0;
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Mail size={14} className="text-gray-400" /> 
                              <span>{customer.email}</span>
                            </div>
                            {hasEmailSent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0 animate-fade-in" title={`Email reminder sent on ${formattedSentDate}`}>
                                <Mail size={10} className="text-emerald-500 fill-emerald-50" />
                                <span>{formattedSentDate}</span>
                                {emailCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{emailCount}</span>}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {customer.whatsapp && (() => {
                        const preReservedAd = activeState === 'pre-reserved' ? item : getCustomerPreReservedAd(customer);
                        const hasWhatsAppSent = preReservedAd?.whatsappReminderSentAt;
                        const formattedSentDate = hasWhatsAppSent ? new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString() : '';
                        const whatsappCount = preReservedAd?.whatsappRemindersCount || 0;
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Phone size={14} className="text-gray-400" /> 
                              <span>{customer.whatsapp}</span>
                            </div>
                            {hasWhatsAppSent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0 animate-fade-in" title={`WhatsApp reminder sent on ${formattedSentDate}`}>
                                <Phone size={10} className="text-emerald-500 fill-emerald-50" />
                                <span>{formattedSentDate}</span>
                                {whatsappCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{whatsappCount}</span>}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {customer.last_year_product && (
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" /> 
                          <span className="text-xs line-clamp-2" title={customer.last_year_product}>{customer.last_year_product}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {activeState === 'pre-reserved' ? (
                      (() => {
                        const preReservedAd = item;
                        if (!preReservedAd) return <span className="text-gray-400">—</span>;
                        const expDate = new Date(preReservedAd.expires_at);
                        const formattedDate = `${expDate.getDate()}/${expDate.getMonth() + 1}/${expDate.getFullYear()}`;
                        return (
                          <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1.5 rounded-lg w-fit font-semibold shadow-sm">
                            <Clock size={14} className="text-orange-500 shrink-0 animate-pulse" />
                            <span>{t('page')} {preReservedAd.page_number} · {formattedDate}</span>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-start gap-2 text-sm text-gray-600 max-w-xs">
                        <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="truncate" title={customer.address}>{customer.address || t('no_address')}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {activeState === 'pending' && isCustomerPending(customer) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                          <Clock size={12} className="text-red-500" />
                          {t('cs_pending')}
                        </span>
                      )}
                      {activeState === 'pre-reserved' && (
                        <>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                            <Clock size={12} className="text-orange-500" />
                            {t('cs_pre_reserved')}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                            <Clock size={12} className="text-red-500" />
                            {t('cs_pending')}
                          </span>
                        </>
                      )}
                      {activeState === 'closed' && isCustomerClosed(customer) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                          <CheckCircle size={12} className="text-green-500" />
                          {t('cs_closed')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {activeState === 'pending' && isCustomerPending(customer) && (
                        <button
                          onClick={() => {
                            setLiberateCustomer(customer);
                            const customerName = customer.commercial_name || customer.fiscal_name || '';
                            const pendingOrder = orders.find(o =>
                              o.orderType === 'transfer' &&
                              !o.isPaid &&
                              o.customerName?.toLowerCase() === customerName.toLowerCase()
                            );
                            setLiberatePaymentMethod(pendingOrder?.paymentMethod || 'Transfer');
                            setLiberateSuccess(false);
                            setLiberateModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                        >
                          {t('cl_liberate_btn')}
                        </button>
                      )}
                      {activeState === 'pre-reserved' && (
                        <>
                          <div className="flex flex-col items-center">
                            <button
                              onClick={() => handleReminderClick(customer, item)}
                              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Bell size={14} />
                              {t('send_reminder') || 'Send Reminder'}
                            </button>
                            {(() => {
                              const preReservedAd = item;
                              const hasEmailSent = preReservedAd?.emailReminderSentAt;
                              const hasWhatsAppSent = preReservedAd?.whatsappReminderSentAt;
                              const emailCount = preReservedAd?.emailRemindersCount || 0;
                              const whatsappCount = preReservedAd?.whatsappRemindersCount || 0;
                              return (
                                <div className="flex flex-col items-center gap-0.5 mt-1">
                                  {hasEmailSent && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-fade-in" title={`Email reminder sent on ${new Date(preReservedAd.emailReminderSentAt).toLocaleDateString()}`}>
                                      <CheckCircle size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                                      <Mail size={12} className="text-emerald-500 shrink-0" />
                                      <span>{new Date(preReservedAd.emailReminderSentAt).toLocaleDateString()}</span>
                                      {emailCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{emailCount}</span>}
                                    </div>
                                  )}
                                  {hasWhatsAppSent && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-fade-in" title={`WhatsApp reminder sent on ${new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString()}`}>
                                      <CheckCircle size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                                      <Phone size={12} className="text-emerald-500 shrink-0" />
                                      <span>{new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString()}</span>
                                      {whatsappCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{whatsappCount}</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          {(() => {
                            const preReservedAd = item;
                            if (preReservedAd) {
                              return (
                                <button
                                  onClick={() => {
                                    if (onSelectPage) {
                                      onSelectPage(preReservedAd.page_number);
                                    }
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                                >
                                  {t('edit_status') || 'Edit Status'}
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}
                      <button 
                        onClick={() => handleEditCustomer(customer)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm cursor-pointer"
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </td>
                </tr>
              ); })}
              {displayItems.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    {t('no_customers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List (hidden on md and larger) */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {displayItems.map((item) => {
            const isClosed = activeState === 'closed';
            const isPreReserved = activeState === 'pre-reserved';
            const sale = isClosed || isPreReserved ? item : null;
            const customer = isClosed || isPreReserved ? findCustomerForSale(item) : item;
            const itemKey = isClosed || isPreReserved ? sale.id : customer.id;
            return (
              <div key={itemKey} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm relative flex flex-col gap-3">
                {/* Header: Avatar, Name & NIF */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                      {customer.commercial_name ? customer.commercial_name.charAt(0) : customer.fiscal_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button 
                          onClick={() => handleEditCustomer(customer)}
                          className="p-1 hover:bg-slate-100 rounded text-blue-600 transition-colors inline-flex items-center justify-center cursor-pointer shrink-0"
                          title={t('edit') || 'Edit Customer'}
                        >
                          <Edit2 size={14} />
                        </button>
                        {(() => {
                          if (isClosed || isPreReserved) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                                P{sale.page_number}
                              </span>
                            );
                          }
                          const pagesStr = getCustomerPageNumbersStr(customer);
                          return pagesStr ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                              {pagesStr}
                            </span>
                          ) : null;
                        })()}
                      <span className="font-bold text-gray-800 leading-tight">{customer.commercial_name || customer.fiscal_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">NIF: {customer.nif}</div>
                  </div>
                </div>
                
                {/* State badges on top right */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {activeState === 'pending' && isCustomerPending(customer) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100">
                      <Clock size={10} className="text-red-500" />
                      {t('cs_pending')}
                    </span>
                  )}
                  {activeState === 'pre-reserved' && (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                        <Clock size={10} className="text-orange-500" />
                        {t('cs_pre_reserved')}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100">
                        <Clock size={10} className="text-red-500" />
                        {t('cs_pending')}
                      </span>
                    </>
                  )}
                  {activeState === 'closed' && isCustomerClosed(customer) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100">
                      <CheckCircle size={10} className="text-green-500" />
                      {t('cs_closed')}
                    </span>
                  )}
                </div>
              </div>

              {/* Content Details */}
              <div className="text-xs text-gray-600 space-y-1.5 bg-gray-50/50 p-2.5 rounded-lg border border-gray-50">
                {customer.email && (() => {
                  const preReservedAd = activeState === 'pre-reserved' ? item : getCustomerPreReservedAd(customer);
                  const hasEmailSent = preReservedAd?.emailReminderSentAt;
                  const formattedSentDate = hasEmailSent ? new Date(preReservedAd.emailReminderSentAt).toLocaleDateString() : '';
                  const emailCount = preReservedAd?.emailRemindersCount || 0;
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                      {hasEmailSent && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 shrink-0 animate-fade-in">
                          <Mail size={8} className="text-emerald-500 fill-emerald-50" />
                          <span>{formattedSentDate}</span>
                          {emailCount > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{emailCount}</span>}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {customer.whatsapp && (() => {
                  const preReservedAd = activeState === 'pre-reserved' ? item : getCustomerPreReservedAd(customer);
                  const hasWhatsAppSent = preReservedAd?.whatsappReminderSentAt;
                  const formattedSentDate = hasWhatsAppSent ? new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString() : '';
                  const whatsappCount = preReservedAd?.whatsappRemindersCount || 0;
                  return (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Phone size={12} className="text-gray-400 shrink-0" />
                        <span>{customer.whatsapp}</span>
                      </div>
                      {hasWhatsAppSent && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100 shrink-0 animate-fade-in">
                          <Phone size={8} className="text-emerald-500 fill-emerald-50" />
                          <span>{formattedSentDate}</span>
                          {whatsappCount > 0 && <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{whatsappCount}</span>}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {activeState === 'pre-reserved' ? (
                  (() => {
                    const preReservedAd = item;
                    if (!preReservedAd) return null;
                    const expDate = new Date(preReservedAd.expires_at);
                    const formattedDate = `${expDate.getDate()}/${expDate.getMonth() + 1}/${expDate.getFullYear()}`;
                    return (
                      <div className="flex items-center gap-2 font-medium text-orange-700 bg-orange-50 border border-orange-100 px-2 py-1 rounded-md w-fit">
                        <Clock size={12} className="text-orange-500 shrink-0" />
                        <span>Pág. {preReservedAd.page_number} · Exp: {formattedDate}</span>
                      </div>
                    );
                  })()
                ) : (
                  customer.address && (
                    <div className="flex items-start gap-2">
                      <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{customer.address}</span>
                    </div>
                  )
                )}
                {customer.last_year_product && (
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-100 mt-1">
                    <FileText size={12} className="text-gray-400 mt-0.5 shrink-0" />
                    <span className="font-medium text-gray-700">{customer.last_year_product}</span>
                  </div>
                )}
              </div>

              {/* Actions always visible at bottom */}
              {activeState === 'pending' && isCustomerPending(customer) && (
                <div className="flex gap-2 justify-end border-t border-gray-100 pt-3 mt-1">
                  <button
                    onClick={() => {
                      setLiberateCustomer(customer);
                      const customerName = customer.commercial_name || customer.fiscal_name || '';
                      const pendingOrder = orders.find(o =>
                        o.orderType === 'transfer' &&
                        !o.isPaid &&
                        o.customerName?.toLowerCase() === customerName.toLowerCase()
                      );
                      setLiberatePaymentMethod(pendingOrder?.paymentMethod || 'Transfer');
                      setLiberateSuccess(false);
                      setLiberateModalOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                  >
                    <CheckCircle size={14} />
                    {t('cl_liberate_btn')}
                  </button>
                </div>
              )}
              {activeState === 'pre-reserved' && (
                <div className="flex gap-2 justify-end border-t border-gray-100 pt-3 mt-1">
                  <div className="flex-1 flex flex-col items-center">
                    <button
                      onClick={() => handleReminderClick(customer, item)}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                    >
                      <Bell size={14} />
                      {t('send_reminder') || 'Send Reminder'}
                    </button>
                    {(() => {
                      const preReservedAd = item;
                      const hasEmailSent = preReservedAd?.emailReminderSentAt;
                      const hasWhatsAppSent = preReservedAd?.whatsappReminderSentAt;
                      const emailCount = preReservedAd?.emailRemindersCount || 0;
                      const whatsappCount = preReservedAd?.whatsappRemindersCount || 0;
                      return (
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                          {hasEmailSent && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-fade-in" title={`Email reminder sent on ${new Date(preReservedAd.emailReminderSentAt).toLocaleDateString()}`}>
                              <CheckCircle size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                              <Mail size={12} className="text-emerald-500 shrink-0" />
                              <span>{new Date(preReservedAd.emailReminderSentAt).toLocaleDateString()}</span>
                              {emailCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{emailCount}</span>}
                            </div>
                          )}
                          {hasWhatsAppSent && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-fade-in" title={`WhatsApp reminder sent on ${new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString()}`}>
                              <CheckCircle size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                              <Phone size={12} className="text-emerald-500 shrink-0" />
                              <span>{new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString()}</span>
                              {whatsappCount > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-0.5">{whatsappCount}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {(() => {
                    const preReservedAd = item;
                    if (preReservedAd) {
                      return (
                        <button
                          onClick={() => {
                            if (onSelectPage) {
                              onSelectPage(preReservedAd.page_number);
                            }
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                        >
                          {t('edit_status') || 'Edit Status'}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          ); })}
          {displayItems.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
              {t('no_customers')}
            </div>
          )}
        </div>
      </div>

      {/* Liberate Modal — Confirm Payment & Generate Invoice */}
      {liberateModalOpen && liberateCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            {liberateSuccess ? (
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t('cl_liberate_success')}</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {liberateCustomer.commercial_name || liberateCustomer.fiscal_name}
                </p>
                <button
                  onClick={() => {
                    setLiberateModalOpen(false);
                    setLiberateSuccess(false);
                    setLiberateCustomer(null);
                  }}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg transition-colors"
                >
                  {t('close')}
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{t('cl_liberate_title')}</h3>
                <p className="text-gray-500 text-sm mb-6">
                  {liberateCustomer.commercial_name || liberateCustomer.fiscal_name}
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-3">{t('cl_liberate_payment_method')}</label>
                  <div className="flex gap-2">
                    {['Transfer', 'Cash', 'Bizum'].map(method => (
                      <button
                        key={method}
                        onClick={() => setLiberatePaymentMethod(method)}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          liberatePaymentMethod === method
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {t(`rp_${method.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setLiberateModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      const customerName = liberateCustomer.commercial_name || liberateCustomer.fiscal_name || '';
                      const pendingOrders = orders.filter(o =>
                        o.orderType === 'transfer' &&
                        !o.isPaid &&
                        o.customerName?.toLowerCase() === customerName.toLowerCase()
                      );
                      if (pendingOrders.length === 0) {
                        alert(t('cl_liberate_no_orders'));
                        return;
                      }
                      for (const order of pendingOrders) {
                        await confirmOrderPayment(order.id, liberatePaymentMethod);
                      }
                      setLiberateSuccess(true);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
                  >
                    {t('cl_liberate_confirm_btn')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {reminderModalOpen && reminderCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setReminderModalOpen(false);
                setReminderCustomer(null);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X size={20} />
            </button>
            
            <h3 className="text-xl font-bold text-gray-900 mb-1">
              {t('send_reminder') || 'Send Reminder'}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {reminderCustomer.commercial_name || reminderCustomer.fiscal_name}
            </p>

            {(() => {
              const preReservedAd = reminderAd || getCustomerPreReservedAd(reminderCustomer);
              if (!preReservedAd) return null;
              
              const expDate = new Date(preReservedAd.expires_at);
              const formattedDate = `${expDate.getDate()}/${expDate.getMonth() + 1}/${expDate.getFullYear()}`;
              
              return (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-6 text-sm">
                  <div className="font-semibold text-slate-800 mb-2">
                    {language === 'es' ? 'Detalles de la Pre-reserva' : 'Pre-reservation Details'}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('page') || 'Page'}</span>
                      <span className="font-bold text-blue-600">Pág. {preReservedAd.page_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{language === 'es' ? 'Producto' : 'Product'}</span>
                      <span className="font-medium text-slate-800">{preReservedAd.ad_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">{t('fecha_exp') || 'Expiration Date'}</span>
                      <span className="font-medium text-slate-800">{formattedDate}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col gap-3">
              {/* Send Email Button */}
              <div className="flex flex-col gap-1 w-full">
                <button
                  onClick={handleSendEmailReminder}
                  disabled={!reminderCustomer.email || emailReminderStatus.sending}
                  className={`w-full py-2.5 px-4 rounded-xl border font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    emailReminderStatus.success
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 disabled:opacity-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200'
                  }`}
                >
                  <Mail size={16} />
                  {emailReminderStatus.success
                    ? (language === 'es' ? '¡Recordatorio por Correo Enviado!' : 'Email Reminder Sent!')
                    : emailReminderStatus.sending
                      ? (language === 'es' ? 'Enviando...' : 'Sending...')
                      : (t('email_reminder') || 'Send Email Reminder')}
                </button>
                {(() => {
                  const preReservedAd = reminderAd || getCustomerPreReservedAd(reminderCustomer);
                  const hasEmailSent = preReservedAd?.emailReminderSentAt;
                  if (hasEmailSent && !emailReminderStatus.success) {
                    const dateStr = new Date(preReservedAd.emailReminderSentAt).toLocaleDateString();
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold px-2 mt-0.5 justify-center animate-fade-in">
                        <Mail size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                        <span>{language === 'es' ? `Último enviado: ${dateStr}` : `Last sent: ${dateStr}`}</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Send WhatsApp Button */}
              {(() => {
                const preReservedAd = reminderAd || getCustomerPreReservedAd(reminderCustomer);
                const url = getWhatsAppReminderUrl(reminderCustomer, preReservedAd);
                const hasWhatsAppSent = preReservedAd?.whatsappReminderSentAt;
                const dateStr = hasWhatsAppSent ? new Date(preReservedAd.whatsappReminderSentAt).toLocaleDateString() : '';
                return (
                  <div className="flex flex-col gap-1 w-full">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={async () => {
                        if (preReservedAd) {
                          await trackWhatsAppReminderSent(
                            preReservedAd.id,
                            preReservedAd.page_number,
                            preReservedAd._fromOrder === true
                          );
                        }
                        setReminderModalOpen(false);
                        setReminderCustomer(null);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm text-center transition-colors flex items-center justify-center gap-2 border cursor-pointer ${
                        !reminderCustomer.whatsapp
                          ? 'bg-gray-100 text-gray-400 border-gray-200 pointer-events-none'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-650'
                      }`}
                    >
                      <Phone size={16} />
                      {t('whatsapp_reminder') || 'Send WhatsApp Reminder'}
                    </a>
                    {hasWhatsAppSent && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold px-2 mt-0.5 justify-center animate-fade-in">
                        <Phone size={12} className="text-emerald-500 fill-emerald-50 shrink-0" />
                        <span>{language === 'es' ? `Último enviado: ${dateStr}` : `Last sent: ${dateStr}`}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {emailReminderStatus.error && (
              <p className="text-xs text-red-600 font-medium mt-3 text-center">
                ❌ Error: {emailReminderStatus.error}
              </p>
            )}
            
            <button
              onClick={() => {
                setReminderModalOpen(false);
                setReminderCustomer(null);
              }}
              className="w-full mt-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm cursor-pointer"
            >
              {t('close') || 'Close'}
            </button>
          </div>
        </div>
      )}

      <CustomerModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        customer={selectedCustomer} 
        onSave={handleSaveCustomer} 
      />
    </div>
  );
};

export default CustomersList;
