/**
 * Generates a WhatsApp deep link to send to the client.
 */
export const generateWhatsAppLink = (phoneNumber, customerName, pageNumber, invoiceUrl) => {
  const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
  const message = `Hola ${customerName}! 🌟\n\nTu reserva para la página ${pageNumber} en la revista "Becerril" ha sido registrada.\n\nPuedes descargar tu nota de reserva aquí: ${invoiceUrl}\n\n¡Gracias por confiar en "I AM YOUR GRANNY S.L."!`;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};

/**
 * Mock function to simulate triggering an email edge function
 */
export const triggerEmailNotification = async (email, invoiceUrl) => {
  console.log(`[Mock] Sending email to ${email} with invoice link: ${invoiceUrl}`);
  return { success: true, message: "Email sent successfully" };
};

/**
 * Get product abbreviation for WhatsApp summaries
 */
const getProductAbbreviation = (productName) => {
  if (!productName) return '';
  const lower = productName.toLowerCase();
  if (lower.includes('dos tercios') || lower.includes('⅔') || lower.includes('2/3')) {
    return '2T';
  }
  if (lower.includes('tercio') || lower.includes('⅓') || lower.includes('1/3')) {
    return 'T';
  }
  if (lower.includes('página completa') || lower.includes('pagina completa') || lower.includes('contraportada') || lower.includes('portada')) {
    return 'PC';
  }
  return productName.split(' ').slice(0, 3).join(' ');
};

/**
 * Substitute variables in template bodies/subjects
 */
export const formatTemplate = (templateBody, variables) => {
  if (!templateBody) return '';
  let result = templateBody;
  Object.entries(variables).forEach(([key, val]) => {
    const placeholder = `{${key}}`;
    result = result.split(placeholder).join(val !== undefined && val !== null ? val : '');
  });
  return result;
};

/**
 * Build template variables object for substitution
 */
export const getTemplateVariables = (details, language) => {
  const isEs = language === 'es';
  const priceVal = parseFloat(details.price || 0);
  const designPriceVal = parseFloat(details.designPrice || details.design_price || 0);
  const vatVal = parseFloat(details.vat || (priceVal + designPriceVal) * 0.21);
  const subtotalVal = priceVal + designPriceVal;
  const totalVal = parseFloat(details.total || (subtotalVal + vatVal));
  
  // Format designPrice as a block line if greater than zero
  const designPriceLine = designPriceVal > 0 
    ? (isEs 
        ? `- Precio Diseño: ${designPriceVal.toFixed(2)}€\n` 
        : `- Design Price: ${designPriceVal.toFixed(2)}€\n`)
    : '';

  const paymentMethodLabel = details.paymentMethod 
    ? (isEs 
        ? (details.paymentMethod.toLowerCase() === 'transfer' ? 'Transferencia' : details.paymentMethod) 
        : details.paymentMethod)
    : '';

  const isPaid = details.isPaid !== undefined ? details.isPaid : (details.is_paid !== undefined ? details.is_paid : false);

  return {
    id: details.id || '',
    customerName: details.customerName || details.customer_name || '',
    productName: details.productName || details.product_name || '',
    assignedPage: details.assignedPage || details.assigned_page || 'Unassigned',
    price: priceVal.toFixed(2),
    designPrice: designPriceLine,
    designPriceValue: designPriceVal.toFixed(2),
    subtotal: subtotalVal.toFixed(2),
    vat: vatVal.toFixed(2),
    total: totalVal.toFixed(2),
    paymentMethod: paymentMethodLabel,
    artworkComment: details.artworkComment || details.artwork_comment || '-',
    productAbbreviation: getProductAbbreviation(details.productName || details.product_name || ''),
    isPaid
  };
};

/**
 * Generates a beautiful, responsive HTML email for invoices and confirmation of payments.
 */
