/**
 * Utility to parse Spanish address strings and extract post code, city, and province.
 * E.g., "C/ Soria, 2, Bajo\n42300 El Burgo de Osma, Soria" -> ZIP: 42300, City: El Burgo de Osma, Province: Soria
 * E.g., "Plaza de la Constitución 13. 28490 Beceril de la Sierra (Madrid)" -> ZIP: 28490, City: Beceril de la Sierra, Province: Madrid
 */
export const parseAddressDetails = (addressStr) => {
  if (!addressStr) return { address: '', zip: '', city: '', province: '' };
  
  const zipRegex = /\b\d{5}\b/;
  const zipMatch = addressStr.match(zipRegex);
  const zip = zipMatch ? zipMatch[0] : '';
  
  let city = '';
  let province = '';
  
  if (zip) {
    const parts = addressStr.split(zip);
    const beforeZip = parts[0].trim();
    const afterZip = parts.length > 1 ? parts[1].trim() : '';
    
    // Check if there is text after the zip code (standard format: ZIP City, Province)
    if (afterZip.length > 2) {
      const provinceRegex = /\(([^)]+)\)/;
      const provinceMatch = afterZip.match(provinceRegex);
      if (provinceMatch) {
        province = provinceMatch[1].trim();
        city = afterZip.replace(provinceRegex, '').replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
      } else {
        const commaParts = afterZip.split(',');
        if (commaParts.length > 1) {
          province = commaParts[commaParts.length - 1].trim();
          city = commaParts.slice(0, -1).join(',').replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
        } else {
          const semiParts = afterZip.split(';');
          if (semiParts.length > 1) {
            province = semiParts[semiParts.length - 1].trim();
            city = semiParts.slice(0, -1).join(';').replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
          } else {
            city = afterZip.replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
          }
        }
      }
    } else {
      // If nothing or very little is after the zip code (format: City ZIP)
      // We look at the text immediately before the zip code, usually the last line or after the last comma/semicolon
      const lines = beforeZip.split('\n');
      const lastLine = lines[lines.length - 1].trim();
      const commaParts = lastLine.split(',');
      const candidate = commaParts[commaParts.length - 1].trim();
      
      // Filter out standard street terms or floor details
      if (candidate && !/^(bajo|piso|duplicado|izq|dcha|local|nº|n|no|\d+$)/i.test(candidate)) {
        city = candidate.replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
      } else if (lastLine) {
        city = lastLine.replace(/^[,\s;.-]+|[,\s;.-]+$/g, '').trim();
      }
    }
  }
  
  // Set default province based on standard Spanish postal code ranges
  if (zip) {
    if (zip.startsWith('28') && !province) {
      province = 'Madrid';
    } else if (zip.startsWith('42') && !province) {
      province = 'Soria';
    } else if (zip.startsWith('08') && !province) {
      province = 'Barcelona';
    } else if (zip.startsWith('39') && !province) {
      province = 'Cantabria';
    }
  }
  
  return {
    address: addressStr,
    zip: zip || '',
    city: city || '',
    province: province || ''
  };
};
