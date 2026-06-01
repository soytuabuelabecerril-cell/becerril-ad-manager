import React, { useState, useEffect } from 'react';
import { getInvoices, deleteInvoice } from '../utils/invoicesStore';
import { RefreshCcw, FileText, Trash2 } from 'lucide-react';

const MoneyReturnsList = () => {
  const [returns, setReturns] = useState([]);

  const loadReturns = () => {
    setReturns(getInvoices().filter(inv => inv.status === 'Refund'));
  };

  useEffect(() => {
    loadReturns();
  }, []);

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to permanently eliminate this return record?")) {
      deleteInvoice(id);
      loadReturns();
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 max-w-6xl mx-auto relative">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <RefreshCcw className="text-red-500" />
          Money Returns & Cancellations
        </h2>
        <span className="text-sm text-gray-500">{returns.length} pending returns</span>
      </div>

      {returns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p>No money returns are pending.</p>
          <p className="text-sm">When you cancel an invoice and opt to generate an Abono, it will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-red-50 text-red-900 text-sm">
                <th className="p-3 font-semibold rounded-tl-lg">Abono ID</th>
                <th className="p-3 font-semibold">Date Cancelled</th>
                <th className="p-3 font-semibold">Customer</th>
                <th className="p-3 font-semibold">Original Method</th>
                <th className="p-3 font-semibold text-right">Amount to Return</th>
                <th className="p-3 font-semibold text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret) => (
                <tr key={ret.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-3">
                    <span className="font-mono text-sm text-red-600 font-bold">{ret.id}</span>
                    <div className="text-[10px] text-gray-400 mt-1">From: {ret.originalInvoiceId}</div>
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
                      title="Eliminate Record"
                    >
                      <Trash2 size={18} />
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

export default MoneyReturnsList;
