import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import MagazineGrid from './MagazineGrid';
import { products as catalogProducts } from '../utils/products';
import { 
  BookOpen, 
  Mail, 
  CheckCircle, 
  Send, 
  Loader2, 
  ArrowRight, 
  HelpCircle, 
  MapPin, 
  Phone, 
  FileText,
  AlertCircle,
  Building2,
  Lock,
  Globe,
  LogOut
} from 'lucide-react';

const PublicReservationPortal = () => {
  const { language, setLanguage } = useLanguage();
  const isEs = language === 'es';

  // --- Auth State ---
  const [businessName, setBusinessName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [authCustomerId, setAuthCustomerId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('pr_session_token') || '');
  const [customer, setCustomer] = useState(() => {
    const saved = localStorage.getItem('pr_customer');
    return saved ? JSON.parse(saved) : null;
  });
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // --- Reservation Form State ---
  const [pages, setPages] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [artworkOption, setArtworkOption] = useState('');
  const [designWorkOption, setDesignWorkOption] = useState('');
  const [designWorkPrice, setDesignWorkPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transfer');
  const [submittingReservation, setSubmittingReservation] = useState(false);
  
  // --- Completion State ---
  const [completedOrder, setCompletedOrder] = useState(null);

  // --- Session persistence ---
  useEffect(() => {
    if (sessionToken && customer) {
      localStorage.setItem('pr_session_token', sessionToken);
      localStorage.setItem('pr_customer', JSON.stringify(customer));
      fetchLayoutData();
    } else {
      localStorage.removeItem('pr_session_token');
      localStorage.removeItem('pr_customer');
    }
  }, [sessionToken, customer]);

  const fetchLayoutData = async () => {
    try {
      setLoadingPages(true);
      const res = await fetch('/api/public-data');
      if (!res.ok) throw new Error('Failed to load public layout');
      const data = await res.json();
      setPages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setAuthError(isEs ? 'Introduzca el nombre del negocio' : 'Please enter your business name');
      return;
    }

    setLoadingAuth(true);
    setAuthError('');

    try {
      const res = await fetch('/api/public-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', businessName })
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Error sending OTP');
        return;
      }

      setVerificationToken(data.token);
      setAuthCustomerId(data.customerId);
      setMaskedEmail(data.email);
      setOtpSent(true);
    } catch (err) {
      setAuthError(isEs ? 'Error al contactar con el servidor' : 'Failed to connect to server');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length !== 6) {
      setAuthError(isEs ? 'Introduzca un código de 6 dígitos' : 'Please enter a 6-digit code');
      return;
    }

    setLoadingAuth(true);
    setAuthError('');

    try {
      const res = await fetch('/api/public-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          customerId: authCustomerId,
          otp: otpCode.trim(),
          token: verificationToken
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Verification failed');
        return;
      }

      setSessionToken(data.sessionToken);
      setCustomer(data.customer);
    } catch (err) {
      setAuthError(isEs ? 'Error de verificación' : 'Failed to verify code');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = () => {
    setSessionToken('');
    setCustomer(null);
    setBusinessName('');
    setOtpCode('');
    setOtpSent(false);
    setSelectedPage(null);
    setCompletedOrder(null);
  };

  const productFitsInPage = (product, page) => {
    const filledSlots = new Set();
    let hasAny1 = false;
    
    if (page.ads) {
      page.ads.forEach(ad => {
        const p = catalogProducts.find(prod => prod.name === ad.ad_type);
        if (p) {
          p.requiredSlots.forEach(s => {
            if (s === 'any_1') hasAny1 = true;
            else filledSlots.add(s);
          });
        } else {
          filledSlots.add('top');
          filledSlots.add('middle');
          filledSlots.add('bottom');
        }
      });
    }

    if (hasAny1) {
      if (!filledSlots.has('top')) filledSlots.add('top');
      else if (!filledSlots.has('middle')) filledSlots.add('middle');
      else if (!filledSlots.has('bottom')) filledSlots.add('bottom');
    }

    const availableSlots = new Set(['top', 'middle', 'bottom']);
    filledSlots.forEach(s => availableSlots.delete(s));

    if (product.requiredSlots.includes('any_1')) {
      return availableSlots.size >= 1;
    }
    
    return product.requiredSlots.every(slot => availableSlots.has(slot));
  };

  // Filter products by page number and capacity constraints
  const getAvailableProductsForPage = (page) => {
    if (!page) return [];
    return catalogProducts.filter(p => {
      // Exclude special cover products unless on cover pages
      if (page.page_number === 91) {
        if (p.id !== 12) return false;
      } else if (page.page_number === 92) {
        if (p.id !== 10) return false;
      } else {
        if (p.id === 10 || p.id === 11 || p.id === 12) return false;
      }

      // Parity constraints
      const isEven = page.page_number % 2 === 0;
      const pNameLower = p.name.toLowerCase();
      if (pNameLower.includes('libre adjudicación')) return false;
      if (pNameLower.includes('impar') && isEven) return false;
      if (pNameLower.includes(' par') && !pNameLower.includes('impar') && !isEven) return false;

      // Fit constraints
      return productFitsInPage(p, page);
    });
  };

  const handlePageSelect = (page) => {
    setSelectedPage(page);
    setSelectedProductId('');
    setArtworkOption('');
    setDesignWorkOption('');
    setDesignWorkPrice('');
  };

  const handleSubmitReservation = async (e) => {
    e.preventDefault();
    if (!selectedPage || !selectedProductId || !artworkOption || !paymentMethod) {
      alert(isEs ? 'Rellene todos los campos obligatorios' : 'Please fill in all required fields');
      return;
    }

    if (artworkOption === '3') {
      if (!designWorkOption) {
        alert(isEs ? 'Seleccione la opción de diseño' : 'Please select a design option');
        return;
      }
      if (designWorkOption === '1' && !designWorkPrice) {
        alert(isEs ? 'Introduzca el precio acordado para el diseño' : 'Please enter the design price');
        return;
      }
    }

    setSubmittingReservation(true);

    try {
      const res = await fetch('/api/public-reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          customerId: customer.id,
          pageNumber: selectedPage.page_number,
          productId: selectedProductId,
          artworkOption,
          designWorkOption: designWorkOption || null,
          designWorkPrice: designWorkPrice || 0,
          paymentMethod
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to complete reservation');
        return;
      }

      setCompletedOrder(data.order);
      fetchLayoutData(); // Reload pages layout
    } catch (err) {
      console.error(err);
      alert(isEs ? 'Error de conexión' : 'Connection error');
    } finally {
      setSubmittingReservation(false);
    }
  };

  // Helper to draw mini page slots
  const renderSlotsGraphic = (page) => {
    if (!page) return null;
    const filledSlots = new Set();
    if (page.ads) {
      page.ads.forEach(ad => {
        const prod = catalogProducts.find(p => p.name === ad.ad_type);
        if (prod) {
          prod.requiredSlots.forEach(s => {
            if (s !== 'any_1') filledSlots.add(s);
          });
        } else {
          filledSlots.add('top'); filledSlots.add('middle'); filledSlots.add('bottom');
        }
      });
    }

    return (
      <div className="w-16 h-20 bg-slate-100 border border-slate-300 rounded flex flex-col gap-1 p-1 shadow-inner shrink-0 mb-4 mx-auto" aria-hidden="true">
        <div className={`flex-1 rounded ${filledSlots.has('top') ? 'bg-red-500/80 border border-red-600' : 'bg-green-500/80 border border-green-600'}`} />
        <div className={`flex-1 rounded ${filledSlots.has('middle') ? 'bg-red-500/80 border border-red-600' : 'bg-green-500/80 border border-green-600'}`} />
        <div className={`flex-1 rounded ${filledSlots.has('bottom') ? 'bg-red-500/80 border border-red-600' : 'bg-green-500/80 border border-green-600'}`} />
      </div>
    );
  };

  // --- RENDER LOGIN VIEW ---
  if (!sessionToken || !customer) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans p-4">
        {/* Glow accents */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none animate-pulse duration-[6000ms]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none animate-pulse duration-[8000ms]"></div>

        <div className="w-full max-w-md relative z-10">
          
          {/* Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-14 h-14 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/25 mb-4">
              <BookOpen className="text-white w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-white leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Revista Becerril 2026
            </h1>
            <p className="text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold">
              {isEs ? 'Portal de Reservas del Anunciante' : 'Advertiser Reservation Portal'}
            </p>
          </div>

          {/* Form Card */}
          <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-white">
                {isEs ? 'Autenticación' : 'Verification'}
              </h2>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-white/5 rounded-lg px-2 py-1">
                <Globe size={13} className="text-slate-400" />
                <select 
                  value={language} 
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-transparent text-[11px] text-slate-200 outline-none cursor-pointer"
                >
                  <option value="es">ES</option>
                  <option value="en">EN</option>
                </select>
              </div>
            </div>

            {authError && (
              <div className="mb-5 p-3 rounded-xl bg-red-950/30 border border-red-500/20 flex items-start gap-2.5 text-red-300 text-xs">
                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-400 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {isEs ? 'Nombre Comercial de su Negocio' : 'Commercial Name of your Business'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={isEs ? 'Escriba el nombre registrado...' : 'Enter registered name...'}
                      className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingAuth}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {loadingAuth ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      {isEs ? 'Verificando...' : 'Verifying...'}
                    </>
                  ) : (
                    <>
                      {isEs ? 'Verificar y Enviar Código' : 'Verify & Send Code'}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-slate-300 text-xs bg-blue-950/20 border border-blue-900/20 rounded-xl p-3.5 leading-relaxed">
                  {isEs 
                    ? `Hemos encontrado su negocio en la base de datos. Se ha enviado un código de 6 dígitos a su correo electrónico registrado: ` 
                    : `We found your business. A 6-digit code has been sent to your registered email: `}
                  <strong className="text-white block mt-1 font-mono">{maskedEmail}</strong>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {isEs ? 'Código de Verificación (OTP)' : 'Verification Code (OTP)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 123456"
                      className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm text-center font-mono letter-spacing-2"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setAuthError('');
                    }}
                    className="flex-1 py-3 bg-slate-900 border border-white/10 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold transition-all text-sm"
                  >
                    {isEs ? 'Atrás' : 'Back'}
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAuth}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
                  >
                    {loadingAuth ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : (isEs ? 'Verificar' : 'Verify')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER SUCCESS MODAL ---
  if (completedOrder) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="bg-white rounded-3xl shadow-xl max-w-lg w-full p-8 border border-gray-100 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 scale-100 animate-in zoom-in duration-300">
            <CheckCircle className="w-9 h-9" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isEs ? '¡Reserva Completada!' : 'Reservation Registered!'}
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {isEs 
              ? `Hemos registrado con éxito su reserva en la página ${completedOrder.assignedPage}. Se ha enviado una confirmación a su correo electrónico.` 
              : `Your reservation on page ${completedOrder.assignedPage} has been registered successfully. A confirmation email has been sent.`}
          </p>

          <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-left text-sm text-slate-700 space-y-3 mb-8">
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-400">{isEs ? 'ID de Pedido:' : 'Order ID:'}</span>
              <span className="font-bold text-slate-900">{completedOrder.id}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-400">{isEs ? 'Página Asignada:' : 'Assigned Page:'}</span>
              <span className="font-bold text-slate-900">Pág. {completedOrder.assignedPage}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-400">{isEs ? 'Producto:' : 'Product:'}</span>
              <span className="font-bold text-slate-900">{completedOrder.productName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{isEs ? 'Precio total (IVA inc):' : 'Total Price (inc VAT):'}</span>
              <span className="font-bold text-slate-950">{(completedOrder.price * 1.21).toFixed(2)}€</span>
            </div>
          </div>

          <div className="text-slate-600 text-xs leading-relaxed border-l-4 border-blue-500 bg-blue-50/50 p-4 rounded-r-xl text-left mb-8">
            <p className="font-semibold text-blue-900 mb-1">{isEs ? 'Siguientes Pasos (Instrucciones):' : 'Next Steps (Instructions):'}</p>
            {completedOrder.orderType === 'pre-reserved' ? (
              <p>
                {isEs 
                  ? 'Su espacio está bloqueado por 1 semana (pre-reserva). Por favor realice la transferencia bancaria antes de la fecha de caducidad para asegurar el espacio definitivamente.' 
                  : 'Your space is reserved on hold for 1 week (pre-reservation). Please complete the bank transfer before expiry to secure it.'}
              </p>
            ) : (
              <p>
                {isEs 
                  ? 'Por favor realice la transferencia bancaria con el código del pedido como referencia a la cuenta IBAN indicada en el email. Su espacio estará asegurado una vez verificado el pago.' 
                  : 'Please complete the bank transfer referring the Order ID to the IBAN account sent to your email.'}
              </p>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer text-sm"
          >
            {isEs ? 'Volver al Inicio' : 'Back to Start'}
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER MAIN RESERVATION PANEL & GRID ---
  const pageListProducts = selectedPage ? getAvailableProductsForPage(selectedPage) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4 sm:px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <BookOpen className="text-blue-400" />
          <h1 className="text-md sm:text-lg font-bold truncate">Revista Becerril 2026</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 hidden md:block">
            {isEs ? 'Negocio:' : 'Business:'} <strong className="text-white">{customer.commercial_name || customer.fiscal_name}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 bg-red-950/40 hover:bg-red-900/30 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-semibold cursor-pointer transition-all"
          >
            <LogOut size={13} />
            {isEs ? 'Salir' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
        
        {/* Left 2 Columns: Magazine Layout Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
              {isEs ? 'Páginas Disponibles en la Revista' : 'Available Pages in the Magazine'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {isEs 
                ? 'Haga clic en cualquier página disponible (gris) o con espacio libre para seleccionarla y realizar su reserva.' 
                : 'Click any available page (grey) to select it and reserve your ad space.'}
            </p>
            
            {loadingPages ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                <span>{isEs ? 'Cargando páginas...' : 'Loading pages...'}</span>
              </div>
            ) : (
              <MagazineGrid 
                pages={pages} 
                isPublic={true} 
                onPageClick={handlePageSelect} 
              />
            )}
          </div>
        </div>

        {/* Right 1 Column: Reservation Panel Form */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 relative">
          <div className="text-center pb-4 border-b border-slate-100 mb-5">
            <h2 className="text-lg font-bold text-slate-800">
              {isEs ? 'Formulario de Reserva' : 'Reservation Form'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEs ? 'Complete los detalles para asegurar su espacio' : 'Complete details to hold your space'}
            </p>
          </div>

          {!selectedPage ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-4">
              <HelpCircle className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700 mb-1">
                {isEs ? 'Ninguna página seleccionada' : 'No page selected'}
              </p>
              <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                {isEs 
                  ? 'Seleccione una página en la cuadrícula de la izquierda para comenzar.' 
                  : 'Click a page on the grid on the left to begin.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitReservation} className="space-y-4">
              
              {/* Selected Page visual indicators */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  {isEs ? 'Página Seleccionada' : 'Selected Page'}
                </div>
                <div className="text-3xl font-black text-slate-900 mb-3">
                  Pág. {selectedPage.page_number}
                </div>
                {renderSlotsGraphic(selectedPage)}
              </div>

              {/* Product selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  {isEs ? 'Seleccione el Producto (Tamaño)' : 'Select Product (Size)'}
                </label>
                {pageListProducts.length === 0 ? (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs leading-relaxed font-semibold">
                    {isEs 
                      ? 'No hay productos de anuncios que encajen en el espacio restante de esta página.' 
                      : 'No available ad products fit in the remaining space of this page.'}
                  </div>
                ) : (
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    required
                  >
                    <option value="">
                      {isEs ? '-- Seleccione Anuncio --' : '-- Select Ad Size --'}
                    </option>
                    {pageListProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price}€)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Artwork Design Options */}
              {selectedProductId && (
                <div className="space-y-4 pt-1 border-t border-slate-100 mt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {isEs ? 'Diseño y Arte Final' : 'Artwork & Design'}
                    </label>
                    <select
                      value={artworkOption}
                      onChange={(e) => {
                        setArtworkOption(e.target.value);
                        setDesignWorkOption('');
                        setDesignWorkPrice('');
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      required
                    >
                      <option value="">
                        {isEs ? '-- Seleccione Arte Final --' : '-- Select Artwork Option --'}
                      </option>
                      <option value="1">
                        {isEs ? '1) Usaremos el mismo anuncio del año pasado (2025)' : '1) We will use the same artwork as last year (2025)'}
                      </option>
                      <option value="2">
                        {isEs ? '2) Enviaremos el diseño final por email' : '2) We will email our visual artwork'}
                      </option>
                      <option value="3">
                        {isEs ? '3) Deseamos que la revista diseñe el anuncio' : '3) We want the magazine to design the ad'}
                      </option>
                    </select>
                  </div>

                  {/* Design sub options if Option 3 selected */}
                  {artworkOption === '3' && (
                    <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl space-y-3 animate-in slide-in-from-top-1 duration-200">
                      <label className="block text-xs font-bold text-slate-600">
                        {isEs ? 'Opción de Diseño' : 'Design Work Options'}
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="designOption"
                            value="1"
                            checked={designWorkOption === '1'}
                            onChange={(e) => setDesignWorkOption(e.target.value)}
                            className="accent-blue-500 w-4 h-4"
                          />
                          <span>{isEs ? 'Diseño y Arte Final (Coste adicional)' : 'Design with extra cost'}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="designOption"
                            value="2"
                            checked={designWorkOption === '2'}
                            onChange={(e) => {
                              setDesignWorkOption(e.target.value);
                              setDesignWorkPrice('0');
                            }}
                            className="accent-blue-500 w-4 h-4"
                          />
                          <span>{isEs ? 'Sin coste' : 'Free of charge'}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="designOption"
                            value="3"
                            checked={designWorkOption === '3'}
                            onChange={(e) => {
                              setDesignWorkOption(e.target.value);
                              setDesignWorkPrice('0');
                            }}
                            className="accent-blue-500 w-4 h-4"
                          />
                          <span>{isEs ? 'Vale de consumo en el establecimiento' : 'Establishment voucher'}</span>
                        </label>
                      </div>

                      {designWorkOption === '1' && (
                        <div className="mt-2 pt-2 border-t border-slate-200/50">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            {isEs ? 'Precio de Diseño Acordado (€)' : 'Agreed Design Price (€)'}
                          </label>
                          <input
                            type="number"
                            value={designWorkPrice}
                            onChange={(e) => setDesignWorkPrice(e.target.value)}
                            placeholder="e.g. 25"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                            required
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment option selector (Only bank transfer and pre-reservation) */}
                  <div className="pt-2 border-t border-slate-100 mt-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      {isEs ? 'Método de Reserva' : 'Reservation Mode'}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Transfer')}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          paymentMethod === 'Transfer'
                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm shadow-blue-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText size={14} />
                        {isEs ? 'Reserva (Transferencia)' : 'Reserve (Transfer)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Pre-reserved')}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          paymentMethod === 'Pre-reserved'
                            ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-sm shadow-orange-100'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Loader2 size={14} className={paymentMethod === 'Pre-reserved' ? 'animate-spin' : ''} />
                        {isEs ? 'Pre-reserva (1 Semana)' : 'Hold (1 Week)'}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submittingReservation || pageListProducts.length === 0}
                    className={`w-full py-3.5 mt-4 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-sm ${
                      paymentMethod === 'Pre-reserved' 
                        ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/10 hover:shadow-orange-500/20' 
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/10 hover:shadow-blue-500/20'
                    }`}
                  >
                    {submittingReservation ? (
                      <>
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                        {isEs ? 'Procesando Reserva...' : 'Processing Reservation...'}
                      </>
                    ) : (
                      <>
                        {isEs ? 'Confirmar Reserva' : 'Confirm Reservation'}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </main>
    </div>
  );
};

export default PublicReservationPortal;
