import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server configuration error: Supabase keys not set' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch pages
    const { data: pagesData, error: pagesErr } = await supabase
      .from('magazine_pages')
      .select('*')
      .order('page_number', { ascending: true });

    if (pagesErr) throw pagesErr;

    // Fetch reservations
    const { data: adsData, error: adsErr } = await supabase
      .from('ad_reservations')
      .select('*');

    if (adsErr) throw adsErr;

    // Merge pages and reservations, removing customer_name, customer_id, and any private fields
    const combined = pagesData.map(p => {
      const pageAds = adsData
        .filter(ad => ad.page_number === p.page_number)
        .map(ad => ({
          id: ad.id,
          ad_type: ad.ad_type,
          isPreReserved: ad.is_pre_reserved || false,
          isPaid: ad.is_paid || false,
          isNew: false // Frontend can treat it as a standard existing reservation
        }));

      return {
        id: p.id,
        page_number: p.page_number,
        status: pageAds.length > 0 ? 'Reserved' : p.status,
        ads: pageAds
      };
    });

    return res.status(200).json(combined);
  } catch (err) {
    console.error('Public data loading error:', err);
    return res.status(500).json({ error: 'Error loading public page layout.', details: err.message });
  }
}
