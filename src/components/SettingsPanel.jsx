import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTemplate, getTemplateVariables } from '../utils/notifications';
import { Mail, MessageCircle, Save, RotateCcw, FileText, Sparkles, Info, Check, BookOpen, PlusCircle, RefreshCw, AlertTriangle, ChevronRight, Loader, Search } from 'lucide-react';

const DEFAULT_TEMPLATES = {
  invoice_email: {
    id: 'invoice_email',
    subject: 'Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. {id}',
    body: 'Hola,\n\nAdjuntamos la confirmación de pago y factura correspondiente a su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Número de Factura: {id}\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: Efectivo\n- Precio Base: {price}€\n{designPrice}- Subtotal: {subtotal}€\n- IVA (21%): {vat}€\n- Total Pagado: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  invoice_whatsapp: {
    id: 'invoice_whatsapp',
    subject: '',
    body: 'Confirmación de pago y Factura Nro. {id} – {productAbbreviation} – {customerName} – {total}€'
  },
  recibo_email: {
    id: 'recibo_email',
    subject: 'Recibo de Pago Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la reserva y el recibo de pago en efectivo para su anuncio en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Precio Base: {price}€\n{designPrice}- Recibo: {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  recibo_whatsapp: {
    id: 'recibo_whatsapp',
    subject: '',
    body: 'Recibí, pago a cuenta – {productAbbreviation} – {customerName} – {total}€'
  },
  order_reservation_email: {
    id: 'order_reservation_email',
    subject: 'Confirmación de Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Método de Pago: {paymentMethod}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_reservation_whatsapp: {
    id: 'order_reservation_whatsapp',
    subject: '',
    body: 'Confirmación de Reserva - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_prereservation_email: {
    id: 'order_prereservation_email',
    subject: 'Pre-Reserva Revista de Fiestas Patronales Becerril de la Sierra 2026: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nGracias,\nEquipo de Coordinación Publicitaria'
  },
  order_prereservation_whatsapp: {
    id: 'order_prereservation_whatsapp',
    subject: '',
    body: 'Confirmación de Pre-reserva (temporal 1 semana) - Revista de Fiestas Patronales Becerril de la Sierra 2026:\n\n- Cliente: {customerName}\n- Producto: {productName}\n- Pág. Asignada: {assignedPage}\n- Subtotal: {subtotal}€\n- Total (con IVA): {total}€\n\nGracias,\nEquipo de Coordinación Publicitaria'
  }
};

const DUMMY_TRANSACTION = {
  id: '08_2601',
  customerName: 'Distribuciones Alimentarias Becerril S.A.',
  productName: 'Página Completa Contraportada',
  assignedPage: '92',
  price: 250,
  designPrice: 50,
  vat: 63,
  total: 363,
  paymentMethod: 'Transfer',
  artworkComment: 'Usar el mismo diseño del año pasado con el nuevo logo en alta definición.'
};


