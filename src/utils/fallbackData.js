const initialData = [];

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getInitialPagesData = () => {
  if (isBrowser) {
    try {
      const stored = localStorage.getItem('becerril_magazine_pages');
      if (stored) {
        const parsed = JSON.parse(stored);
        let updated = false;
        parsed.forEach(p => {
          if (p.ads) {
            const originalLength = p.ads.length;
            p.ads = p.ads.filter(ad => !((ad.customer_id === 'legacy' || ad.customer_name === 'Legacy Customer') && ad.isPreReserved));
            if (p.ads.length !== originalLength) {
              updated = true;
              if (p.ads.length === 0) {
                p.status = 'Available';
                p.ad_type = null;
              }
            }
          }
          if (p.page_number === 91 || p.page_number === 92) {
            if (p.ads && p.ads.some(ad => ad.customer_id === 'legacy')) {
              p.status = 'Available';
              p.ad_type = null;
              p.ads = [];
              updated = true;
            }
          }
          if (p.ads) {
            p.ads.forEach(ad => {
              if (ad.customer_id === 'legacy' && !ad.customer_name) {
                ad.customer_name = ad.ad_type || p.ad_type;
                updated = true;
              }
            });
          }
        });
        if (updated) {
          localStorage.setItem('becerril_magazine_pages', JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {
      console.error("Error loading magazine pages from localStorage", e);
    }
  }

  const defaultPages = Array.from({ length: 92 }, (_, i) => {
    const pageNum = i + 1;
    const existing = initialData.find(p => p.page_number === pageNum);
    
    const page = existing ? { ...existing } : { page_number: pageNum, status: 'Available', ad_type: null };
    
    page.ads = [];
    
    if (page.ad_type) {
      page.ads.push({
        ad_type: page.ad_type,
        customer_id: 'legacy',
        customer_name: page.ad_type
      });
    }
    
    return page;
  });

  if (isBrowser) {
    try {
      localStorage.setItem('becerril_magazine_pages', JSON.stringify(defaultPages));
    } catch (e) {
      console.error("Error saving initial magazine pages to localStorage", e);
    }
  }

  return defaultPages;
};

// Initialize the array once to serve as an in-memory DB 
export const fallbackPagesData = getInitialPagesData();

// Periodically auto-save the page reservations state to localStorage to prevent data loss on HMR/reload
if (isBrowser) {
  setInterval(() => {
    try {
      localStorage.setItem('becerril_magazine_pages', JSON.stringify(fallbackPagesData));
    } catch (e) {
      // Silently ignore storage exceptions
    }
  }, 1000);
}

export const getFullPages = () => {
  return fallbackPagesData; // Return reference to mutated state
};
