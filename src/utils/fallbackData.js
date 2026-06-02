const initialData = [
  { page_number: 1, ad_type: "Portada", status: "Reserved" },
  { page_number: 2, ad_type: "Fundación", status: "Reserved" },
  { page_number: 3, ad_type: "Carta del alcalde", status: "Reserved" },
  { page_number: 5, ad_type: "Presentación concejal", status: "Reserved" },
  { page_number: 7, ad_type: "Presentación cura", status: "Reserved" },
  { page_number: 9, ad_type: "Comisión de festejos", status: "Reserved" },
  { page_number: 40, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 41, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 42, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 43, ad_type: "Las mises y peñas", status: "Reserved" },
  { page_number: 48, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 49, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 50, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 51, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 52, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 53, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 54, ad_type: "Programa de fiestas y feria taurina", status: "Reserved" },
  { page_number: 56, ad_type: "Abonos feria taurina", status: "Reserved" },
  { page_number: 58, ad_type: "Corporación municipal", status: "Reserved" },
  { page_number: 59, ad_type: "Teléfonos de interés", status: "Reserved" },
  { page_number: 60, ad_type: "Cruz de mayo", status: "Reserved" },
  { page_number: 61, ad_type: "Cruz de mayo", status: "Reserved" },
  { page_number: 64, ad_type: "San Roque", status: "Available" },
  { page_number: 65, ad_type: "San Roque", status: "Available" },
  { page_number: 72, ad_type: "Concentración clásicos", status: "Reserved" },
  { page_number: 73, ad_type: "Directorio", status: "Reserved" },
  { page_number: 74, ad_type: "Directorio", status: "Reserved" },
  { page_number: 75, ad_type: "Directorio", status: "Reserved" },
  { page_number: 76, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 77, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 78, ad_type: "Horarios autobuses", status: "Reserved" },
  { page_number: 91, ad_type: "Interior de contraportada", status: "Available" },
  { page_number: 92, ad_type: "Contraportada", status: "Available" }
];

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getInitialPagesData = () => {
  if (isBrowser) {
    try {
      const stored = localStorage.getItem('becerril_magazine_pages');
      if (stored) {
        return JSON.parse(stored);
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
        customer_id: 'legacy'
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
