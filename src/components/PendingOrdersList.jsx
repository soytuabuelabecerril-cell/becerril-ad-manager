import React, { useState, useEffect } from 'react';
import { getFullPages } from '../utils/fallbackData';
import { Clock, AlertCircle, ArrowRight, Search } from 'lucide-react';

const PendingOrdersList = ({ onGoToPage }) => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Collect all pre-reserved ads across all pages
    const pages = getFullPages();
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
  }, []);

  const getStatusLabel = (expiresAt) => {
    const isExpired = new Date() > new Date(expiresAt);
    if (isExpired) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md flex items-center gap-1 w-max"><AlertCircle size={14} /> Expired</span>;
    }
    
    const daysLeft = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-md">Expires in {daysLeft} day(s)</span>;
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Clock className="text-orange-500" />
          Pending Orders (Pre-Reservations)
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 w-64"
            />
          </div>
          <span className="text-sm text-gray-500">{displayOrders.length} pending</span>
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-4 opacity-20" />
          <p>No pending orders right now.</p>
          <p className="text-sm">Use the 'Pre-Reserve' button on the grid to create one.</p>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Search size={48} className="mx-auto mb-4 opacity-20" />
          <p>No orders found matching "{searchQuery}".</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="p-3 font-semibold rounded-tl-lg">Page</th>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Expiration Date</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold text-right rounded-tr-lg">Action</th>
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
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors font-medium"
                    >
                      View Page <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PendingOrdersList;
