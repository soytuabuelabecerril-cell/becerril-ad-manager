import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { products } from '../utils/products';
import { getFullPages } from '../utils/fallbackData';
import { addInvoice, updateInvoicePayment, deleteInvoice, getInvoices } from '../utils/invoicesStore';
import { CheckCircle, FileText, X, Trash2, CreditCard } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ReservationPanel = ({ selectedPage, onReservationComplete, onCancel }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [usedProducts, setUsedProducts] = useState(new Set());
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', nif: '', email: '', whatsapp: '' });

  const [assignmentPref, setAssignmentPref] = useState('aleatorio');
  
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [isPaid, setIsPaid] = useState(false);
  const [currentAdRef, setCurrentAdRef] = useState(null);
  
  const [artworkOption, setArtworkOption] = useState('');
  const [designWorkOption, setDesignWorkOption] = useState('');
  const [designWorkPrice, setDesignWorkPrice] = useState('');

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
      alert("Please select both a customer and a product.");
      return;
    }
    
    if (!artworkOption) {
      alert("Please select an artwork option.");
      return;
    }

    if (artworkOption === '3') {
      if (!designWorkOption) {
        alert("Please select a design work option.");
        return;
      }
      if (designWorkOption === '1' && !designWorkPrice) {
        alert("Please enter a price for the design work.");
        return;
      }
    }

    if (isAddingNew && (!newCustomer.name || !newCustomer.email)) {
      alert("Please provide at least a Name and Email for the new customer.");
      return;
    }

    setIsSaving(true);
    const prod = products.find(p => p.id === parseInt(selectedProductId));
    
    try {
      let finalCustomerId = selectedCustomerId;
      let finalCustomerName = '';

      if (isAddingNew) {
        finalCustomerId = 'new-' + Date.now();
        finalCustomerName = newCustomer.name;
      } else {
        const cust = customers.find(c => c.id === finalCustomerId || c.nif === finalCustomerId);
        finalCustomerName = cust ? (cust.commercial_name || cust.fiscal_name) : 'Unknown Customer';
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
          alert("No available pages found matching your preference and product space requirements.");
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
      if (artworkOption === '1') artworkComment = "we will use same artwork as last year (2025)";
      else if (artworkOption === '2') artworkComment = "please send us visual art to email address: xxxxx@gmail.com";
      else if (artworkOption === '3') {
        if (designWorkOption === '1') artworkComment = "we will elaborate artwork for you (Diseño y arte final).";
        else if (designWorkOption === '2') artworkComment = "we will elaborate artwork for you (Soy generosa y me encanta curar gratis).";
        else if (designWorkOption === '3') artworkComment = "we will elaborate artwork for you (un vale en el establecimiento).";
      }

      const basePrice = parseFloat(prod.price);
      let designPrice = 0;
      if (artworkOption === '3' && designWorkOption === '1') {
        designPrice = parseFloat(designWorkPrice) || 0;
      }
      const totalBasePrice = basePrice + designPrice;
      const vatAmount = totalBasePrice * 0.21;
      const totalAmount = totalBasePrice + vatAmount;

      const newInvoice = {
        customerName: finalCustomerName,
        productName: prod.name,
        price: basePrice,
        designPrice: designPrice,
        vat: vatAmount,
        total: totalAmount,
        assignedPage: targetPageNumber,
        date: new Date().toLocaleDateString(),
        artworkComment: artworkComment
      };

      const createdInvoice = addInvoice(newInvoice);
      setInvoiceDetails(createdInvoice);
      setPaymentMethod('Transfer');
      setIsPaid(false);
      setInvoiceModalOpen(true);

    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
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
    if (!window.confirm("Are you sure you want to delete this reservation? This cannot be undone.")) return;
    
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
      
      fallbackPage.ads.splice(actualAdIndex, 1);
      if (fallbackPage.ads.length === 0) {
        fallbackPage.status = 'Available';
      }
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'prolong') {
      if (!prolongDate) {
        alert('Please select a new expiration date.');
        return;
      }
      fallbackPage.ads[actualAdIndex].expires_at = new Date(prolongDate).toISOString();
      if (onReservationComplete) onReservationComplete();
    } else if (action === 'confirm') {
      // Trigger invoice for this ad
      fallbackPage.ads[actualAdIndex].isPreReserved = false;
      fallbackPage.ads[actualAdIndex].expires_at = null;
      fallbackPage.ads[actualAdIndex].isNew = true;
      
      const prod = products.find(p => p.name === ad.ad_type);
      const basePrice = prod ? parseFloat(prod.price) : 0;
      const designPrice = parseFloat(ad.designWorkPrice) || 0;
      const totalBasePrice = basePrice + designPrice;
      const vatAmount = totalBasePrice * 0.21;
      
      let artworkComment = "";
      if (ad.artworkOption === '1') artworkComment = "we will use same artwork as last year (2025)";
      else if (ad.artworkOption === '2') artworkComment = "please send us visual art to email address: xxxxx@gmail.com";
      else if (ad.artworkOption === '3') {
        if (ad.designWorkOption === '1') artworkComment = "we will elaborate artwork for you (Diseño y arte final).";
        else if (ad.designWorkOption === '2') artworkComment = "we will elaborate artwork for you (Soy generosa y me encanta curar gratis).";
        else if (ad.designWorkOption === '3') artworkComment = "we will elaborate artwork for you (un vale en el establecimiento).";
      }

      const newInvoice = {
        customerName: ad.customer_name,
        productName: ad.ad_type,
        price: basePrice,
        designPrice: designPrice,
        vat: vatAmount,
        total: totalBasePrice + vatAmount,
        assignedPage: selectedPage.page_number,
        date: new Date().toLocaleDateString(),
        artworkComment: artworkComment
      };

      setCurrentAdRef(fallbackPage.ads[actualAdIndex]);
      const createdInvoice = addInvoice(newInvoice);
      setInvoiceDetails(createdInvoice);
      setPaymentMethod('Transfer');
      setIsPaid(false);
      setInvoiceModalOpen(true);
    }
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
              {selectedPage.status}
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
                    {isAdExpired ? 'Expired' : 'Pending'}
                  </span>
                </div>
                
                {resolvingAdIndex === idx ? (
                  <div className="flex gap-2 items-center mt-3">
                    <input type="date" className="border rounded px-2 py-1 text-sm flex-1" value={prolongDate} onChange={e => setProlongDate(e.target.value)} />
                    <button onClick={() => handleResolveAction(ad, idx, 'prolong')} className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700">Save</button>
                    <button onClick={() => setResolvingAdIndex(null)} className="text-gray-500 hover:text-gray-700 text-sm px-2">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleResolveAction(ad, idx, 'cancel')} className="flex-1 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors">
                      Cancel & Liberate
                    </button>
                    <button onClick={() => setResolvingAdIndex(idx)} className="flex-1 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors">
                      Prolong
                    </button>
                    <button onClick={() => handleResolveAction(ad, idx, 'confirm')} className="flex-1 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors">
                      Confirm (Red)
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
              <div className="flex gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    if (e.target.value !== 'new') setIsAddingNew(false);
                  }}
                  className="flex-1 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>{t('rp_select_customer')}</option>
                  {customers.map(c => (
                    <option key={c.id || c.nif} value={c.id || c.nif}>
                      {c.commercial_name || c.fiscal_name}
                    </option>
                  ))}
                  <option value="new" className="font-bold text-blue-600">{t('rp_new_customer')}</option>
                </select>
              </div>

              {isAddingNew && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('rp_customer_name')}</label>
                    <input type="text" className="w-full p-2 border rounded text-sm" value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">NIF / CIF</label>
                    <input type="text" className="w-full p-2 border rounded text-sm" value={newCustomer.nif} onChange={e => setNewCustomer({...newCustomer, nif: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('rp_customer_email')}</label>
                    <input type="email" className="w-full p-2 border rounded text-sm" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('rp_customer_phone')}</label>
                    <input type="tel" className="w-full p-2 border rounded text-sm" value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
        
        {selectedPage.page_number === 'Unassigned' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Preference</label>
            <select 
              value={assignmentPref}
              onChange={(e) => setAssignmentPref(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-indigo-50 text-indigo-900 border-indigo-200"
            >
              <option value="aleatorio">Aleatorio (Random available)</option>
              <option value="par">Página Par (Even page)</option>
              <option value="impar">Página Impar (Odd page)</option>
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
                      placeholder="Price (€)" 
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

        <button 
          onClick={() => handleSave(false)}
          disabled={isSaving}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
        >
          {isSaving ? t('rp_saving') : t('rp_btn_reserve_invoice')}
        </button>
        
        <button 
          onClick={() => handleSave(true)}
          disabled={isSaving}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium rounded-lg transition-colors flex justify-center items-center gap-2 mt-2"
        >
          {isSaving ? t('rp_saving') : t('rp_btn_prereserve')}
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
              const cName = c ? (c.commercial_name || c.fiscal_name) : 'Legacy Customer';
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


      {/* Invoice Success Modal Overlay */}
      {invoiceModalOpen && invoiceDetails && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 rounded-xl flex items-center justify-center p-6 border border-gray-100 shadow-xl">
          <div className="text-center w-full">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">{t('rp_res_confirmed')}</h2>
            <p className="text-sm text-gray-500 mb-6">{t('rp_invoice_triggered')}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 text-left mb-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-sm text-gray-700">{t('rp_invoice_summary')}</span>
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
                  <span className="font-bold text-blue-600">{t('pg')} {invoiceDetails.assignedPage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('rp_date_label')}</span>
                  <span className="font-medium text-gray-900">{invoiceDetails.date}</span>
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
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">{t('rp_vat_label')}</span>
                  <span className="font-medium text-gray-600">{invoiceDetails.vat.toFixed(2)}€</span>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{t('rp_method')}</label>
                  <div className="flex gap-2">
                    {['Cash', 'Bizum', 'Transfer'].map(method => (
                      <button
                        key={method}
                        onClick={() => {
                          setPaymentMethod(method);
                          if (method === 'Cash') setIsPaid(true);
                          else if (method === 'Transfer') setIsPaid(false);
                        }}
                        className={`flex-1 py-1.5 text-sm font-medium rounded border ${paymentMethod === method ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                      >
                        {t(`rp_${method.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{t('rp_status')}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsPaid(true)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded border ${isPaid ? 'bg-green-50 border-green-500 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {t('rp_paid_green')}
                    </button>
                    <button
                      onClick={() => setIsPaid(false)}
                      className={`flex-1 py-1.5 text-sm font-medium rounded border ${!isPaid ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                      {t('rp_pending_red')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleConfirmPaymentAndClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm"
            >
              {t('rp_confirm_close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationPanel;
