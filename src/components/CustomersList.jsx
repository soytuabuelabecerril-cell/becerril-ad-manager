import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, Building, Briefcase, FileText } from 'lucide-react';
import { fallbackCustomers } from '../utils/fallbackCustomers';

const CustomersList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setCustomers(data);
        } else {
          // Use extracted data if database is empty or restricted
          setCustomers(fallbackCustomers);
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
        setCustomers(fallbackCustomers);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full"><div className="text-gray-500 font-medium">Loading customers...</div></div>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
          <p className="text-gray-500 mt-1">Manage your advertiser directory and contacts.</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors">
          + Add Customer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm tracking-wider uppercase">
                <th className="p-4 font-semibold">Business</th>
                <th className="p-4 font-semibold">Contact / Details</th>
                <th className="p-4 font-semibold">Location</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
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
                      <span className="truncate" title={customer.address}>{customer.address || 'No address provided'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    No customers found. Click "Add Customer" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomersList;
