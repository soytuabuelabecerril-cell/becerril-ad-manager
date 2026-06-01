import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { products } from '../utils/products';
import { getFullPages } from '../utils/fallbackData';
import { addInvoice, updateInvoicePayment, deleteInvoice, getInvoices, addRecibo, getReciboWhatsAppMessage, addOrder, getOrders, deleteOrder, getRecibos } from '../utils/invoicesStore';
import { CheckCircle, FileText, X, Trash2, CreditCard } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Helper: insert a customer, falling back to core fields if schema cache is stale
const safeInsertCustomer = async (payload) => {
  const { data, error } = await supabase.from('customers').insert([payload]).select();
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
  const [customers, setCustomers] = useState([]);
  const [usedProducts, setUsedProducts] = useState(new Set());
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ 
    fiscal_name: '', 
    commercial_name: '', 
    nif: '', 
    contact_name: '',
    email: '', 
    whatsapp: '',
    address: '',
    category: '',
    last_year_product: ''
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  const [assignmentPref, setAssignmentPref] = useState('aleatorio');
  
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [reservationPaymentMethod, setReservationPaymentMethod] = useState('Transfer');
  const [isPaid, setIsPaid] = useState(false);
  const [currentAdRef, setCurrentAdRef] = useState(null);
  
  const [artworkOption, setArtworkOption] = useState('');
  const [designWorkOption, setDesignWorkOption] = useState('');
  const [designWorkPrice, setDesignWorkPrice] = useState('');

  // Recibo state
  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [reciboDetails, setReciboDetails] = useState(null);

  // Order (pending — not yet invoiced) state
  const [orderConfirmModalOpen, setOrderConfirmModalOpen] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);

  // Customer dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

    const checkUsedProducts = async () => {
      try {
        const allPages = getFullPages();
        const used = new Set();
        allPages.forEach(p => {
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
      } catch (err) {
        console.error(err);
      }
    };

    fetchCustomers();
    checkUsedProducts();
  }, [selectedPage]);

  useEffect(() => {
    if (selectedPage) {
      setSelectedProductId('');
      setSelectedCustomerId('');
      setIsAddingNew(false);
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

  const handleSave = async (isPreReservation = false) => {
    if (!selectedProductId || (!selectedCustomerId && !isAddingNew)) {
      alert(t('rp_alert_select_cust_prod'));
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
          setCustomers(prev => [...prev, data[0]]);
        } else {
          alert(t('rp_alert_cust_create_error'));
          setIsSaving(false);
          return;
        }
      } else {
        const cust = customers.find(c => c.id === finalCustomerId || c.nif === finalCustomerId);
        finalCustomerName = cust ? (cust.commercial_name || cust.fiscal_name) : (t('rp_unknown_customer') || 'Unknown Customer');
      }

      // Auto-assign page if Unassigned
      let targetPageNumber = selectedPage.page_number;
      
      if (targetPageNumber === 'Unassigned') {
        const fallbackPages = getFullPages();
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

      const newAd = {
        ad_type: prod.name,
        customer_id: finalCustomerId,
        customer_name: finalCustomerName,
        isPreReserved: isPreReservation,
        expires_at: isPreReservation ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        artworkOption: artworkOption,
        designWorkOption: artworkOption === '3' ? designWorkOption : null,
        designWorkPrice: artworkOption === '3' && designWorkOption === '1' ? parseFloat(designWorkPrice) : 0,
        isNew: true
      };

      const fallbackPage = getFullPages().find(p => p.page_number === targetPageNumber);
      if (fallbackPage) {
        if (!fallbackPage.ads) fallbackPage.ads = [];
        fallbackPage.ads.push(newAd);
        fallbackPage.status = 'Reserved';
        setCurrentAdRef(newAd);
      }
      

      // (The DB schema change will be handled by the SQL script later)
      
      // Trigger Invoice
      
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
      const newOrder = addOrder({
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice: designPrice,
        assignedPage: targetPageNumber,
        date: new Date().toLocaleDateString(),
        artworkComment: artworkComment,
        orderType: isPreReservation ? 'pre-reserved' : 'transfer',
        paymentMethod: reservationPaymentMethod,
      });
      setOrderDetails(newOrder);
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
        const fallbackPages = getFullPages();
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

      // Mark the ad on the page
      const newAd = {
        ad_type: prod.name,
        customer_id: finalCustomerId,
        customer_name: finalCustomerName,
        isPreReserved: false,
        expires_at: null,
        artworkOption: artworkOption,
        designWorkOption: artworkOption === '3' ? designWorkOption : null,
        designWorkPrice: artworkOption === '3' && designWorkOption === '1' ? parseFloat(designWorkPrice) : 0,
        isNew: true,
        isRecibo: true,
        isPaid: true,
      };
      const fallbackPage = getFullPages().find(p => p.page_number === targetPageNumber);
      if (fallbackPage) {
        if (!fallbackPage.ads) fallbackPage.ads = [];
        fallbackPage.ads.push(newAd);
        fallbackPage.status = 'Reserved';
        setCurrentAdRef(newAd);
      }

      const basePrice = parseFloat(prod.price);
      let designPrice = 0;
      if (artworkOption === '3' && designWorkOption === '1') {
        designPrice = parseFloat(designWorkPrice) || 0;
      }

      const newRecibo = addRecibo({
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice: designPrice,
        assignedPage: targetPageNumber,
        date: new Date().toLocaleDateString(),
      });

      setReciboDetails(newRecibo);
      setReciboModalOpen(true);
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
    if (currentAdRef) {
      currentAdRef.isPaid = isPaid;
      currentAdRef.paymentMethod = paymentMethod;
    }
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

  const handleDeleteAd = (idx) => {
    if (!window.confirm(t('rp_confirm_delete'))) return;
    
    const fallbackPage = getFullPages().find(p => p.page_number === selectedPage.page_number);
    if (!fallbackPage) return;
    
    const adToDelete = fallbackPage.ads[idx];
    const customerName = adToDelete.customer_name;
    
    const invoices = getInvoices();
    const invoiceToDelete = invoices.find(inv => 
      inv.assignedPage === selectedPage.page_number && 
      inv.customerName === customerName &&
      inv.productName === adToDelete.ad_type
    );
    if (invoiceToDelete) {
      deleteInvoice(invoiceToDelete.id);
    }
    // Also delete any pending order for this ad
    const orderList = getOrders();
    const orderToDelete = orderList.find(o => 
      o.assignedPage === selectedPage.page_number && 
      o.customerName === customerName &&
      o.productName === adToDelete.ad_type
    );
    if (orderToDelete) {
      deleteOrder(orderToDelete.id);
    }
    
    fallbackPage.ads.splice(idx, 1);
    
    if (fallbackPage.ads.length === 0) {
      fallbackPage.status = 'Available';
    }
    
    if (onReservationComplete) {
      onReservationComplete();
    }
  };

  // Find all pre-reserved ads
  const preReservedAds = selectedPage?.ads?.filter(ad => ad.isPreReserved) || [];
  const hasExpired = preReservedAds.some(ad => ad.expires_at && new Date() > new Date(ad.expires_at));
  const [resolvingAdIndex, setResolvingAdIndex] = useState(null);
  const [prolongDate, setProlongDate] = useState('');

  const handleResolveAction = (ad, index, action) => {
    const fallbackPage = getFullPages().find(p => p.page_number === selectedPage.page_number);
    if (!fallbackPage) return;

    const actualAdIndex = fallbackPage.ads.findIndex(a => a === ad);
    if (actualAdIndex === -1) return;

    if (action === 'cancel') {
      const adToDelete = fallbackPage.ads[actualAdIndex];
      const customerName = adToDelete.customer_name;
      
      const invoices = getInvoices();
      const invoiceToDelete = invoices.find(inv => 
        inv.assignedPage === selectedPage.page_number && 
        inv.customerName === customerName &&
        inv.productName === adToDelete.ad_type
      );
      if (invoiceToDelete) {
        deleteInvoice(invoiceToDelete.id);
      }
      // Also delete any pending order for this ad
      const orderList = getOrders();
      const orderToDelete = orderList.find(o => 
        o.assignedPage === selectedPage.page_number && 
        o.customerName === customerName &&
        o.productName === adToDelete.ad_type
      );
      if (orderToDelete) {
        deleteOrder(orderToDelete.id);
      }
      
      fallbackPage.ads.splice(actualAdIndex, 1);
      if (fallbackPage.ads.length === 0) {
        fallbackPage.status = 'Available';
      }
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'prolong') {
      if (!prolongDate) {
        alert(t('rp_alert_select_exp_date'));
        return;
      }
      fallbackPage.ads[actualAdIndex].expires_at = new Date(prolongDate).toISOString();
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'confirm') {
      // Convert pre-reservation to a pending transfer order.
      // Invoice (with VAT) is only generated when payment is confirmed via "Liberar".
      fallbackPage.ads[actualAdIndex].isPreReserved = false;
      fallbackPage.ads[actualAdIndex].expires_at = null;
      fallbackPage.ads[actualAdIndex].isNew = true;
      
      const prod = products.find(p => p.name === ad.ad_type);
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

      setCurrentAdRef(fallbackPage.ads[actualAdIndex]);
      const newOrder = addOrder({
        customerName: ad.customer_name,
        productName: ad.ad_type,
        price: basePrice,
        designPrice: designPrice,
        assignedPage: selectedPage.page_number,
        date: new Date().toLocaleDateString(),
        artworkComment: artworkComment,
        orderType: 'transfer',
      });
      setOrderDetails(newOrder);
      setOrderConfirmModalOpen(true);
    }
  };

  // ─── Customer Status Helper ────────────────────────────────────────────────
  // Returns 'ok' (paid), 'pt' (pending transfer), 'pr' (pre-reserved), or null.
  const getCustomerStatus = (customer) => {
    const pages = getFullPages();
    const invoiceList = getInvoices();
    const reciboList = getRecibos();
    const orderList = getOrders();
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

    // Filter out pages 91 and 92 specific products if we are not on those pages
    if (selectedPage.page_number !== 91 && selectedPage.page_number !== 92) {
      if (p.id === 10 || p.id === 11) return false;
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

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative">
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
              {selectedPage.status === 'Reserved' ? t('status_reserved') : selectedPage.status}
            </span>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
      </div>
      
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
                    <button onClick={() => handleResolveAction(ad, idx, 'confirm')} className="flex-1 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
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
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
                      {customers.map(c => {
                        const status = getCustomerStatus(c);
                        const val = c.id || c.nif;
                        return (
                          <div
                            key={val}
                            onClick={() => {
                              setSelectedCustomerId(val);
                              setIsAddingNew(false);
                              setDropdownOpen(false);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-blue-50 transition-colors ${selectedCustomerId === val ? 'bg-blue-50 font-medium' : ''}`}
                          >
                            {status === 'ok' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-green-500 text-white shrink-0">OK</span>}
                            {status === 'recibo' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-emerald-600 text-white shrink-0">Recibo</span>}
                            {status === 'pt' && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-blue-600 text-white shrink-0">TP</span>}
                            {status?.startsWith('pr:') && <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-orange-500 text-white shrink-0">RESERVA TEMPORAL ({status.split(':')[1]})</span>}
                            <span className="truncate text-gray-800">{c.commercial_name || c.fiscal_name}</span>
                          </div>
                        );
                      })}
                      <div
                        onClick={() => {
                          setSelectedCustomerId('new');
                          setIsAddingNew(true);
                          setDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-bold text-blue-600 border-t border-gray-100 hover:bg-blue-50 transition-colors"
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
        <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            {t('cl_liberate_payment_method') || 'Payment Method'}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Transfer', key: 'rp_transfer', default: 'Transfer' },
              { id: 'Bizum', key: 'rp_bizum', default: 'Bizum' },
              { id: 'Cash', key: 'rp_cash', default: 'Cash (Pending)' }
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
                {method.id === 'Cash' && (
                  <span className="block text-[9px] opacity-75 font-normal">
                    {language === 'en' ? 'pending pick-up' : 'pdte. cobro'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

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
              const cName = c ? (c.commercial_name || c.fiscal_name) : (t('rp_legacy_customer') || 'Legacy Customer');
              return (
                <div key={idx} className="bg-red-50 text-red-800 text-xs px-3 py-2 rounded border border-red-100 flex justify-between items-center group">
                  <div className="flex flex-col">
                    <span className="font-medium mr-2">{cName}</span>
                    <span className="opacity-80">{ad.ad_type}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteAd(idx)}
                    className="text-red-400 hover:text-red-700 p-1.5 rounded-md hover:bg-red-100 transition-colors opacity-0 group-hover:opacity-100"
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


      {/* Order Confirmation Modal Overlay */}
      {orderConfirmModalOpen && orderDetails && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center p-6 border border-gray-100 shadow-xl overflow-y-auto">
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
          <div className="text-center w-full">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mb-4">
              <FileText className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('rp_order_confirmed')}</h2>

            <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 border border-gray-100">
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

            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200 text-left">
              <p className="text-xs text-orange-800 font-medium">&#9203; {t('rp_order_pending_msg')}</p>
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
      )}
      {/* Recibo Success Modal Overlay */}
      {reciboModalOpen && reciboDetails && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center p-6 border border-gray-100 shadow-xl overflow-y-auto">
          <button 
            onClick={handleConfirmReciboAndClose} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 z-20"
            title={t('rp_recibo_confirm_close') || 'Close'}
          >
            <X size={24} />
          </button>
          <div className="text-center w-full">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('rp_recibo_title')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('rp_recibo_subtitle')}</p>

            <div className="bg-gray-50 rounded-lg p-4 text-left mb-4 border border-gray-100">
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
                  💬 {getReciboWhatsAppMessage(reciboDetails)}
                </div>
              </div>
            </div>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(getReciboWhatsAppMessage(reciboDetails))}`}
              target="_blank"
              rel="noreferrer"
              className="w-full mb-3 py-2.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              📲 WhatsApp
            </a>

            <button 
              onClick={handleConfirmReciboAndClose}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm"
            >
              {t('rp_recibo_confirm_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationPanel;