export const getHtmlEmailTemplate = (vars) => {
  const isPaid = vars.isPaid;
  const designPriceVal = parseFloat(vars.designPriceValue || 0);
  const designRow = designPriceVal > 0 
    ? `<tr>
        <td align="left" style="padding: 6px 0; font-size: 14px; color: #64748b;">Precio Diseño</td>
        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${vars.designPriceValue}€</td>
       </tr>`
    : '';

  const paymentStatusLabel = isPaid ? 'Pagado' : 'Pendiente de Pago';
  const paymentStatusColor = isPaid ? '#065f46' : '#9a3412';
  const paymentStatusBg = isPaid ? '#ecfdf5' : '#fff7ed';
  const paymentStatusBorder = isPaid ? '#a7f3d0' : '#ffedd5';
  const paymentStatusIcon = isPaid ? '✓' : '⏳';

  const introText = isPaid
    ? `Le confirmamos que hemos recibido correctamente el pago y adjuntamos los detalles de la factura correspondiente a su anuncio en la <strong>Revista de Fiestas Patronales Becerril de la Sierra 2026</strong>:`
    : `Le enviamos los detalles de la factura correspondiente a su reserva para su anuncio en la <strong>Revista de Fiestas Patronales Becerril de la Sierra 2026</strong>. Por favor, realice el pago correspondiente mediante transferencia bancaria.`;

  const totalLabel = isPaid ? 'Total Pagado' : 'Total Facturado';
  const totalColor = isPaid ? '#10b981' : '#2563eb';

  const bankTransferSection = !isPaid
    ? `
              <!-- Bank details if pending payment -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; margin-bottom: 12px;">
                <tr>
                  <td style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 20px;">🏦</td>
                        <td valign="middle" style="padding-left: 8px;">
                          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #1e40af; letter-spacing: 0.5px; margin-bottom: 4px;">Instrucciones de Pago</span>
                          <span style="display: block; font-size: 13px; color: #1e3a8a; margin-bottom: 4px; line-height: 1.4;">
                            Realice la transferencia bancaria utilizando los siguientes datos:
                          </span>
                          <span style="display: block; font-size: 14px; color: #1e3a8a; margin-bottom: 2px; line-height: 1.4;">
                            <strong>IBAN:</strong> <span style="font-family: monospace; font-weight: 750; background-color: #dbeafe; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px;">ES06 0049 2246 8122 1400 8717</span>
                          </span>
                          <span style="display: block; font-size: 14px; color: #1e3a8a; line-height: 1.4;">
                            <strong>Concepto/Ref:</strong> <span style="font-family: monospace; font-weight: 750; background-color: #dbeafe; padding: 2px 6px; border-radius: 4px;">${vars.id}</span>
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
      `
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isPaid ? 'Confirmación de Pago y Factura' : 'Factura de Reserva'} - Revista de Fiestas Patronales Becerril de la Sierra 2026</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a, span { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse !important; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media screen and (max-width: 600px) {
      .email-wrapper { padding: 10px !important; }
      .email-container { width: 100% !important; max-width: 100% !important; }
      .card-body { padding: 24px 16px !important; }
      .column-split { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .column-split-gap { height: 16px !important; }
      .price-breakdown { width: 100% !important; }
      .header-title { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    ${isPaid ? 'Confirmación de pago recibida.' : 'Nueva factura de reserva emitida.'} Adjuntamos los detalles correspondientes a su factura ${vars.id} para su anuncio en Revista de Fiestas Patronales Becerril de la Sierra 2026.
  </div>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; table-layout: fixed;">
    <tr>
      <td align="center" valign="top" class="email-wrapper" style="padding: 40px 20px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td align="center" valign="middle" style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 32px; border-bottom: 4px solid ${isPaid ? '#10b981' : '#3b82f6'};">
              <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                <tr>
                  <td align="center" valign="middle" style="background-color: ${isPaid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; border: 1px solid ${isPaid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}; border-radius: 12px; height: 48px; width: 48px;">
                    <span style="font-size: 24px; line-height: 48px; color: ${isPaid ? '#10b981' : '#3b82f6'};">${paymentStatusIcon}</span>
                  </td>
                </tr>
              </table>
              <h1 class="header-title" style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">Revista de Fiestas Patronales Becerril de la Sierra 2026</h1>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">${isPaid ? 'CONFIRMACIÓN DE PAGO' : 'FACTURA EMITIDA'}</p>
            </td>
          </tr>
          <tr>
            <td align="left" valign="top" class="card-body" style="padding: 40px 32px; background-color: #ffffff;">
              <p style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Hola ${vars.customerName},</p>
              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 24px; color: #475569;">
                ${introText}
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td style="background-color: ${paymentStatusBg}; border: 1px solid ${paymentStatusBorder}; border-radius: 8px; padding: 16px 20px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="36" valign="top" style="font-size: 20px; line-height: 20px;">💵</td>
                        <td valign="middle" style="padding-left: 8px;">
                          <span style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: ${paymentStatusColor}; letter-spacing: 0.5px; margin-bottom: 2px;">Método de Pago</span>
                          <span style="font-size: 16px; font-weight: 700; color: ${paymentStatusColor};">${vars.paymentMethod || 'Transferencia'} (${paymentStatusLabel})</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              ${bankTransferSection}

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                <tr>
                  <td valign="top" class="column-split" width="260" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Número de Factura</span>
                    <span style="font-size: 16px; font-weight: 700; color: #0f172a;">#${vars.id}</span>
                  </td>
                  <td class="column-split-gap" width="16" style="font-size: 1px; line-height: 1px;">&nbsp;</td>
                  <td valign="top" class="column-split" width="260" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Página Asignada</span>
                    <span style="font-size: 16px; font-weight: 700; color: #0f172a;">Página ${vars.assignedPage}</span>
                  </td>
                </tr>
              </table>
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Resumen del Anuncio</h3>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 32px;">
                <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                  <th align="left" style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569;">Descripción</th>
                  <th align="right" style="padding: 12px 16px; font-size: 12px; font-weight: 700; color: #475569; width: 100px;">Importe</th>
                </tr>
                <tr>
                  <td align="left" valign="top" style="padding: 16px; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${vars.productName}</div>
                    <div style="font-size: 12px; color: #64748b;">Ubicación: Página ${vars.assignedPage} – Revista de Fiestas Patronales Becerril de la Sierra 2026</div>
                  </td>
                  <td align="right" valign="top" style="padding: 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; color: #0f172a;">
                    ${vars.price}€
                  </td>
                </tr>
              </table>
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="right" valign="top">
                    <table border="0" cellpadding="0" cellspacing="0" class="price-breakdown" width="280">
                      <tr>
                        <td align="left" style="padding: 6px 0; font-size: 14px; color: #64748b;">Precio Base</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${vars.price}€</td>
                      </tr>
                      ${designRow}
                      <tr>
                        <td align="left" style="padding: 6px 0; font-size: 14px; color: #64748b;">Subtotal</td>
                        <td align="right" style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #0f172a;">${vars.subtotal}€</td>
                      </tr>
                      <tr>
                        <td align="left" style="padding: 6px 0 12px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">IVA (21%)</td>
                        <td align="right" style="padding: 6px 0 12px 0; font-size: 14px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${vars.vat}€</td>
                      </tr>
                      <tr>
                        <td align="left" style="padding: 16px 0 8px 0; font-size: 16px; font-weight: 700; color: #0f172a;">${totalLabel}</td>
                        <td align="right" style="padding: 16px 0 8px 0; font-size: 20px; font-weight: 800; color: ${totalColor};">${vars.total}€</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${vars.artworkComment && vars.artworkComment !== '-' ? `
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 6px;">Nota sobre el arte/diseño</span>
                    <span style="font-size: 13px; line-height: 18px; color: #475569;">${vars.artworkComment}</span>
                  </td>
                </tr>
              </table>
              ` : ''}
              <!-- Warning Banner -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px;">
                <tr>
                  <td style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; border-radius: 8px; padding: 16px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b45309; letter-spacing: 0.5px; margin-bottom: 6px;">⚠️ AVISO SOBRE LA UBICACIÓN DE SU ANUNCIO</span>
                    <span style="font-size: 13px; line-height: 1.5; color: #92400e; display: block;">
                      La ubicación exacta de su anuncio se puede ver afectada si se hace una ampliación de páginas. "Tenga en cuenta que la posición de su anuncio puede desplazarse al añadir más páginas. Garantizamos que conservará el mismo tipo de página (par o impar) y le enviaremos una notificación por email ante cualquier cambio que pudiera producirse."
                    </span>
                  </td>
                </tr>
              </table>

              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 32px; margin-bottom: 32px;">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; font-size: 15px; color: #475569;">Gracias,</p>
              <p style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">Equipo de Coordinación Publicitaria</p>
            </td>
          </tr>
          <tr>
            <td align="center" valign="top" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 32px 32px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #475569;">¿Tiene alguna consulta sobre el diseño o el arte?</p>
              <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 20px; color: #64748b;">
                Por favor, responda a este correo electrónico o escríbanos directamente para que podamos asistirle con el diseño de su anuncio.
              </p>
              <table border="0" cellpadding="0" cellspacing="0" width="80" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-top: 2px solid #cbd5e1; font-size: 1px; line-height: 1px;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 11px; line-height: 18px; color: #94a3b8;">
                Este es un mensaje automático de confirmación de pago y facturación.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                I am your granny S.L. &bull; &copy; 2026 Revista de Fiestas Patronales Becerril de la Sierra 2026. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

