// src/components/PublicConfirmPortal.jsx
import React, { useState, useEffect } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { supabase } from '../lib/supabase';
import { CheckCircle, AlertTriangle, Calendar, XCircle, Clock, BookOpen, FileText } from 'lucide-react';

const PublicConfirmPortal = ({ reservationId, type }) => {
  const { 
    publicConfirmPurchase, 
    publicProlongReservation, 
    publicCancelReservation 
  } = useDatabase();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adDetails, setAdDetails] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [minDate, setMinDate] = useState('');
  const [maxDate, setMaxDate] = useState('');

  // Fetch reservation details on mount
  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const isOrder = type === 'order';
        if (isOrder) {
          const { data, error: err } = await supabase
            .from('orders')
            .select('*')
            .eq('id', reservationId)
            .single();
          if (err || !data) throw new Error('No se encontraron detalles de la pre-reserva.');

          // Check if already paid/cancelled
          if (data.order_type !== 'pre-reserved' || data.is_paid) {
            throw new Error('Esta pre-reserva ya ha sido confirmada o procesada.');
          }

          // Fetch customer email
          const { data: custData } = await supabase
            .from('customers')
            .select('email')
            .ilike('commercial_name', data.customer_name)
            .maybeSingle();

          const expiresDate = data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

          setAdDetails({
            id: data.id,
            customer_name: data.customer_name,
            customer_email: data.customer_email || custData?.email || '',
            page_number: data.assigned_page,
            ad_type: data.product_name,
            price: data.price,
            expires_at: expiresDate.toISOString(),
            isOrder: true,
            prolongedCount: data.prolonged_count || 0
          });
        } else {
          // Fetch from ad_reservations
          const { data, error: err } = await supabase
            .from('ad_reservations')
            .select('*')
            .eq('id', reservationId)
            .single();
          if (err || !data) throw new Error('No se encontraron detalles de la pre-reserva.');

          if (!data.is_pre_reserved || data.is_paid) {
            throw new Error('Esta pre-reserva ya ha sido confirmada o procesada.');
          }

          // Fetch customer email separately since there is no schema foreign key relationship
          let customerEmail = '';
          if (data.customer_id && data.customer_id !== 'legacy') {
            const { data: custData } = await supabase
              .from('customers')
              .select('email')
              .eq('id', data.customer_id)
              .maybeSingle();
            customerEmail = custData?.email || '';
          }

          if (!customerEmail && data.customer_name) {
            const { data: custData } = await supabase
              .from('customers')
              .select('email')
              .ilike('commercial_name', data.customer_name)
              .maybeSingle();
            customerEmail = custData?.email || '';
          }

          setAdDetails({
            id: data.id,
            customer_name: data.customer_name,
            customer_email: customerEmail,
            page_number: data.page_number,
            ad_type: data.ad_type,
            price: data.design_work_price || 0, // Fallback price
            expires_at: data.expires_at,
            isOrder: false,
            prolongedCount: data.prolonged_count || 0
          });
        }
      } catch (err) {
        console.error(err);
        setError(err.message || 'Error al cargar los detalles.');
      } finally {
        setLoading(false);
      }
    };

    if (reservationId) {
      fetchDetails();
    }
  }, [reservationId, type]);

  // Set date limits for prolongation
  useEffect(() => {
    if (adDetails && adDetails.expires_at) {
      const currentExpiry = new Date(adDetails.expires_at);
      
      // Min date is current expiry + 1 day
      const min = new Date(currentExpiry.getTime() + 24 * 60 * 60 * 1000);
      const minStr = min.toISOString().split('T')[0];
      setMinDate(minStr);

      // Max date is current expiry + 3 days
      const max = new Date(currentExpiry.getTime() + 3 * 24 * 60 * 60 * 1000);
      const maxStr = max.toISOString().split('T')[0];
      setMaxDate(maxStr);

      // Default selected date to max (3 days extension)
      setSelectedDate(maxStr);
    }
  }, [adDetails]);

  const handleConfirm = async () => {
    if (!adDetails) return;
    setLoading(true);
    const success = await publicConfirmPurchase(
      adDetails.id,
      adDetails.isOrder,
      adDetails.customer_email,
      adDetails.customer_name,
      adDetails.page_number
    );
    setLoading(false);
    if (success) {
      setActionSuccess('confirm');
    } else {
      setError('Ocurrió un error al confirmar su compra. Por favor, inténtelo de nuevo.');
    }
  };

  const handleProlong = async () => {
    if (!adDetails || !selectedDate) return;
    setLoading(true);
    const newExpiresAt = new Date(selectedDate).toISOString();
    const success = await publicProlongReservation(
      adDetails.id,
      newExpiresAt,
      adDetails.isOrder,
      adDetails.customer_email,
      adDetails.customer_name,
      adDetails.page_number
    );
    setLoading(false);
    if (success) {
      setActionSuccess('prolong');
      // Update local expiry date in UI state
      setAdDetails(prev => ({ ...prev, expires_at: newExpiresAt, prolongedCount: (prev.prolongedCount || 0) + 1 }));
    } else {
      setError('Ocurrió un error al prolongar su reserva. Por favor, inténtelo de nuevo.');
    }
  };

  const handleCancel = async () => {
    if (!adDetails) return;
    const confirmCancel = window.confirm('¿Está seguro de que desea cancelar su pre-reserva? Esta acción es irreversible.');
    if (!confirmCancel) return;

    setLoading(true);
    const success = await publicCancelReservation(
      adDetails.id,
      adDetails.page_number,
      adDetails.customer_name,
      adDetails.ad_type,
      adDetails.isOrder,
      adDetails.customer_email
    );
    setLoading(false);
    if (success) {
      setActionSuccess('cancel');
    } else {
      setError('Ocurrió un error al cancelar su reserva. Por favor, inténtelo de nuevo.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-sm font-medium tracking-wide">Cargando detalles de su reserva...</p>
      </div>
    );
  }

  if (error && !actionSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Error de Reserva</h2>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
            Si cree que esto es un error, por favor contacte a su gestor de la Revista de Fiestas Patronales Becerril de la Sierra 2026.
          </div>
        </div>
      </div>
    );
  }

  if (actionSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 font-sans p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl animate-in zoom-in-95 duration-200">
          {actionSuccess === 'confirm' && (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Reserva Confirmada</h2>
              <p className="text-sm text-slate-400 mb-6">
                ¡Gracias! Su reserva ha sido confirmada como compra pendiente de transferencia. Le hemos enviado un correo de confirmación con los detalles del pago.
              </p>
            </>
          )}
          {actionSuccess === 'prolong' && (
            <>
              <Clock className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Reserva Prolongada</h2>
              <p className="text-sm text-slate-400 mb-6">
                Su pre-reserva ha sido prolongada con éxito hasta el <span className="font-bold text-blue-400">{new Date(adDetails.expires_at).toLocaleDateString()}</span>. Se le ha enviado un correo electrónico de confirmación.
              </p>
            </>
          )}
          {actionSuccess === 'cancel' && (
            <>
              <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Reserva Cancelada</h2>
              <p className="text-sm text-slate-400 mb-6">
                Su pre-reserva ha sido cancelada correctamente y el espacio publicitario ha sido liberado para otros clientes. Se le ha enviado un correo de confirmación.
              </p>
            </>
          )}
          <div className="text-xs text-slate-500 border-t border-slate-800 pt-4">
            Ya puede cerrar esta pestaña del navegador.
          </div>
        </div>
      </div>
    );
  }

  const expiryDateFormatted = new Date(adDetails.expires_at).toLocaleDateString();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans p-4 sm:p-6 text-slate-300">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="text-blue-500 w-8 h-8" />
        <h1 className="text-2xl font-bold text-white tracking-wide">Revista de Fiestas Patronales Becerril de la Sierra 2026</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-xl w-full flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-extrabold text-white mb-1">Confirmar Espacio Publicitario</h2>
          <p className="text-slate-400 text-xs sm:text-sm">Consulte los detalles de su anuncio y elija cómo proceder.</p>
        </div>

        {/* Ad Details Box */}
        <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-5 text-sm flex flex-col gap-3">
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-500 font-medium">Cliente</span>
            <span className="text-white font-bold">{adDetails.customer_name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-500 font-medium">Página Asignada</span>
            <span className="text-blue-400 font-extrabold text-base">Pág. {adDetails.page_number}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800 pb-2">
            <span className="text-slate-500 font-medium">Anuncio / Producto</span>
            <span className="text-white font-semibold">{adDetails.ad_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Fecha Límite Pre-reserva</span>
            <span className="text-amber-500 font-bold flex items-center gap-1">
              <Clock size={14} />
              {expiryDateFormatted}
            </span>
          </div>
        </div>

        {/* Options Panel */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Option 1: Confirm Transfer */}
          <div className="border border-slate-800/60 rounded-xl p-4 bg-slate-900/50 hover:bg-slate-800/20 transition-all flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-black">1</span>
                Comprar Espacio y Confirmar Transferencia
              </h3>
              <p className="text-slate-400 text-xs mt-1 pl-7">
                Confirmará la compra del anuncio y se compromete a realizar una transferencia bancaria. Su espacio quedará reservado definitivamente.
              </p>
            </div>
            <button
              onClick={handleConfirm}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <CheckCircle size={14} />
              Quiero comprar el anuncio y realizaré una transferencia
            </button>
          </div>

          {/* Option 2: Prolong Reservation */}
          <div className="border border-slate-800/60 rounded-xl p-4 bg-slate-900/50 hover:bg-slate-800/20 transition-all flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black">2</span>
                Prolongar Pre-reserva (Máx. 3 días)
              </h3>
              <p className="text-slate-400 text-xs mt-1 pl-7">
                ¿Necesita un poco más de tiempo? Amplíe la duración de su pre-reserva de forma temporal (máximo 3 días más).
              </p>
            </div>
            {adDetails.prolongedCount >= 1 ? (
              <div className="pl-7 text-rose-400 text-xs font-semibold flex items-center gap-1">
                <AlertTriangle size={12} />
                Esta pre-reserva ya ha sido prolongada previamente y no admite más extensiones.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center pl-7">
                <div className="flex-1 relative flex items-center">
                  <Calendar className="absolute left-3 text-slate-500" size={16} />
                  <input
                    type="date"
                    min={minDate}
                    max={maxDate}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  onClick={handleProlong}
                  disabled={!selectedDate}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Clock size={14} />
                  Solicitar Prolongación
                </button>
              </div>
            )}
          </div>

          {/* Option 3: Cancel Pre-reservation */}
          <div className="border border-slate-800/60 rounded-xl p-4 bg-slate-900/50 hover:bg-slate-800/20 transition-all flex flex-col gap-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-black">3</span>
                Cancelar Pre-reserva
              </h3>
              <p className="text-slate-400 text-xs mt-1 pl-7">
                Libere el espacio publicitario si ya no desea publicar el anuncio en esta edición de la revista.
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="w-full bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-rose-900/40 font-bold py-2.5 px-4 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <XCircle size={14} />
              Deseo cancelar mi pre-reserva
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicConfirmPortal;
