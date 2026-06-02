import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Phone, MapPin, Search, Edit2, Plus, Users, ShieldAlert } from 'lucide-react';
import { fallbackCustomers } from '../utils/fallbackCustomers';
import { useLanguage } from '../context/LanguageContext';
import CustomerModal from './CustomerModal';

const ClientsList = () => {
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('commercial_name', { ascending: true });
      
      if (error) throw error;
      setCustomers(data && data.length > 0 ? data : fallbackCustomers);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setCustomers(fallbackCustomers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
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
      last_year_product: customerData.last_year_product || ''
    };

    try {
      if (selectedCustomer && selectedCustomer.id && !selectedCustomer.id.startsWith('ext-')) {
        // Update Supabase
        const { error } = await supabase
          .from('customers')
          .update(cleanData)
          .eq('id', selectedCustomer.id);
          
        if (error) throw error;
      } else if (selectedCustomer && selectedCustomer.id && selectedCustomer.id.startsWith('ext-')) {
        // Mock update for fallback data
        console.log("Mock updated local fallback customer:", customerData);
      } else {
        // Create new
        const { error } = await supabase
          .from('customers')
          .insert([cleanData]);
          
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      console.error("Error saving customer:", err);
      alert(language === 'es' ? 'Error al guardar los datos del cliente' : 'Error saving customer details');
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.commercial_name || '').toLowerCase().includes(term) ||
      (c.fiscal_name || '').toLowerCase().includes(term) ||
      (c.nif || '').toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      (c.contact_name || '').toLowerCase().includes(term) ||
      (c.category || '').toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="text-gray-500 font-medium">
          {language === 'es' ? 'Cargando clientes...' : 'Loading customers...'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            {language === 'es' ? 'Clientes' : 'Customers'}
            <span className="text-gray-400 font-normal text-sm ml-1">({filteredCustomers.length})</span>
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {language === 'es' ? 'Listado completo de clientes registrados en la base de datos.' : 'Complete list of all registered customers in the database.'}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={language === 'es' ? 'Buscar cliente...' : 'Search customers...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <button
            onClick={handleAddCustomer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            {language === 'es' ? 'Añadir Cliente' : 'Add Customer'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-xs tracking-wider uppercase font-semibold border-b border-gray-100">
              <th className="p-4 rounded-tl-lg">{language === 'es' ? 'Nombre Comercial / Fiscal' : 'Commercial / Fiscal Name'}</th>
              <th className="p-4">NIF/CIF</th>
              <th className="p-4">{language === 'es' ? 'Contacto' : 'Contact'}</th>
              <th className="p-4">{language === 'es' ? 'Categoría' : 'Category'}</th>
              <th className="p-4">{language === 'es' ? 'Dirección' : 'Address'}</th>
              <th className="p-4 text-right rounded-tr-lg">{language === 'es' ? 'Acciones' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-gray-800">{customer.commercial_name || customer.fiscal_name}</div>
                  {customer.commercial_name && customer.fiscal_name && (
                    <div className="text-xs text-gray-400 mt-0.5">{customer.fiscal_name}</div>
                  )}
                </td>
                <td className="p-4 text-gray-600 font-mono text-xs">{customer.nif || '—'}</td>
                <td className="p-4">
                  <div className="space-y-1 text-xs text-gray-600">
                    {customer.contact_name && (
                      <div className="font-medium text-gray-800 text-sm mb-0.5">{customer.contact_name}</div>
                    )}
                    {customer.email && (
                      <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                        <Mail size={12} className="text-gray-400" /> {customer.email}
                      </a>
                    )}
                    {customer.whatsapp && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-gray-400" /> {customer.whatsapp}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-100">
                    {customer.category || 'General'}
                  </span>
                </td>
                <td className="p-4 text-gray-500 max-w-xs truncate" title={customer.address}>
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400 shrink-0" />
                    <span>{customer.address || '—'}</span>
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-bold"
                    title={language === 'es' ? 'Editar Cliente' : 'Edit Customer'}
                  >
                    <Edit2 size={14} />
                    {language === 'es' ? 'Editar' : 'Edit'}
                  </button>
                </td>
              </tr>
            ))}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="6" className="p-8 text-center text-gray-400">
                  <ShieldAlert className="mx-auto mb-2 opacity-30" size={32} />
                  {language === 'es' ? 'No se encontraron clientes.' : 'No customers found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customer={selectedCustomer}
        onSave={handleSaveCustomer}
      />
    </div>
  );
};

export default ClientsList;
