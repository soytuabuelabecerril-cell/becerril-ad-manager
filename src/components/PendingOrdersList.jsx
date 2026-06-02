import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { Clock, AlertCircle, ArrowRight, Search } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const PendingOrdersList = ({ onGoToPage }) => {
  const { t } = useLanguage();
  const { pages } = useDatabase();
  const [pendingOrders, setPendingOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Collect all pre-reserved ads across all pages
    const orders = [];
    
    pages.forEach(page => {
      if (page.ads) {
        page.ads.forEach(ad => {
          if (ad.isPreReserved) {
            orders.push({
              ...ad,
              page_number: page.page_number,
              page_obj: page
            });
          }
        });
      }
    });
    
    // Sort so expired ones are at the top
    orders.sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
    setPendingOrders(orders);
  }, [pages]);

  const getStatusLabel = (expiresAt) => {
    const isExpired = new Date() > new Date(expiresAt);
    if (isExpired) {
      return (
        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md flex items-center gap-1 w-max">
          <AlertCircle size={14} /> {t('pol_expired') || 'Expired'}
        </span>
      );
    }
    
    const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return (
      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-md">
        {t('pol_expires_in') || 'Expires in '}{daysLeft}{t('pol_days') || ' day(s)'}
      </span>
    );
  };

  const displayOrders = pendingOrders.filter(order => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchCustomer = order.customer_name?.toLowerCase().includes(q);
      const matchProduct = order.ad_type?.toLowerCase().includes(q);
      const matchPage = order.page_number?.toString().includes(q);
      if (!matchCustomer && !matchProduct && !matchPage) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-orange-500" />
          {t('pol_title') || 'Pending Orders (Pre-Reservations)'}
        </h2>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={t('pol_search_placeholder') || "Search orders..."} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-64"
            />
          </div>
          <span className="text-sm text-gray-500 text-right sm:text-left">{displayOrders.length} {t('pol_pending_count') || 'pending'}</span>
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-4 opacity-20" />
          <p>{t('pol_no_orders') || 'No pending orders right now.'}</p>
          <p className="text-sm">{t('pol_use_button') || "Use the 'Pre-Reserve' button on the grid to create one."}</p>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Search size={48} className="mx-auto mb-4 opacity-20" />
          <p>{t('pol_no_match') || 'No orders found matching'} "{searchQuery}".</p>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="p-3 font-semibold rounded-tl-lg">{t('pol_col_page') || 'Page'}</th>
                  <th className="p-3 font-semibold">{t('il_col_customer') || 'Customer'}</th>
                  <th className="p-3 font-semibold">{t('il_recibos_col_product') || 'Product'}</th>
                  <th className="p-3 font-semibold">{t('pol_col_date') || 'Expiration Date'}</th>
                  <th className="p-3 font-semibold">{t('rp_status') || 'Status'}</th>
                  <th className="p-3 font-semibold text-right rounded-tr-lg">{t('il_recibos_col_actions') || 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((order, idx) => (
                  <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-bold text-gray-900">
                      {order.page_number}
                    </td>
                    <td className="p-3 font-medium text-gray-900">
                      {order.customer_name}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {order.ad_type}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {new Date(order.expires_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      {getStatusLabel(order.expires_at)}
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => onGoToPage(order.page_obj)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors font-medium cursor-pointer"
                      >
                        {t('pol_view_page') || 'View Page'} <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {displayOrders.map((order, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3 relative border-l-4 border-l-orange-400">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                    {t('pol_col_page') || 'Page'} {order.page_number}
                  </span>
                  {getStatusLabel(order.expires_at)}
                </div>
                
                <div className="text-sm">
                  <div className="font-bold text-gray-800">{order.customer_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{order.ad_type}</div>
                </div>

                <div className="flex justify-between items-center border-t border-gray-50 pt-3 mt-1">
                  <span className="text-xs text-gray-500">
                    {t('pol_col_date') || 'Expires'}: {new Date(order.expires_at).toLocaleDateString()}
                  </span>
                  
                  <button 
                    onClick={() => onGoToPage(order.page_obj)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    {t('pol_view_page') || 'View Page'} <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PendingOrdersList;
