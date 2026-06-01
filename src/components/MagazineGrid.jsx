import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFullPages } from '../utils/fallbackData';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { products } from '../utils/products';
import { Plus } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MagazineGrid = ({ onPageClick }) => {
  const { t } = useLanguage();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const { data, error } = await supabase
          .from('magazine_pages')
          .select('*')
          .order('page_number', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setPages(data);
        } else {
          setPages(getFullPages());
        }
      } catch (err) {
        console.error("Error fetching pages:", err);
        setPages(getFullPages());
      } finally {
        setLoading(false);
      }
    };

    fetchPages();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'magazine_pages' },
        (payload) => {
          console.log('Real-time change received!', payload);
          // Simple optimistic refresh: re-fetch all
          fetchPages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusColor = (page) => {
    let classes = '';

    // Handle borders and text color
    if (page.page_number === 91 || page.page_number === 92) {
      classes += ' border-orange-500 text-white';
    } else if (page.ads && page.ads.length > 0) {
      classes += ' border-red-700 text-white';
    } else {
      switch (page.status) {
        case 'Locked': classes += ' border-red-300 text-red-800 cursor-not-allowed'; break;
        case 'Reserved': classes += ' border-red-700 text-white'; break;
        default: classes += ' hover:bg-gray-200 border-gray-300 text-gray-800'; break;
      }
    }
    
    // Fallback backgrounds if gradient is not applied
    if (!page.ads || page.ads.length === 0) {
      if (page.page_number === 91 || page.page_number === 92) classes += ' bg-orange-400 hover:bg-orange-500';
      else if (page.status === 'Locked') classes += ' bg-red-100';
      else if (page.status === 'Reserved') classes += ' bg-red-500 hover:bg-red-600';
      else classes += ' bg-gray-100';
    }
    
    return classes;
  };

  const getBackgroundStyle = (page) => {
    if (!page.ads || page.ads.length === 0) return {};
    
    const red = page.page_number === 91 || page.page_number === 92 ? '#f97316' : '#ef4444';
    const white = '#f3f4f6'; 
    
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
        // legacy/unknown products fill all
        filledSlots.add('top'); filledSlots.add('middle'); filledSlots.add('bottom');
        slotToAdMap['top'] = ad; slotToAdMap['middle'] = ad; slotToAdMap['bottom'] = ad;
      }
    });
    
    // Resolve any_1 to an available slot
    if (hasAny1) {
      const ad = slotToAdMap['any_1'];
      if (!filledSlots.has('top')) { filledSlots.add('top'); slotToAdMap['top'] = ad; }
      else if (!filledSlots.has('middle')) { filledSlots.add('middle'); slotToAdMap['middle'] = ad; }
      else if (!filledSlots.has('bottom')) { filledSlots.add('bottom'); slotToAdMap['bottom'] = ad; }
    }

    const getAdColor = (ad) => {
      if (!ad) return white;
      if (ad.isPaid) return '#22c55e'; // Green for paid
      if (ad.isPreReserved) return '#f97316'; // Orange for pre-reserved
      if (ad.isNew) return '#3b82f6'; // Blue for newly reserved page
      return red; // Red for normal reservation
    };

    const t = filledSlots.has('top') ? getAdColor(slotToAdMap['top']) : white;
    const m = filledSlots.has('middle') ? getAdColor(slotToAdMap['middle']) : white;
    const b = filledSlots.has('bottom') ? getAdColor(slotToAdMap['bottom']) : white;
    
    // Check if entire background is identical
    if (t === m && m === b && t !== white) return { background: t };
    
    return {
      background: `linear-gradient(to bottom, 
        ${t} 0%, ${t} 33.33%, 
        ${m} 33.33%, ${m} 66.66%, 
        ${b} 66.66%, ${b} 100%)`
    };
  };

  if (loading) {
    return <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 h-64 flex items-center justify-center">{t('loading_pages')}</div>;
  }

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-gray-800">{t('magazine_layout')}</h2>
        <button 
          onClick={() => onPageClick({ page_number: 'Unassigned', status: 'Available', ads: [] })}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          {t('new_unassigned')}
        </button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {pages.map((page) => {
          
          // Pre-compute the tooltip content (customer names and products)
          let tooltipContent = null;
          if (page.ads && page.ads.length > 0) {
            tooltipContent = (
              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none z-50 flex flex-col gap-1">
                <div className="font-bold border-b border-gray-700 pb-1">{t('page')} {page.page_number}</div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('status')}</span>
                  <span className="font-medium text-blue-300">{page.status}</span>
                </div>
                <div className="mt-1">
                  <span className="text-gray-400">{t('occupants')}</span>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {page.ads.map((ad, idx) => {
                      const c = fallbackCustomers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
                      const cName = c ? (c.commercial_name || c.fiscal_name) : ad.customer_name;
                      return (
                        <li key={idx} className="truncate">
                          {cName} ({ad.ad_type}) 
                          {ad.isPreReserved ? ` ${t('pre_reserved')}` : ''}
                          {ad.isPaid ? ` ${t('paid')}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          }

          // Check for expired pre-reservations
          const hasExpired = page.ads && page.ads.some(ad => ad.isPreReserved && ad.expires_at && new Date() > new Date(ad.expires_at));

          return (
          <button
            key={page.page_number}
            disabled={page.status === 'Locked' || page.page_number === 91 || page.page_number === 92}
            onClick={() => onPageClick(page)}
            className={`
              group relative aspect-[3/4] rounded-md border-2 flex flex-col items-center justify-center
              transition-all duration-200 ease-in-out font-medium p-1 text-center
              ${getStatusColor(page)}
            `}
            style={getBackgroundStyle(page)}
          >
            <span className="text-sm opacity-70 z-10 mix-blend-multiply pointer-events-none">Pg.</span>
            <span className="text-lg font-bold z-10 mix-blend-multiply pointer-events-none">{page.page_number}</span>
            {hasExpired && (
              <div className="absolute -top-2 -right-2 bg-yellow-100 rounded-full shadow-lg border border-yellow-300 z-50">
                <span className="text-xl leading-none block p-0.5">⚠️</span>
              </div>
            )}
            {page.ads && page.ads.length > 0 && (
              <div className="flex flex-col items-center w-full px-1 z-10 text-[9px] mt-1 text-center pointer-events-none">
                {page.ads.map((ad, idx) => {
                  let cName = ad.customer_name;
                  if (!cName && ad.customer_id !== 'legacy') {
                    const c = fallbackCustomers.find(cust => cust.id === ad.customer_id || cust.nif === ad.customer_id);
                    cName = c ? (c.commercial_name || c.fiscal_name) : 'Unknown';
                  } else if (!cName) {
                    cName = 'Reserved'; 
                  }

                  return (
                    <div key={idx} className="w-full flex flex-col items-center border-t border-black/10 pt-0.5 mt-0.5 first:border-0 first:pt-0 first:mt-0 overflow-hidden mix-blend-multiply">
                      <span className="font-bold truncate w-full leading-tight">{cName}</span>
                      <span className="truncate w-full leading-tight opacity-80">{ad.ad_type}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {tooltipContent}
          </button>
        )})}
      </div>
    </div>
  );
};

export default MagazineGrid;
