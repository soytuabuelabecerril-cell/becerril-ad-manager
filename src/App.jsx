import React, { useState } from 'react';
import MagazineGrid from './components/MagazineGrid';
import PagesOverview from './components/PagesOverview';
import CustomersList from './components/CustomersList';
import ClientsList from './components/ClientsList';
import InvoicesList from './components/InvoicesList';
import PendingOrdersList from './components/PendingOrdersList';
import MoneyReturnsList from './components/MoneyReturnsList';
import ReservationPanel from './components/ReservationPanel';
import FinancialDashboard from './components/FinancialDashboard';
import { BookOpen, MapPin, Users, Settings, Receipt, Clock, RefreshCcw, Globe, Menu, X, TrendingUp, FileText } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

function App() {
  const { t, language, setLanguage } = useLanguage();
  const [selectedPage, setSelectedPage] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [currentTab, setCurrentTab] = useState('magazine');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handlePageClick = (page) => {
    setSelectedPage(page);
  };

  const handleLocationSelect = (data) => {
    setLocationData(data);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white p-6 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight">{t('app_title')}</h1>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        
        {/* Language Selector */}
        <div className="mb-6 bg-slate-800 rounded-lg p-2 flex items-center gap-2">
          <Globe size={16} className="text-slate-400" />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm text-slate-200 outline-none w-full cursor-pointer"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => handleTabChange('magazine')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'magazine' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <BookOpen size={20} /> {t('nav_magazine')}
          </button>
          <button 
            onClick={() => handleTabChange('customers')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'customers' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <FileText size={20} /> {t('nav_customers')}
          </button>
          <button 
            onClick={() => handleTabChange('clients')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'clients' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Users size={20} /> {t('nav_clients')}
          </button>
          <button 
            onClick={() => handleTabChange('invoices')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'invoices' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Receipt size={20} /> {t('nav_invoices')}
          </button>
          <button 
            onClick={() => handleTabChange('pending')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'pending' ? 'bg-orange-500 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Clock size={20} /> {t('nav_pending')}
          </button>
          <button 
            onClick={() => handleTabChange('returns')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'returns' ? 'bg-red-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <RefreshCcw size={20} /> {t('nav_returns')}
          </button>
          <button 
            onClick={() => handleTabChange('financial')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentTab === 'financial' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <TrendingUp size={20} /> {t('nav_financial')}
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-lg text-slate-300">
            <Settings size={20} /> {t('nav_settings')}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-5 flex justify-between items-center">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800">{t('header_dashboard')}</h2>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex h-10 w-10 rounded-full bg-blue-100 items-center justify-center text-blue-800 font-bold">
              IA
            </div>
            <button 
              className="md:hidden p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </header>

        <main className={currentTab !== 'magazine' ? 'p-8' : 'p-8'}>
          {currentTab === 'customers' && <CustomersList />}
          {currentTab === 'clients' && <ClientsList />}
          {currentTab === 'invoices' && <InvoicesList onSelectPage={setSelectedPage} />}
          {currentTab === 'returns' && <MoneyReturnsList />}
          {currentTab === 'financial' && <FinancialDashboard />}
          {currentTab === 'pending' && (
            <PendingOrdersList 
              onGoToPage={(page) => {
                setSelectedPage(page);
                setCurrentTab('magazine');
              }} 
            />
          )}
          
          {currentTab === 'magazine' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <div className="xl:col-span-3 space-y-8">
                <MagazineGrid onPageClick={handlePageClick} />
                <PagesOverview />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Overlay for Reservation Panel */}
      {selectedPage && currentTab !== 'customers' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <ReservationPanel 
              selectedPage={selectedPage} 
              onReservationComplete={() => setSelectedPage(null)} 
              onCancel={() => setSelectedPage(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
