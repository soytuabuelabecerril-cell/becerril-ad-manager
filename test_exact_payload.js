

// Mock implementations from src/components/ReservationPanel.jsx
const getEmailHtml = (title, content) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .header {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          padding: 32px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
          margin: 0;
        }
        .content {
          padding: 32px;
          color: #334155;
          line-height: 1.6;
          font-size: 15px;
        }
        .content p {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .footer {
          background-color: #f1f5f9;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0; color:#ffffff;">Revista de Fiestas Patronales Becerril de la Sierra 2026</h1>
        </div>
        <div class="content">
          <h2 style="color: #0f172a; font-size: 18px; font-weight: 600; margin-top: 0; margin-bottom: 16px;">${title}</h2>
          ${content}
        </div>
        <div class="footer">
          <p style="margin:0;">Este es un correo automático de Revista de Fiestas Patronales Becerril de la Sierra 2026.</p>
          <p style="margin:4px 0 0 0;">I am your granny S.L. &bull; &copy; 2026 Revista de Fiestas Patronales Becerril de la Sierra 2026. Todos los derechos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getFormattedHtmlContent = (bodyText) => {
  const clean = bodyText.replace(/\\n/g, '\n');
  const lines = clean.split('\n');
  let html = '';
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html += '<ul style="margin: 16px 0; padding-left: 20px; color: #334155; font-size: 15px; line-height: 1.6;">';
        inList = true;
      }
      const itemText = trimmed.substring(2);
      const parts = itemText.split(':');
      if (parts.length > 1) {
        const label = parts[0];
        const value = parts.slice(1).join(':');
        html += `<li style="margin-bottom: 8px;"><strong>${label}:</strong>${value}</li>`;
      } else {
        html += `<li style="margin-bottom: 8px;">${itemText}</li>`;
      }
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      if (trimmed) {
        if (trimmed.toLowerCase().includes('nota:') || trimmed.toLowerCase().includes('importante:')) {
          html += `<p style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; color: #c2410c; border-radius: 6px; font-weight: 500; margin: 16px 0;">${trimmed}</p>`;
        } else {
          html += `<p style="margin-bottom: 16px;">${trimmed}</p>`;
        }
      } else {
        html += '<div style="height: 8px;"></div>';
      }
    }
  });

  if (inList) {
    html += '</ul>';
  }
  return html;
};

// Implementations from src/utils/notifications.js
const formatTemplate = (templateBody, variables) => {
  if (!templateBody) return '';
  let result = templateBody;
  Object.entries(variables).forEach(([key, val]) => {
    const placeholder = `{${key}}`;
    result = result.split(placeholder).join(val !== undefined && val !== null ? val : '');
  });
  return result;
};

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

const getTemplateVariables = (details, language) => {
  const isEs = language === 'es';
  const priceVal = parseFloat(details.price || 0);
  const designPriceVal = parseFloat(details.designPrice || details.design_price || 0);
  const vatVal = parseFloat(details.vat || (priceVal + designPriceVal) * 0.21);
  const subtotalVal = priceVal + designPriceVal;
  const totalVal = parseFloat(details.total || (subtotalVal + vatVal));
  
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
    productAbbreviation: getProductAbbreviation(details.productName || details.product_name || '')
  };
};

// Main test logic
async function run() {
  const details = {
    id: 'ORD-430535',
    customerName: 'aaaa',
    productName: '⅓ tercio faldón',
    price: 50,
    designPrice: 0,
    assignedPage: 6,
    date: '05/06/2026',
    artworkComment: 'usaremos el mismo arte final del año pasado (2025)',
    orderType: 'pre-reserved',
    paymentMethod: 'Transfer',
    customerEmail: 'marc.truekalia@gmail.com',
    customerPhone: '619220077'
  };

  const language = 'es';
  const isPreReservation = true;

  // Let's use database template or default fallback
  const tObj = {
    subject: 'Pre-Reserva Revista Becerril: Pág. {assignedPage}',
    body: 'Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista Becerril:\n\n- Producto: {productName}\n- Página Asignada: {assignedPage}\n- Comentarios de Arte/Diseño: {artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nGracias,\nEquipo Revista Becerril'
  };

  const vars = getTemplateVariables(details, language);
  const subject = formatTemplate(tObj.subject, vars);
  const text = formatTemplate(tObj.body, vars);

  const cleanSubject = subject.replace(/\\n/g, ' ');
  const cleanText = text.replace(/\\n/g, '\n');
  const html = getEmailHtml(cleanSubject, getFormattedHtmlContent(text));

  const payload = {
    to: details.customerEmail,
    subject: cleanSubject,
    text: cleanText,
    html,
    background: true
  };

  const url = 'https://becerril-ad-manager.vercel.app/api/send-email';

  try {
    console.log('Sending exact payload to live server...');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Fetch error:', error);
  }
}

run();
