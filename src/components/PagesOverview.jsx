import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getFullPages } from '../utils/fallbackData';
import { useLanguage } from '../context/LanguageContext';

const PagesOverview = () => {
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

    const channel = supabase
      .channel('schema-db-changes-overview')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'magazine_pages' },
        (payload) => {
          fetchPages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">{t('po_loading')}</div>;
  }

  const isOccupied = (page) => {
    return (page.ad_type && page.ad_type.trim() !== '') || page.status === 'Reserved';
  };

  const availablePages = pages.filter(p => !isOccupied(p));
  const reservedPages = pages.filter(p => isOccupied(p));

  return (
    <div className="space-y-6 mt-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-800">{pages.length}</span>
          <span className="text-sm text-gray-500 uppercase tracking-wider font-semibold mt-1">{t('po_total')}</span>
        </div>
        <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-green-600">{availablePages.length}</span>
          <span className="text-sm text-green-600 uppercase tracking-wider font-semibold mt-1">{t('po_available')}</span>
        </div>
        <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-red-600">{reservedPages.length}</span>
          <span className="text-sm text-red-600 uppercase tracking-wider font-semibold mt-1">{t('po_reserved')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Available Pages List */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-96 flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-green-700 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            {t('po_available_pages')}
          </h3>
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid grid-cols-4 gap-2">
              {availablePages.map(page => (
                <div key={page.page_number} className="bg-green-50 border border-green-200 text-green-800 rounded p-2 text-center text-sm font-medium">
                  {page.page_number}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reserved Pages List */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-96 flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-red-700 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            {t('po_reserved_pages')}
          </h3>
          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid grid-cols-4 gap-2">
              {reservedPages.map(page => (
                <div key={page.page_number} className="bg-red-50 border border-red-200 text-red-800 rounded p-2 text-center text-sm font-medium" title={page.ad_type}>
                  {page.page_number}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Complete Overview List */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm h-96 flex flex-col">
          <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
            {t('po_complete_directory')}
          </h3>
          <div className="overflow-y-auto flex-1 pr-2 space-y-2">
            {pages.map(page => (
              <div key={page.page_number} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="font-bold text-gray-700 w-12">{page.page_number}</span>
                  <span className="text-sm text-gray-600">{page.ad_type || t('po_no_assignment')}</span>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  isOccupied(page) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {isOccupied(page) ? t('po_reserved') : t('po_available')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagesOverview;
