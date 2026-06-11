import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';


const PRODUCTS = [
  { id: 1, name: 'Página completa libre adjudicación', price: 125, requiredSlots: ['top', 'middle', 'bottom'] },
  { id: 2, name: '1 Página completa par', price: 125, requiredSlots: ['top', 'middle', 'bottom'] },
  { id: 3, name: '1 Página completa impar', price: 125, requiredSlots: ['top', 'middle', 'bottom'] },
  { id: 4, name: '⅓ tercio libre adjudicación', price: 50, requiredSlots: ['any_1'] },
  { id: 5, name: '⅓ tercio superior', price: 50, requiredSlots: ['top'] },
  { id: 6, name: '⅓ tercio medio', price: 50, requiredSlots: ['middle'] },
  { id: 7, name: '⅓ tercio faldón', price: 50, requiredSlots: ['bottom'] },
  { id: 8, name: '⅔ dos tercios superior', price: 100, requiredSlots: ['top', 'middle'] },
  { id: 9, name: '⅔ dos tercios bajo', price: 100, requiredSlots: ['middle', 'bottom'] },
  { id: 10, name: 'Contraportada', price: 180, requiredSlots: ['top', 'middle', 'bottom'] },
  { id: 11, name: 'Interior Portada', price: 180, requiredSlots: ['top', 'middle', 'bottom'] },
  { id: 12, name: 'Interior Contraportada', price: 180, requiredSlots: ['top', 'middle', 'bottom'] }
];

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    sessionToken,
    customerId,
    pageNumber,
    productId,
    artworkOption,
    designWorkOption,
    designWorkPrice,
    paymentMethod // 'Transfer' or 'Pre-reserved'
  } = req.body;

  if (!sessionToken || !customerId || !pageNumber || !productId || !artworkOption || !paymentMethod) {
    return res.status(400).json({ error: 'Faltan parámetros obligatorios.' });
  }

  if (paymentMethod !== 'Transfer' && paymentMethod !== 'Pre-reserved') {
    return res.status(400).json({ error: 'Método de pago no permitido. Solo se permiten Transferencia y Pre-reserva.' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase keys not set' });
  }

  // 1. Verify session token
  try {
    const [hash, expires] = sessionToken.split('.');
    if (!hash || !expires) {
      return res.status(401).json({ error: 'Sesión no válida. Por favor, inicie sesión nuevamente.' });
    }

    if (Date.now() > parseInt(expires, 10)) {
      return res.status(401).json({ error: 'Su sesión ha caducado. Por favor, vuelva a verificar su negocio.' });
    }

    const dataToSign = `${customerId}|${expires}`;
    const expectedHash = crypto.createHmac('sha256', serviceKey).update(dataToSign).digest('hex');

    if (hash !== expectedHash) {
      return res.status(401).json({ error: 'Sesión no autorizada.' });
    }
  } catch (err) {
    console.error('Session verify failed:', err);
    return res.status(401).json({ error: 'Error de autenticación.' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 2. Fetch customer
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (custErr) throw custErr;
    if (!customer) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    // 3. Fetch product details
    const targetProduct = PRODUCTS.find(p => p.id === parseInt(productId, 10));
    if (!targetProduct) {
      return res.status(400).json({ error: 'Producto publicitario no válido.' });
    }

    // 4. Verify page capacity server-side
    if (pageNumber === 91 || pageNumber === 92) {
      return res.status(400).json({ error: 'Las páginas de contraportada (91 y 92) no están disponibles para reservas de usuarios externos.' });
    }

    const { data: existingAds, error: adsErr } = await supabase
      .from('ad_reservations')
      .select('*')
      .eq('page_number', pageNumber);

    if (adsErr) throw adsErr;

    // Helper to generate fake reservations deterministically (~35% occupancy)
    const getFakeReservationForPage = (pageNum) => {
      if (pageNum === 1 || pageNum === 2 || pageNum === 91 || pageNum === 92) {
        return null;
      }
      const hash = (pageNum * 17) % 100;
      if (hash >= 35) {
        return null;
      }
      let adType = 'Página completa libre adjudicación';
      if (hash < 12) {
        adType = '⅓ tercio libre adjudicación';
      } else if (hash < 24) {
        adType = '⅔ dos tercios superior';
      }
      return { ad_type: adType };
    };

    const allAdsForCapacity = [...existingAds];
    const fakeAd = getFakeReservationForPage(pageNumber);
    if (fakeAd) {
      allAdsForCapacity.push(fakeAd);
    }

    const filledSlots = new Set();
    let hasAny1 = false;
    allAdsForCapacity.forEach(ad => {
      const p = PRODUCTS.find(prod => prod.name === ad.ad_type);
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

    if (hasAny1) {
      if (!filledSlots.has('top')) filledSlots.add('top');
      else if (!filledSlots.has('middle')) filledSlots.add('middle');
      else if (!filledSlots.has('bottom')) filledSlots.add('bottom');
    }

    const availableSlots = new Set(['top', 'middle', 'bottom']);
    filledSlots.forEach(s => availableSlots.delete(s));

    let fits = false;
    if (targetProduct.requiredSlots.includes('any_1')) {
      fits = availableSlots.size >= 1;
    } else {
      fits = targetProduct.requiredSlots.every(slot => availableSlots.has(slot));
    }

    if (!fits) {
      return res.status(400).json({ error: 'La página seleccionada ya no tiene suficiente espacio disponible.' });
    }

    // 5. Build order details
    const orderId = 'ORD-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const basePrice = parseFloat(targetProduct.price);
    const finalDesignPrice = (artworkOption === '3' && designWorkOption === '1') ? parseFloat(designWorkPrice) || 0 : 0;
    const subtotal = basePrice + finalDesignPrice;
    const vat = subtotal * 0.21;
    const total = subtotal + vat;

    let artworkComment = '';
    if (artworkOption === '1') artworkComment = 'usaremos el mismo arte final del año pasado (2025)';
    else if (artworkOption === '2') artworkComment = 'por favor envíanos el arte visual al correo: hola@yosoytuabuela.com';
    else if (artworkOption === '3') {
      if (designWorkOption === '1') artworkComment = 'elaboraremos el arte final para ti (Diseño y arte final).';
      else if (designWorkOption === '2') artworkComment = 'elaboraremos el arte final para ti (Sin coste).';
      else if (designWorkOption === '3') artworkComment = 'elaboraremos el arte final para ti (un vale en el establecimiento).';
      else artworkComment = 'por favor contactar para servicios de diseño y publicidad.';
    }

    // Insert Order
    const newOrder = {
      id: orderId,
      status: 'Pending',
      is_paid: false,
      payment_method: 'Transfer',
      customer_name: customer.commercial_name || customer.fiscal_name,
      product_name: targetProduct.name,
      price: basePrice,
      design_price: finalDesignPrice,
      assigned_page: pageNumber,
      artwork_comment: artworkComment,
      order_type: paymentMethod === 'Pre-reserved' ? 'pre-reserved' : 'transfer',
      customer_email: customer.email,
      customer_phone: customer.whatsapp
    };

    const { error: ordErr } = await supabase
      .from('orders')
      .insert([newOrder]);

    if (ordErr) throw ordErr;

    // Insert Ad Reservation
    const adDetails = {
      page_number: pageNumber,
      customer_id: customer.id,
      customer_name: customer.commercial_name || customer.fiscal_name,
      ad_type: targetProduct.name,
      is_pre_reserved: paymentMethod === 'Pre-reserved',
      expires_at: paymentMethod === 'Pre-reserved' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
      artwork_option: artworkOption,
      design_work_option: designWorkOption || null,
      design_work_price: finalDesignPrice,
      is_new: true,
      is_paid: false,
      payment_method: 'Transfer'
    };

    const { error: adErr } = await supabase
      .from('ad_reservations')
      .insert([adDetails]);

    if (adErr) throw adErr;

    // 6. Log action in system
    const logData = {
      action_type: paymentMethod === 'Pre-reserved' ? 'public_prereserve' : 'public_reserve',
      target_id: orderId,
      customer_name: customer.commercial_name || customer.fiscal_name,
      customer_email: customer.email,
      customer_phone: customer.whatsapp,
      product_name: targetProduct.name,
      page_number: pageNumber,
      price: basePrice,
      design_price: finalDesignPrice,
      vat: vat,
      total: total,
      payment_method: 'Transfer',
      is_paid: false,
      payment_status: 'Pending',
      details: { via: 'public_portal', artworkComment, artworkOption, designWorkOption },
      created_at: new Date().toISOString()
    };
    try {
      await supabase.from('action_logs').insert([logData]);
    } catch (e) {
      console.error('Failed to log public action:', e);
    }

    // 7. Send confirmation email
    const templateId = paymentMethod === 'Pre-reserved' ? 'order_prereservation_email' : 'order_reservation_email';
    const { data: template } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    const vars = {
      id: orderId,
      customerName: customer.commercial_name || customer.fiscal_name,
      productName: targetProduct.name,
      assignedPage: pageNumber,
      paymentMethod: paymentMethod === 'Pre-reserved' ? 'Pre-reserva (temporal 1 semana)' : 'Transferencia Bancaria',
      price: basePrice.toFixed(2),
      designPrice: finalDesignPrice > 0 ? `\n- Precio Diseño: ${finalDesignPrice.toFixed(2)}€` : '',
      subtotal: subtotal.toFixed(2),
      vat: vat.toFixed(2),
      total: total.toFixed(2),
      artworkComment: artworkComment
    };

    const formatTemplate = (text, variables) => {
      let result = text;
      Object.keys(variables).forEach(k => {
        result = result.replace(new RegExp(`{${k}}`, 'g'), variables[k]);
      });
      return result;
    };

    let emailSubject = '';
    let emailBody = '';
    if (template) {
      emailSubject = formatTemplate(template.subject || '', vars);
      emailBody = formatTemplate(template.body || '', vars);
    } else {
      if (paymentMethod === 'Pre-reserved') {
        emailSubject = `Pre-Reserva Revista Becerril: Pág. ${pageNumber}`;
        emailBody = `Hola,\n\nConfirmamos la pre-reserva (retención de 1 semana) del espacio publicitario en la Revista Becerril:\n\n- Producto: ${targetProduct.name}\n- Página Asignada: ${pageNumber}\n- Comentarios de Arte/Diseño: ${artworkComment}\n\nNota: Esta reserva es temporal y vencerá en una semana si no se confirma el pago.\n\nFORMA de PAGO: TRANSFERENCIA a IBAN: ES0600492246812214008717   / REFERENCIA PAGO: ${targetProduct.name}\n\nGracias,\nEquipo Revista Becerril`;
      } else {
        emailSubject = `Confirmación de Reserva Revista Becerril: Pág. ${pageNumber}`;
        emailBody = `Hola,\n\nConfirmamos la reserva del espacio publicitario en la Revista Becerril:\n\n- Producto: ${targetProduct.name}\n- Página Asignada: ${pageNumber}\n- Método de Pago: Transferencia\n- Comentarios de Arte/Diseño: ${artworkComment}\n\nLa factura correspondiente se generará una vez confirmado el pago.\n\nGracias,\nEquipo Revista Becerril`;
      }
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (resendApiKey && customer.email) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
      const cleanText = emailBody.replace(/\\n/g, '\n');
      
      const getFormattedHtmlContent = (bodyText) => {
        return bodyText.split('\n').map(line => {
          if (line.trim().startsWith('- ')) {
            return `<li>${line.trim().substring(2)}</li>`;
          }
          return `<p>${line}</p>`;
        }).join('');
      };

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; line-height: 1.6;">
          <h2 style="color: #1e3a8a; margin-top: 0;">${emailSubject}</h2>
          <div>
            ${getFormattedHtmlContent(cleanText)}
          </div>
          <p style="border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 12px; color: #94a3b8; margin-top: 30px;">
            Este es un correo automático. Por favor, no responda directamente.
          </p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [customer.email],
          subject: emailSubject,
          text: cleanText,
          html: emailHtml
        })
      }).catch(e => console.error('Failed to send customer public confirmation email:', e));
    }

    return res.status(200).json({
      success: true,
      order: newOrder
    });
  } catch (err) {
    console.error('Public reservation submission error:', err);
    return res.status(500).json({ error: 'Error al procesar su reserva en el servidor.', details: err.message });
  }
}