const SettingsPanel = () => {
  const { t, language } = useLanguage();
  const { templates, saveCommunicationTemplate, actionLogs, fetchActionLogs } = useDatabase();

  const [activeChannel, setActiveChannel] = useState('email'); // 'email' | 'whatsapp'
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('invoice_email');
  
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  

  
  const [activeField, setActiveField] = useState('body'); // 'subject' | 'body'

  // --- Page Size State ---
  const { expandPages, restoreOriginalPages, pages } = useDatabase();
  const currentPageCount = pages ? pages.filter(p => typeof p.page_number === 'number').length : 92;
  const isOriginalSize = currentPageCount === 92;

  const PAGE_EXPANSION_OPTIONS = [4, 8, 12, 16, 20];
  const [selectedExpansion, setSelectedExpansion] = useState(null);
  const [expandConfirmOpen, setExpandConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pageSizeLoading, setPageSizeLoading] = useState(false);
  const [pageSizeAlert, setPageSizeAlert] = useState(null); // { type: 'success'|'error', message: string }

  const handleExpandConfirm = async () => {
    if (!selectedExpansion) return;
    setPageSizeLoading(true);
    setExpandConfirmOpen(false);
    try {
      const result = await expandPages(selectedExpansion);
      const newTotal = result?.newTotal || (currentPageCount + selectedExpansion);
      setPageSizeAlert({
        type: 'success',
        message: t('settings_expand_success').replace('{total}', newTotal)
      });
    } catch (e) {
      console.error('Expand pages error:', e);
      setPageSizeAlert({ type: 'error', message: t('magazine_swap_error') });
    } finally {
      setPageSizeLoading(false);
      setSelectedExpansion(null);
      setTimeout(() => setPageSizeAlert(null), 5000);
    }
  };

  const handleRestoreConfirm = async () => {
    setPageSizeLoading(true);
    setRestoreConfirmOpen(false);
    try {
      const result = await restoreOriginalPages();
      if (result?.alreadyOriginal) {
        setPageSizeAlert({ type: 'success', message: t('settings_already_original') });
      } else {
        setPageSizeAlert({ type: 'success', message: t('settings_restore_success') });
      }
    } catch (e) {
      console.error('Restore pages error:', e);
      setPageSizeAlert({ type: 'error', message: t('magazine_swap_error') });
    } finally {
      setPageSizeLoading(false);
      setTimeout(() => setPageSizeAlert(null), 5000);
    }
  };


  const subjectRef = useRef(null);
  const bodyRef = useRef(null);

  const channelTemplates = {
    email: [
      { id: 'invoice_email', label: t('settings_type_invoice'), icon: FileText },
      { id: 'recibo_email', label: t('settings_type_recibo'), icon: FileText },
      { id: 'order_reservation_email', label: t('settings_type_reservation'), icon: FileText },
      { id: 'order_prereservation_email', label: t('settings_type_prereservation'), icon: FileText }
    ],
    whatsapp: [
      { id: 'invoice_whatsapp', label: t('settings_type_invoice'), icon: MessageCircle },
      { id: 'recibo_whatsapp', label: t('settings_type_recibo'), icon: MessageCircle },
      { id: 'order_reservation_whatsapp', label: t('settings_type_reservation'), icon: MessageCircle },
      { id: 'order_prereservation_whatsapp', label: t('settings_type_prereservation'), icon: MessageCircle }
    ]
  };

  // Synchronize component state when selected template changes
  useEffect(() => {
    const template = templates?.[selectedTemplateId] || DEFAULT_TEMPLATES[selectedTemplateId];
    if (template) {
      setEditedSubject(template.subject || '');
      setEditedBody(template.body || '');
    }
  }, [selectedTemplateId, templates]);

  // Adjust selected template if user switches between Email and WhatsApp channels
  const handleChannelChange = (channel) => {
    setActiveChannel(channel);
    const targetTemplates = channelTemplates[channel];
    // Keep corresponding type or pick first
    const currentType = selectedTemplateId.replace('_email', '').replace('_whatsapp', '');
    const matchingTemplate = targetTemplates.find(t => t.id.startsWith(currentType));
    if (matchingTemplate) {
      setSelectedTemplateId(matchingTemplate.id);
    } else {
      setSelectedTemplateId(targetTemplates[0].id);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveCommunicationTemplate(selectedTemplateId, editedSubject, editedBody);
      setShowSaveAlert(true);
      setTimeout(() => setShowSaveAlert(false), 3000);
    } catch (e) {
      console.error("Failed to save template", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm(t('settings_reset_confirm'))) {
      const defaultT = DEFAULT_TEMPLATES[selectedTemplateId];
      if (defaultT) {
        setEditedSubject(defaultT.subject || '');
        setEditedBody(defaultT.body || '');
      }
    }
  };

  // Helper to insert placeholders at cursor position
  const insertVariable = (variable) => {
    if (activeField === 'subject' && subjectRef.current) {
      const start = subjectRef.current.selectionStart;
      const end = subjectRef.current.selectionEnd;
      const val = editedSubject;
      const nextVal = val.substring(0, start) + variable + val.substring(end);
      setEditedSubject(nextVal);
      setTimeout(() => {
        if (subjectRef.current) {
          subjectRef.current.focus();
          subjectRef.current.setSelectionRange(start + variable.length, start + variable.length);
        }
      }, 0);
    } else if (activeField === 'body' && bodyRef.current) {
      const start = bodyRef.current.selectionStart;
      const end = bodyRef.current.selectionEnd;
      const val = editedBody;
      const nextVal = val.substring(0, start) + variable + val.substring(end);
      setEditedBody(nextVal);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.focus();
          bodyRef.current.setSelectionRange(start + variable.length, start + variable.length);
        }
      }, 0);
    }
  };

  // Generate formatting preview with dummy transaction details
  const previewVars = getTemplateVariables(DUMMY_TRANSACTION, language);
  const previewSubject = formatTemplate(editedSubject, previewVars);
  const previewBody = formatTemplate(editedBody, previewVars);

  const variablesList = [
    { key: '{id}', label: 'ID', desc: language === 'es' ? 'ID de Factura/Recibo/Pedido' : 'Invoice/Receipt/Order ID' },
    { key: '{customerName}', label: 'Customer', desc: language === 'es' ? 'Nombre del Cliente' : 'Customer Commercial Name' },
    { key: '{productName}', label: 'Product Name', desc: language === 'es' ? 'Nombre del anuncio' : 'Ad Product Name' },
    { key: '{productAbbreviation}', label: 'Product Abbrev', desc: language === 'es' ? 'Abreviación del anuncio (e.g. PC)' : 'Ad Product Abbreviation (e.g. PC)' },
    { key: '{assignedPage}', label: 'Page', desc: language === 'es' ? 'Página Asignada' : 'Assigned Page Number' },
    { key: '{price}', label: 'Base Price', desc: language === 'es' ? 'Precio Base' : 'Base Price of Ad' },
    { key: '{designPrice}', label: 'Design Price Line', desc: language === 'es' ? 'Precio Diseño formateado' : 'Formatted Design Price Line' },
    { key: '{designPriceValue}', label: 'Design Price Value', desc: language === 'es' ? 'Precio Diseño (número)' : 'Design Price numerical value' },
    { key: '{subtotal}', label: 'Subtotal', desc: language === 'es' ? 'Subtotal' : 'Subtotal Amount' },
    { key: '{vat}', label: 'VAT', desc: language === 'es' ? 'IVA (21%)' : 'VAT (21%) Amount' },
    { key: '{total}', label: 'Total', desc: language === 'es' ? 'Total' : 'Total Amount' },
    { key: '{paymentMethod}', label: 'Payment Method', desc: language === 'es' ? 'Método de Pago' : 'Payment Method Selected' },
    { key: '{artworkComment}', label: 'Artwork note', desc: language === 'es' ? 'Nota de diseño' : 'Artwork details comment' }
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sparkles className="text-blue-600" />
            {t('settings_comm_title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t('settings_comm_desc')}</p>
        </div>
        
        {/* Channel Tab selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-full md:w-auto">
          <button
            onClick={() => handleChannelChange('email')}
            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              activeChannel === 'email' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail size={16} />
            {t('settings_tab_email')}
          </button>
          <button
            onClick={() => handleChannelChange('whatsapp')}
            className={`flex-1 md:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${
              activeChannel === 'whatsapp' ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageCircle size={16} />
            {t('settings_tab_whatsapp')}
          </button>
        </div>
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Template Selector List */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          {channelTemplates[activeChannel].map((tmpl) => {
            const Icon = tmpl.icon;
            const isSelected = selectedTemplateId === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={`w-full text-left px-3.5 py-3 rounded-lg border text-sm font-medium flex items-center gap-2.5 transition-all cursor-pointer ${
                  isSelected 
                    ? (activeChannel === 'email' 
                        ? 'border-blue-500 bg-blue-50/50 text-blue-700 font-semibold shadow-sm' 
                        : 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-semibold shadow-sm')
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <Icon size={18} className={isSelected ? (activeChannel === 'email' ? 'text-blue-500' : 'text-emerald-500') : 'text-gray-400'} />
                <span className="truncate">{tmpl.label}</span>
              </button>
            );
          })}
        </div>

        {/* Center/Right Column: Workspace & Preview */}
        <div className="lg:col-span-3 grid grid-cols-1 xl:grid-cols-2 gap-6 border-l border-gray-100 xl:pl-6">
          
          {/* Form Editor */}
          <div className="flex flex-col gap-4">
            {/* Save Alerts */}
            {showSaveAlert && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <Check size={16} className="shrink-0" />
                {t('settings_save_success')}
              </div>
            )}

            {/* Email Subject Field */}
            {activeChannel === 'email' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('settings_field_subject')}</label>
                <input
                  ref={subjectRef}
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  onFocus={() => setActiveField('subject')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="e.g. Factura Revista de Fiestas Patronales Becerril de la Sierra 2026: Nro. {id}"
                />
              </div>
            )}

            {/* Body Field */}
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('settings_field_body')}</label>
              <textarea
                ref={bodyRef}
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                onFocus={() => setActiveField('body')}
                rows={12}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono leading-relaxed resize-y"
                placeholder={activeChannel === 'email' ? "Email content..." : "WhatsApp message..."}
              />
            </div>

            {/* Editor Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <button
                onClick={handleReset}
                className="px-3.5 py-1.5 border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer bg-white"
              >
                <RotateCcw size={15} />
                {t('settings_btn_reset')}
              </button>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-1.5 text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                  activeChannel === 'email' 
                    ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
              >
                <Save size={15} />
                {isSaving ? t('loading') : t('settings_btn_save')}
              </button>
            </div>
            
            {/* Cheat Sheet dynamic variables */}
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mt-2">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider mb-1">
                <Sparkles size={14} className="text-blue-500" />
                {t('settings_variables_title')}
              </h4>
              <p className="text-xs text-slate-400 mb-3">{t('settings_variables_desc')}</p>
              
              <div className="flex flex-wrap gap-1.5">
                {variablesList.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => insertVariable(variable.key)}
                    className="px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 font-mono text-[10.5px] rounded-md transition-all cursor-pointer shadow-sm text-left truncate max-w-full"
                    title={variable.desc}
                  >
                    {variable.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right/Second half: Live Preview (Rich aesthetic representation) */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Info size={14} className="text-blue-500" />
                {t('settings_preview')}
              </span>
              <p className="text-xs text-gray-400">{t('settings_preview_desc')}</p>
            </div>

            {activeChannel === 'email' ? (
              // Mock Email Box Styling (Glassmorphism layout)
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1 bg-slate-50">
                {/* Email Header */}
                <div className="bg-white border-b border-gray-100 p-3 flex flex-col gap-1.5">
                  <div className="flex items-center text-xs gap-1.5">
                    <span className="text-gray-400 w-12 font-medium">To:</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono truncate max-w-full">
                      {DUMMY_TRANSACTION.customerName} &lt;cliente@empresa.com&gt;
                    </span>
                  </div>
                  <div className="flex items-center text-xs gap-1.5 border-t border-gray-50 pt-1.5">
                    <span className="text-gray-400 w-12 font-medium">Subject:</span>
                    <span className="text-slate-800 font-bold truncate">
                      {previewSubject || <em className="text-gray-400 font-normal">None</em>}
                    </span>
                  </div>
                </div>
                {/* Email Body */}
                <div className="p-4 bg-white m-3 rounded-lg border border-gray-100 flex-1 whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed shadow-sm min-h-[300px] max-h-[500px] overflow-y-auto">
                  {previewBody || <em className="text-gray-400">Empty message body</em>}
                </div>
              </div>
            ) : (
              // Mock WhatsApp Phone Preview (Elegant chat UI layout)
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-lg flex flex-col flex-1 bg-[#efeae2] max-w-md mx-auto w-full relative">
                {/* Phone Header */}
                <div className="bg-[#075e54] text-white p-3 flex items-center gap-3 shrink-0">
                  <div className="h-9 w-9 rounded-full bg-slate-200/50 flex items-center justify-center font-bold text-white shadow-inner">
                    R
                  </div>
                  <div>
                    <h5 className="text-sm font-bold truncate leading-none">Revista de Fiestas Patronales Becerril de la Sierra 2026</h5>
                    <span className="text-[10px] opacity-80 mt-1 block">online</span>
                  </div>
                </div>
                {/* Chat Area */}
                <div className="p-4 flex-1 flex flex-col justify-end min-h-[400px] max-h-[500px] overflow-y-auto">
                  {/* WhatsApp Message Bubble */}
                  <div className="bg-white text-gray-800 rounded-xl p-3 shadow-md max-w-[85%] self-start relative border border-slate-100/30">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed pr-6">
                      {previewBody || <em className="text-gray-400">Empty message body</em>}
                    </div>
                    {/* Time indicator */}
                    <span className="text-[9px] text-gray-400 absolute bottom-1 right-2">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>



      {/* ============================================================ */}
      {/* PAGE SIZE / EXPANSION SECTION */}
      {/* ============================================================ */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="text-violet-600" size={20} />
              {t('settings_page_size_title')}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{t('settings_page_size_desc')}</p>
          </div>
          {/* Current size badge */}
          <div className="flex-shrink-0 flex items-center gap-2 bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl px-4 py-2.5">
            <span className="text-2xl font-black text-violet-700">{currentPageCount}</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">{t('settings_page_size_current')}</span>
              <span className="text-xs text-violet-600">{t('settings_page_size_pages')}</span>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {pageSizeAlert && (
          <div className={`mb-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            pageSizeAlert.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {pageSizeAlert.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertTriangle size={16} className="shrink-0" />}
            {pageSizeAlert.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Restore Original */}
          <div className="flex flex-col gap-3">
            <div className={`p-4 rounded-xl border-2 flex flex-col gap-3 transition-all ${
              isOriginalSize
                ? 'border-emerald-300 bg-emerald-50/60'
                : 'border-amber-300 bg-amber-50/60'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isOriginalSize ? 'bg-emerald-100' : 'bg-amber-100'
                }`}>
                  {isOriginalSize
                    ? <Check size={20} className="text-emerald-600" />
                    : <RefreshCw size={20} className="text-amber-600" />}
                </div>
                <div>
                  <h4 className={`font-bold text-sm ${
                    isOriginalSize ? 'text-emerald-800' : 'text-amber-800'
                  }`}>
                    {t('settings_original_state')}
                  </h4>
                  <p className={`text-xs mt-0.5 ${
                    isOriginalSize ? 'text-emerald-600' : 'text-amber-700'
                  }`}>
                    {t('settings_original_state_desc')}
                  </p>
                </div>
              </div>
              {!isOriginalSize && (
                <div>
                  <p className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg p-2 mb-2 flex items-start gap-1.5">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                    {t('settings_expand_warning')}
                  </p>
                  <button
                    disabled={pageSizeLoading}
                    onClick={() => setRestoreConfirmOpen(true)}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                  >
                    {pageSizeLoading ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {t('settings_restore_btn')}
                  </button>
                </div>
              )}
              {isOriginalSize && (
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                  <Check size={12} />
                  {t('settings_already_original')}
                </p>
              )}
            </div>
          </div>

          {/* Right: Expansion Options */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle size={14} className="text-violet-500" />
              {t('settings_expand_add')}
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {PAGE_EXPANSION_OPTIONS.map(opt => {
                const isSelected = selectedExpansion === opt;
                const wouldTotal = currentPageCount + opt;
                const alreadyExpanded = !isOriginalSize;
                return (
                  <button
                    key={opt}
                    disabled={alreadyExpanded || pageSizeLoading}
                    onClick={() => {
                      setSelectedExpansion(opt);
                      setExpandConfirmOpen(true);
                    }}
                    title={alreadyExpanded ? t('settings_already_expanded').replace('{total}', currentPageCount) : `+${opt} → ${wouldTotal} páginas`}
                    className={`flex flex-col items-center justify-center rounded-xl border-2 py-3 px-1 text-center transition-all cursor-pointer ${
                      alreadyExpanded || pageSizeLoading
                        ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                        : isSelected
                          ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-md shadow-violet-100'
                          : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 text-slate-700 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-xl font-black leading-none">+{opt}</span>
                    <span className="text-[9px] font-medium mt-1 opacity-70">{wouldTotal} pgs</span>
                  </button>
                );
              })}
            </div>
            {!isOriginalSize && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                <AlertTriangle size={12} className="shrink-0" />
                {t('settings_already_expanded').replace('{total}', currentPageCount)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Expansion Confirm Modal */}
      {expandConfirmOpen && selectedExpansion && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                <PlusCircle size={24} className="text-violet-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{t('settings_page_size_title')}</h3>
                <p className="text-sm text-gray-500">
                  {currentPageCount} → {currentPageCount + selectedExpansion} {t('settings_page_size_pages')}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-700 bg-slate-50 border border-slate-100 rounded-xl p-4">
              {t('settings_expand_confirm').replace('{total}', currentPageCount + selectedExpansion)}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setExpandConfirmOpen(false); setSelectedExpansion(null); }}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExpandConfirm}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <ChevronRight size={16} />
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      {restoreConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{t('settings_restore_btn')}</h3>
                <p className="text-sm text-gray-500">{currentPageCount} → 92 {t('settings_page_size_pages')}</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
              {t('settings_restore_confirm')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRestoreConfirmOpen(false)}
                className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw size={16} />
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SYSTEM ACTIVITY LOGS (LOG FILES) SECTION */}
      {/* ============================================================ */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        {/* Header + Refresh Button */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <FileText className="text-indigo-600" size={20} />
              {language === 'es' ? 'Archivos de Registro (Logs)' : 'System Log Files'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {language === 'es' 
                ? 'Historial de auditoría en tiempo real con todas las actividades, transacciones y correos electrónicos enviados.' 
                : 'Real-time audit history of all system activities, transactions, and sent email notifications.'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              {(actionLogs || []).length} {language === 'es' ? 'eventos' : 'events'}
            </span>
            <button
              onClick={() => fetchActionLogs && fetchActionLogs()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={13} />
              {language === 'es' ? 'Actualizar' : 'Refresh'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={language === 'es' ? 'Buscar en logs (acción, cliente, email, producto...)...' : 'Search logs...'}
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full text-sm bg-white"
            />
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-100 rounded-xl max-h-[400px] overflow-y-auto">
            {(() => {
              const filtered = (actionLogs || []).filter(log => {
                if (!logSearchQuery) return true;
                const q = logSearchQuery.toLowerCase();
                return (
                  (log.action_type && log.action_type.toLowerCase().includes(q)) ||
                  (log.target_id && log.target_id.toLowerCase().includes(q)) ||
                  (log.customer_name && log.customer_name.toLowerCase().includes(q)) ||
                  (log.customer_email && log.customer_email.toLowerCase().includes(q)) ||
                  (log.customer_phone && log.customer_phone.toLowerCase().includes(q)) ||
                  (log.product_name && log.product_name.toLowerCase().includes(q)) ||
                  (log.payment_method && log.payment_method.toLowerCase().includes(q)) ||
                  (log.payment_status && log.payment_status.toLowerCase().includes(q))
                );
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 text-sm bg-slate-50/50">
                    {language === 'es' ? 'No se encontraron registros de eventos.' : 'No event logs found.'}
                  </div>
                );
              }

              return (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 tracking-wider uppercase sticky top-0 z-10 font-bold">
                      <th className="p-3">{language === 'es' ? 'Fecha/Hora' : 'Date/Time'}</th>
                      <th className="p-3">{language === 'es' ? 'Acción' : 'Action'}</th>
                      <th className="p-3">ID</th>
                      <th className="p-3">{language === 'es' ? 'Cliente' : 'Customer'}</th>
                      <th className="p-3">{language === 'es' ? 'Producto/Pág' : 'Product/Pg'}</th>
                      <th className="p-3">Total</th>
                      <th className="p-3 text-center">{language === 'es' ? 'Detalle' : 'Detail'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filtered.map((row, idx) => {
                      const logRowId = row.id || `${row.created_at}-${idx}`;
                      const isExpanded = expandedLogId === logRowId;
                      return (
                        <React.Fragment key={logRowId}>
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-slate-500 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(row.action_type)}`}>
                                {translateActionType(row.action_type, language)}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-semibold text-slate-700">{row.target_id || '—'}</td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{row.customer_name || '—'}</div>
                              {(row.customer_email || row.customer_phone) && (
                                <div className="text-[10px] text-slate-400 mt-0.5 flex flex-col gap-0.5">
                                  {row.customer_email && <span>{row.customer_email}</span>}
                                  {row.customer_phone && <span>{row.customer_phone}</span>}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="text-slate-700">{row.product_name || '—'}</div>
                              {row.page_number !== null && row.page_number !== undefined && (
                                <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                  {language === 'es' ? 'Pág. ' : 'Pg. '}{row.page_number}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-900 tabular-nums">
                              {row.total !== undefined && row.total !== 0 ? `${row.total.toFixed(2)}€` : '—'}
                              {row.payment_method && (
                                <div className="text-[9px] text-slate-400 font-normal mt-0.5">
                                  {row.payment_method} · {row.payment_status || (row.is_paid ? 'Pagado' : 'Pendiente')}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setExpandedLogId(isExpanded ? null : logRowId)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-semibold rounded text-[10px] cursor-pointer transition-all border border-slate-200"
                              >
                                {isExpanded ? (language === 'es' ? 'Ocultar' : 'Hide') : (language === 'es' ? 'Ver' : 'Show')}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan="7" className="p-3 bg-slate-50/50">
                                <div className="flex flex-col gap-1">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    {language === 'es' ? 'Metadatos Completos del Evento (Respaldo de Seguridad):' : 'Complete Event Metadata (Safety Fallback):'}
                                  </div>
                                  <pre className="text-left bg-slate-900 text-slate-100 p-4 rounded-xl text-[10px] font-mono overflow-auto max-h-60 shadow-inner">
                                    {(() => {
                                      let parsed = row.details;
                                      if (typeof parsed === 'string') {
                                        try { parsed = JSON.parse(parsed); } catch (e) {}
                                      }
                                      const hasDetails = parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0;
                                      return JSON.stringify(hasDetails ? parsed : row, null, 2);
                                    })()}
                                  </pre>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Translation Helpers for logs in configuration ---
function translateActionType(type, lang) {
  const isEs = lang === 'es';
  switch (type) {
    case 'create_invoice':
      return isEs ? 'Crear Factura' : 'Create Invoice';
    case 'create_invoice_with_reservation':
      return isEs ? 'Reserva con Factura' : 'Reserve with Invoice';
    case 'pay_invoice':
      return isEs ? 'Pagar Factura' : 'Pay Invoice';
    case 'unpay_invoice':
      return isEs ? 'Desmarcar Pago Factura' : 'Unpay Invoice';
    case 'send_invoice_email':
      return isEs ? 'Enviar Email Factura' : 'Send Invoice Email';
    case 'send_recibo_email':
      return isEs ? 'Enviar Email Recibo' : 'Send Receipt Email';
    case 'send_reservation_email':
      return isEs ? 'Enviar Email Reserva' : 'Send Reservation Email';
    case 'send_prereservation_email':
      return isEs ? 'Enviar Email Pre-reserva' : 'Send Pre-reservation Email';
    case 'cancel_invoice':
      return isEs ? 'Cancelar Factura' : 'Cancel Invoice';
    case 'create_refund_invoice':
      return isEs ? 'Crear Factura de Abono' : 'Create Refund Invoice';
    case 'delete_invoice':
      return isEs ? 'Papelera Factura' : 'Delete Invoice';
    case 'hard_delete_invoice':
      return isEs ? 'Eliminar Factura Permanentemente' : 'Hard Delete Invoice';
    case 'reserve_invoice_number':
      return isEs ? 'Reservar Número de Factura' : 'Reserve Invoice Number';
    case 'create_order':
      return isEs ? 'Crear Pedido de Transferencia' : 'Create Order';
    case 'pre_reserve_ad':
      return isEs ? 'Crear Pre-reserva' : 'Pre-reserve Space';
    case 'delete_order':
      return isEs ? 'Eliminar Pedido' : 'Delete Order';
    case 'update_order':
      return isEs ? 'Actualizar Pedido' : 'Update Order';
    case 'create_recibo':
      return isEs ? 'Crear Recibo' : 'Create Receipt';
    case 'delete_recibo':
      return isEs ? 'Eliminar Recibo' : 'Delete Receipt';
    default:
      return type;
  }
}

function getActionBadgeColor(actionType) {
  if (actionType.includes('create') || actionType.includes('reserve')) {
    return 'bg-blue-50 text-blue-700 border-blue-100';
  }
  if (actionType.includes('pay') || actionType.includes('confirm')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
  if (actionType.includes('cancel') || actionType.includes('delete') || actionType.includes('liberate')) {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  if (actionType.includes('send') || actionType.includes('email')) {
    return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  }
  return 'bg-slate-50 text-slate-700 border-slate-100';
}

function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

export default SettingsPanel;
