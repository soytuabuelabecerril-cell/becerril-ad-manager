import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, FileText, Search, Clock, Bookmark, CheckCircle } from 'lucide-react';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { getFullPages } from '../utils/fallbackData';
import { useLanguage } from '../context/LanguageContext';
import CustomerModal from './CustomerModal';
import { getInvoices, getRecibos, getOrders, confirmOrderPayment } from '../utils/invoicesStore';

const CustomersList = () => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeState, setActiveState] = useState('pending');
  const [liberateModalOpen, setLiberateModalOpen] = useState(false);
  const [liberateCustomer, setLiberateCustomer] = useState(null);
  const [liberatePaymentMethod, setLiberatePaymentMethod] = useState('Transfer');
  const [liberateSuccess, setLiberateSuccess] = useState(false);

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
        
        let loadedCustomers = [];
        if (custData && custData.length > 0) {
          loadedCustomers = custData;
        } else {
          loadedCustomers = fallbackCustomers;
        }

        // Fetch magazine pages
        const { data: pagesData, error: pagesError } = await supabase
          .from('magazine_pages')
          .select('*')
          .order('page_number', { ascending: true });
        
        let loadedPages = [];
        if (pagesError) {
          console.warn("Could not fetch magazine_pages, using fallback data:", pagesError);
          loadedPages = getFullPages();
        } else if (pagesData && pagesData.length > 0) {
          loadedPages = pagesData;
        } else {
          loadedPages = getFullPages();
        }

        setCustomers(loadedCustomers);
        setPages(loadedPages);
      } catch (err) {
        console.error("Error fetching data:", err);
        setCustomers(fallbackCustomers);
        setPages(getFullPages());
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full"><div className="text-gray-500 font-medium">{t('loading_customers')}</div></div>;
  }

  const handleEditCustomer = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (customerData) => {
    try {
      if (selectedCustomer && selectedCustomer.id && !selectedCustomer.id.startsWith('ext-')) {
        // Update existing in Supabase
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', selectedCustomer.id);
          
        if (error) throw error;
        
        // Update local state
        setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, ...customerData } : c));
      } else {
        if (selectedCustomer && selectedCustomer.id && selectedCustomer.id.startsWith('ext-')) {
           // Mock update for fallback data
           setCustomers(customers.map(c => c.id === selectedCustomer.id ? { ...c, ...customerData } : c));
        } else {
          // Create new
          const { data, error } = await supabase
            .from('customers')
            .insert([customerData])
            .select();
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            setCustomers([data[0], ...customers]);
          } else {
            // If data is not returned, add to local state anyway
            setCustomers([{ id: Date.now().toString(), ...customerData }, ...customers]);
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
            customerAds.push(ad);
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
          paymentMethod: page.payment_status === 'Paid' ? 'Cash' : 'Transfer'
        });
      }
    });
    return customerAds;
  };

  const getCustomerInvoices = (customer) => {
    const invoices = getInvoices() || [];
    return invoices.filter(inv => 
      (inv.customerName && (
        inv.customerName.toLowerCase() === (customer.commercial_name || '').toLowerCase() ||
        inv.customerName.toLowerCase() === (customer.fiscal_name || '').toLowerCase()
      ))
    );
  };

  const isCustomerPending = (customer) => {
    const ads = getCustomerAds(customer);
    const invoices = getCustomerInvoices(customer);
    const orders = getOrders();
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();

    const hasPendingTransferAd = ads.some(ad => 
      !ad.isPreReserved && 
      !ad.isPaid && 
      (ad.paymentMethod === 'Transfer' || !ad.paymentMethod)
    );
    const hasPendingTransferInvoice = invoices.some(inv => 
      !inv.isPaid && 
      inv.status !== 'Cancelled' &&
      (inv.paymentMethod === 'Transfer' || inv.paymentMethod === 'Pending')
    );
    const hasPendingOrder = orders.some(o =>
      o.orderType === 'transfer' &&
      !o.isPaid &&
      o.customerName?.toLowerCase() === name
    );
    return hasPendingTransferAd || hasPendingTransferInvoice || hasPendingOrder;
  };

  const isCustomerPreReserved = (customer) => {
    const ads = getCustomerAds(customer);
    const orders = getOrders();
    const name = (customer.commercial_name || customer.fiscal_name || '').toLowerCase();
    const hasPreReservedAd = ads.some(ad => ad.isPreReserved);
    const hasPreReservedOrder = orders.some(o =>
      o.orderType === 'pre-reserved' &&
      o.customerName?.toLowerCase() === name
    );
    return hasPreReservedAd || hasPreReservedOrder;
  };

  const isCustomerClosed = (customer) => {
    const ads = getCustomerAds(customer);
    const invoices = getCustomerInvoices(customer);
    const recibos = getRecibos() || [];
    
    const customerRecibos = recibos.filter(r => 
      (r.customerName && (
        r.customerName.toLowerCase() === (customer.commercial_name || '').toLowerCase() ||
        r.customerName.toLowerCase() === (customer.fiscal_name || '').toLowerCase()
      ))
    );

    const hasPaidAd = ads.some(ad => ad.isPaid);
    const hasPaidInvoice = invoices.some(inv => inv.isPaid);
    const hasRecibo = customerRecibos.length > 0;

    return hasPaidAd || hasPaidInvoice || hasRecibo;
  };

  const customersByState = {
    pending: [],
    'pre-reserved': [],
    closed: []
  };

  customers.forEach(c => {
    if (isCustomerPending(c)) {
      customersByState.pending.push(c);
    }
    if (isCustomerPreReserved(c)) {
      customersByState['pre-reserved'].push(c);
    }
    if (isCustomerClosed(c)) {
      customersByState.closed.push(c);
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

  return (
    <div className="p-8">
      {/* Customer State Subareas Header */}
      <div className="mb-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          {t('customer_state')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Subarea */}
          <button
            onClick={() => setActiveState('pending')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'pending'
                ? 'bg-red-50/60 border-red-200 text-red-700 shadow-sm ring-1 ring-red-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeState === 'pending' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600'
              }`}>
                <Clock size={16} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">{t('cs_pending')}</div>
                <div className="text-xs opacity-75">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xl font-extrabold">{customersByState.pending.length}</div>
          </button>

          {/* Pre-reserved Subarea */}
          <button
            onClick={() => setActiveState('pre-reserved')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'pre-reserved'
                ? 'bg-orange-50/60 border-orange-200 text-orange-700 shadow-sm ring-1 ring-orange-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeState === 'pre-reserved' ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>
                <Bookmark size={16} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">{t('cs_pre_reserved')}</div>
                <div className="text-xs opacity-75">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xl font-extrabold">{customersByState['pre-reserved'].length}</div>
          </button>

          {/* Closed Subarea */}
          <button
            onClick={() => setActiveState('closed')}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
              activeState === 'closed'
                ? 'bg-green-50/60 border-green-200 text-green-700 shadow-sm ring-1 ring-green-300'
                : 'bg-gray-50/30 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeState === 'closed' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
              }`}>
                <CheckCircle size={16} />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm">{t('cs_closed')}</div>
                <div className="text-xs opacity-75">{t('customer_state')}</div>
              </div>
            </div>
            <div className="text-xl font-extrabold">{customersByState.closed.length}</div>
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            {t('customers_title')} <span className="text-gray-500 font-medium ml-2">({activeCustomers.length})</span>
          </h2>
          <p className="text-gray-500 mt-1">{t('customers_desc')}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder={t('cl_search_placeholder') || 'Search customers...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
          <button 
            onClick={handleAddCustomer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            {t('add_customer')}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm tracking-wider uppercase">
                <th className="p-4 font-semibold">{t('business')}</th>
                <th className="p-4 font-semibold">{t('contact_details')}</th>
                <th className="p-4 font-semibold">{t('location')}</th>
                <th className="p-4 font-semibold">{t('customer_state')}</th>
                <th className="p-4 font-semibold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {customer.commercial_name ? customer.commercial_name.charAt(0) : customer.fiscal_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-gray-800">{customer.commercial_name || customer.fiscal_name}</div>
                        <div className="text-xs text-gray-500">NIF: {customer.nif}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2 text-sm text-gray-600 max-w-xs">
                      {customer.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-400" /> {customer.email}
                        </div>
                      )}
                      {customer.whatsapp && (
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" /> {customer.whatsapp}
                        </div>
                      )}
                      {customer.last_year_product && (
                        <div className="flex items-start gap-2">
                          <FileText size={14} className="text-gray-400 mt-0.5 flex-shrink-0" /> 
                          <span className="text-xs line-clamp-2" title={customer.last_year_product}>{customer.last_year_product}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600 max-w-xs">
                      <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="truncate" title={customer.address}>{customer.address || t('no_address')}</span>
                    </div>
                  </td>
                  <td className="p-4 flex flex-wrap gap-1">
                    {isCustomerPending(customer) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-100">
                        <Clock size={12} className="text-red-500" />
                        {t('cs_pending')}
                      </span>
                    )}
                    {isCustomerPreReserved(customer) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-100">
                        <Clock size={12} className="text-orange-500" />
                        {t('cs_pre_reserved')}
                      </span>
                    )}
                    {isCustomerClosed(customer) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-100">
                        <CheckCircle size={12} className="text-green-500" />
                        {t('cs_closed')}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {activeState === 'pending' && isCustomerPending(customer) && (
                        <button
                          onClick={() => {
                            setLiberateCustomer(customer);
                            setLiberatePaymentMethod('Transfer');
                            setLiberateSuccess(false);
                            setLiberateModalOpen(true);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                        >
                          {t('cl_liberate_btn')}
                        </button>
                      )}
                      <button 
                        onClick={() => handleEditCustomer(customer)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {t('edit')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    {t('no_customers')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                    setPages(getFullPages());
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
                    onClick={() => {
                      const customerName = liberateCustomer.commercial_name || liberateCustomer.fiscal_name || '';
                      const pendingOrders = getOrders().filter(o =>
                        o.orderType === 'transfer' &&
                        !o.isPaid &&
                        o.customerName?.toLowerCase() === customerName.toLowerCase()
                      );
                      if (pendingOrders.length === 0) {
                        alert(t('cl_liberate_no_orders'));
                        return;
                      }
                      pendingOrders.forEach(order => {
                        const inv = confirmOrderPayment(order.id, liberatePaymentMethod);
                        if (inv) {
                          // Mark matching page ad(s) as paid
                          getFullPages().forEach(p => {
                            if (p.ads) {
                              p.ads.forEach(ad => {
                                if (
                                  ad.customer_name?.toLowerCase() === customerName.toLowerCase() &&
                                  ad.ad_type === order.productName
                                ) {
                                  ad.isPaid = true;
                                  ad.paymentMethod = liberatePaymentMethod;
                                }
                              });
                            }
                          });
                        }
                      });
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
