import React from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { RefreshCcw, FileText, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const MoneyReturnsList = () => {
  const { t } = useLanguage();
  const { invoices, deleteInvoice } = useDatabase();

  const returns = invoices.filter(inv => inv.status === 'Refund');

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to permanently eliminate this return record?")) {
      await deleteInvoice(id);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-6 max-w-6xl mx-auto relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <RefreshCcw className="text-red-500" />
          {t('mrl_title')}
        </h2>
        <span className="text-sm text-gray-500 text-right sm:text-left">{returns.length} {t('mrl_pending_count')}</span>
      </div>

      {returns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p>{t('mrl_no_returns')}</p>
          <p className="text-sm">{t('mrl_when_cancel')}</p>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-red-50 text-red-900 text-sm">
                  <th className="p-3 font-semibold rounded-tl-lg">{t('mrl_col_id')}</th>
                  <th className="p-3 font-semibold">{t('mrl_col_date')}</th>
                  <th className="p-3 font-semibold">{t('mrl_col_customer')}</th>
                  <th className="p-3 font-semibold">{t('mrl_col_method')}</th>
                  <th className="p-3 font-semibold text-right">{t('mrl_col_amount')}</th>
                  <th className="p-3 font-semibold text-right rounded-tr-lg">{t('mrl_col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr key={ret.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3">
                      <span className="font-mono text-sm text-red-600 font-bold">{ret.id}</span>
                      <div className="text-[10px] text-gray-400 mt-1">{t('mrl_from')} {ret.originalInvoiceId}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {new Date(ret.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-gray-900">{ret.customerName}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{ret.productName}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-xs font-bold px-2 py-1 rounded inline-block bg-gray-100 text-gray-700">
                        {ret.paymentMethod}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-red-600 text-right text-lg">
                      {ret.total.toFixed(2)}€
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => handleDelete(ret.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors tooltip-wrapper"
                        title={t('mrl_tooltip_eliminate')}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {returns.map((ret) => (
              <div key={ret.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-3 relative border-l-4 border-l-red-500">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-sm text-red-600 font-bold">{ret.id}</span>
                    <div className="text-[10px] text-gray-400 mt-0.5">{t('mrl_from')} {ret.originalInvoiceId}</div>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(ret.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="text-sm">
                  <div className="font-bold text-gray-900">{ret.customerName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{ret.productName}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('mrl_col_method')}: <span className="font-semibold text-gray-700">{ret.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-semibold block">{t('mrl_col_amount')}</span>
                    <span className="text-lg font-black text-red-600">{ret.total.toFixed(2)}€</span>
                  </div>
                  
                  <button 
                    onClick={() => handleDelete(ret.id)}
                    className="p-2.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center border border-red-100"
                    title={t('mrl_tooltip_eliminate')}
                  >
                    <Trash2 size={16} />
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

export default MoneyReturnsList;
