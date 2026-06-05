import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../context/LanguageContext';
import { formatTemplate, getTemplateVariables } from '../utils/notifications';
import { Mail, MessageCircle, Save, RotateCcw, FileText, Sparkles, Info, Check } from 'lucide-react';

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

const appsScriptCode = `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById("1BhC7XuASyIXW4PrCU1HOWOJ9rvWpaoCCfqVIr2XVAK0");
    
    // 1. Write Reservations Ledger Sheet
    let sheetLedger = ss.getSheetByName("Libro de Reservas");
    if (!sheetLedger) {
      sheetLedger = ss.insertSheet("Libro de Reservas");
    } else {
      sheetLedger.clear();
    }
    
    const ledgerHeaders = [
      'Página', 
      'Tipo de Reserva', 
      'Cliente', 
      'ID Factura / Recibo', 
      'Importe Recibido (€)', 
      'Importe Pendiente (€)', 
      'Método de Pago', 
      'Estado'
    ];
    sheetLedger.appendRow(ledgerHeaders);
    
    if (data.ledger && data.ledger.length > 0) {
      const ledgerRows = data.ledger.map(row => [
        row['Página'],
        row['Tipo de Reserva'],
        row['Cliente'],
        row['ID Factura / Recibo'],
        row['Importe Recibido (€)'],
        row['Importe Pendiente (€)'],
        row['Método de Pago'],
        row['Estado']
      ]);
      sheetLedger.getRange(2, 1, ledgerRows.length, ledgerHeaders.length).setValues(ledgerRows);
      sheetLedger.autoResizeColumns(1, ledgerHeaders.length);
    }
    
    // 2. Write Cash Transactions without VAT Sheet
    let sheetCash = ss.getSheetByName("Efectivo sin IVA");
    if (!sheetCash) {
      sheetCash = ss.insertSheet("Efectivo sin IVA");
    } else {
      sheetCash.clear();
    }
    
    const cashHeaders = [
      'ID Recibo', 
      'Fecha', 
      'Cliente', 
      'Producto', 
      'Página Asignada', 
      'Importe Cobrado (Sin IVA) (€)', 
      'Método de Pago', 
      'Estado'
    ];
    sheetCash.appendRow(cashHeaders);
    
    if (data.cash && data.cash.length > 0) {
      const cashRows = data.cash.map(row => [
        row['ID Recibo'],
        row['Fecha'],
        row['Cliente'],
        row['Producto'],
        row['Página Asignada'],
        row['Importe Cobrado (Sin IVA) (€)'],
        row['Método de Pago'],
        row['Estado']
      ]);
      sheetCash.getRange(2, 1, cashRows.length, cashHeaders.length).setValues(cashRows);
      sheetCash.autoResizeColumns(1, cashHeaders.length);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

const SettingsPanel = () => {
  const { t, language } = useLanguage();
  const { templates, saveCommunicationTemplate } = useDatabase();

  const [activeChannel, setActiveChannel] = useState('email'); // 'email' | 'whatsapp'
  const [selectedTemplateId, setSelectedTemplateId] = useState('invoice_email');
  
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  
  const [sheetsUrl, setSheetsUrl] = useState(() => localStorage.getItem('google_sheets_sync_url') || '');
  const [sheetsSaveAlert, setSheetsSaveAlert] = useState(false);
  
  const [activeField, setActiveField] = useState('body'); // 'subject' | 'body'

  const handleSaveSheetsUrl = () => {
    localStorage.setItem('google_sheets_sync_url', sheetsUrl);
    setSheetsSaveAlert(true);
    setTimeout(() => setSheetsSaveAlert(false), 3000);
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

      {/* Google Sheets Sync Configuration */}
      <div className="mt-8 pt-6 border-t border-slate-100">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-emerald-600" size={20} />
          {t('config_google_sheets_title')}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{t('config_google_sheets_desc')}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Form Config */}
          <div className="lg:col-span-1 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {t('config_google_sheets_url')}
              </label>
              <input
                type="text"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                placeholder="https://script.google.com/macros/s/.../exec"
              />
            </div>

            <button
              onClick={handleSaveSheetsUrl}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-lg text-sm transition-all cursor-pointer shadow-sm self-start flex items-center gap-1.5"
            >
              <Save size={14} />
              {t('config_google_sheets_save')}
            </button>

            {sheetsSaveAlert && (
              <p className="text-xs font-medium text-emerald-600 mt-1">
                {t('config_google_sheets_saved')}
              </p>
            )}
          </div>

          {/* Instructions Code Block */}
          <div className="lg:col-span-2 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Instrucciones de Configuración (Google Apps Script)
            </h4>
            <ol className="text-xs text-slate-600 list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>Abre el documento de Google Sheets (haz clic en "Abrir Google Sheet" desde el panel o visita <a href="https://docs.google.com/spreadsheets/d/1BhC7XuASyIXW4PrCU1HOWOJ9rvWpaoCCfqVIr2XVAK0/edit" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline">este enlace</a>).</li>
              <li>Ve al menú superior <b>Extensiones</b> → <b>Apps Script</b>.</li>
              <li>Borra todo el contenido existente y pega el código proporcionado a continuación.</li>
              <li>Haz clic en el botón <b>Implementar</b> (esquina superior derecha) → <b>Nueva implementación</b>.</li>
              <li>Selecciona el tipo: <b>Aplicación web</b>.</li>
              <li>Configura: "Ejecutar como: <b>Yo</b>" y "Quién tiene acceso: <b>Cualquiera</b>" (importante).</li>
              <li>Haz clic en <b>Implementar</b>, otorga los permisos requeridos de Google, copia la <b>URL de la aplicación web</b> y pégala en el campo de la izquierda.</li>
            </ol>

            <div className="relative mt-2">
              <textarea
                readOnly
                value={appsScriptCode}
                rows={10}
                className="w-full bg-slate-900 text-slate-200 text-[11px] font-mono rounded-lg p-3 outline-none resize-none leading-relaxed border border-slate-800"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(appsScriptCode);
                  alert("Código copiado al portapapeles");
                }}
                className="absolute top-2.5 right-2.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded text-[10px] font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Copiar Código
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
