import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const CustomerModal = ({ isOpen, onClose, customer, onSave, onDelete }) => {
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('cm_formData');
    return saved ? JSON.parse(saved) : {
      fiscal_name: '',
      commercial_name: '',
      nif: '',
      contact_name: '',
      email: '',
      whatsapp: '',
      address: '',
      category: '',
      last_year_product: ''
    };
  });

  useEffect(() => {
    if (!isOpen) {
      // Clear draft when closed
      localStorage.removeItem('cm_formData');
      localStorage.removeItem('cm_customer_id');
      return;
    }

    const savedCustomerId = localStorage.getItem('cm_customer_id');
    const currentCustomerId = customer ? String(customer.id) : 'new';

    if (savedCustomerId !== currentCustomerId) {
      // Customer changed or it's a new open, initialize from prop
      if (customer) {
        setFormData({
          fiscal_name: customer.fiscal_name || '',
          commercial_name: customer.commercial_name || '',
          nif: customer.nif || '',
          contact_name: customer.contact_name || '',
          email: customer.email || '',
          whatsapp: customer.whatsapp || '',
          address: customer.address || '',
          category: customer.category || '',
          last_year_product: customer.last_year_product || ''
        });
      } else {
        setFormData({
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
      }
      localStorage.setItem('cm_customer_id', currentCustomerId);
    }
  }, [customer, isOpen]);

  // Save changes to sessionStorage
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem('cm_formData', JSON.stringify(formData));
    }
  }, [formData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = () => {
    if (!customer) return;
    const confirmMsg = language === 'es'
      ? '¿Está muy seguro de que desea borrar este cliente?'
      : 'Are you very sure you want to delete this customer?';
    if (window.confirm(confirmMsg)) {
      onDelete(customer.id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90dvh]">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">
            {customer ? t('edit_customer') || 'Edit Customer' : t('add_customer') || 'Add Customer'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <form id="customerForm" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('commercial_name') || 'Commercial Name'}</label>
                <input
                  type="text"
                  name="commercial_name"
                  value={formData.commercial_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fiscal_name') || 'Fiscal Name'}</label>
                <input
                  type="text"
                  name="fiscal_name"
                  value={formData.fiscal_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('nif_cif') || 'NIF / CIF'}</label>
                <input
                  type="text"
                  name="nif"
                  value={formData.nif}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('category') || 'Category'}</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('contact_name') || 'Contact Name'}</label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('email') || 'Email'}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('whatsapp') || 'WhatsApp'} / {t('phone') || 'Phone'}</label>
                <input
                  type="text"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('address') || 'Address'}</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('last_year_product') || 'Last Year Product'}</label>
                <textarea
                  name="last_year_product"
                  value={formData.last_year_product}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                ></textarea>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center rounded-b-none sm:rounded-b-2xl">
          <div>
            {customer && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} />
                {t('delete_customer') || 'Borrar cliente'}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button 
              type="submit" 
              form="customerForm"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Save size={18} />
              {t('save') || 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
