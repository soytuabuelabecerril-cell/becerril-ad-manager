import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dfjxmnsozvmfhojnuikx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const supabase = createClient(supabaseUrl, supabaseKey);

const categories = {
  "Angel Mora": "ABOGADOS",
  "Julio López": "ALIMENTACIÓN",
  "La Boutique de la Carne": "ALIMENTACIÓN",
  "Hermanos de la Rubia": "ALIMENTACIÓN",
  "Guillén Alimentación": "ALIMENTACIÓN",
  "Primi": "ALIMENTACIÓN",
  "Unide market": "ALIMENTACIÓN",
  "Palazzo Dolce": "ALIMENTACIÓN",
  "Veronica Pajares": "ASESORÍA ADMINISTRATIVA",
  "Santiago Navarro Lozano": "ARQUITECTURA",
  "Ferca Becerril": "GESTORÍA ADMINISTRATIVA",
  "Crespo": "AUTOESCUELA",
  "Santander": "BANCOS",
  "Carpinteria Muñoz Plaza": "CARPINTERÍA",
  "Cocilú": "CARPINTERÍA",
  "Ebanistería Sergio Núñez": "CARPINTERÍA",
  "Yland": "CENTROS DE ESTÉTICA",
  "Goji": "CENTROS DE ESTÉTICA",
  "Ella & El": "CENTROS DE ESTÉTICA",
  "Mimos": "CENTROS DE ESTÉTICA",
  "Verónica Pajares": "CENTROS DE ESTÉTICA",
  "Clínica Serrano": "CLINICA DENTAL",
  "Cois": "CLINICA DENTAL",
  "Dental Navarro": "CLINICA DENTAL",
  "Norte Mueble": "COLCHONERÍA",
  "Balbino de Lucas": "CONSTRUCCIÓN",
  "Mascor Excavaciones": "CONSTRUCCIÓN",
  "Excavaciones Exvasa": "CONSTRUCCIÓN",
  "Forjalina": "CONSTRUCCIÓN",
  "Cerrajería Bonifacio": "CONSTRUCCIÓN",
  "EYJ Cerceda": "CONSTRUCCIÓN",
  "Brihuega": "CONSTRUCCIÓN",
  "Leo Castillo": "CONSTRUCCIÓN",
  "Hermanos Sanz Martín": "CONSTRUCCIÓN",
  "De Lema": "CONSTRUCCIÓN",
  "Ventanas.shop": "CONSTRUCCIÓN",
  "Nerpaser": "CONSTRUCCIÓN",
  "Reformas Alfonso Esteban": "CONSTRUCCIÓN",
  "Reformas y Mantenimientos": "CONSTRUCCIÓN",
  "Navarro Obras": "CONSTRUCCIÓN",
  "De Andrés Proyectos": "CONSTRUCCIÓN",
  "Alen": "CONSTRUCCIÓN",
  "Antama Home": "DECORACIÓN",
  "En Movimiento": "DEPORTES / FITNESS",
  "Gonna Fitness": "DEPORTES / FITNESS",
  "Cronos Deporte": "DEPORTES / FITNESS",
  "Club Ciclista": "DEPORTES / FITNESS",
  "Txamizo": "DEPORTES / FITNESS",
  "Duramonte": "DEPORTES / FITNESS",
  "Fertodis": "DISTRIBUIDOR DE BEBIDAS",
  "Estanco García": "ESTANCO",
  "Farmacia Sepúlveda": "FARMACIA",
  "Bricodalia": "FERRETERÍA Y BRICOLAJE",
  "Suministros de Construcción": "FERRETERÍA Y BRICOLAJE",
  "Fisio Becerril": "FISIOTERAPIA",
  "Navasan": "FONTANERÍA",
  "Meroil": "GASOLINERAS",
  "Body & Soul": "HERBOLARIO",
  "El Malote": "IMPRENTAS",
  "Euroredes": "INFORMÁTICA",
  "Elephant": "INMOBILIARIA",
  "Me Jardín": "JARDINERÍA / FLORISTERÍA",
  "Sanz Garden": "JARDINERÍA / FLORISTERÍA",
  "Floris": "JARDINERÍA / FLORISTERÍA",
  "Telelavo": "LIMPIEZA / MANTENIMIENTO",
  "Herca": "LIMPIEZA / MANTENIMIENTO",
  "Galv": "LIMPIEZA / MANTENIMIENTO",
  "Leñas Arturo": "MADERA",
  "Petilandia": "MASCOTAS",
  "Harley": "MASCOTAS",
  "Claqun": "MECÁNICA/ MOTOR",
  "Jorge Motor": "MECÁNICA/ MOTOR",
  "Paz Góngora": "MODA",
  "Maison Tricot": "MODA",
  "Domca": "PANADERÍA / REPOSTERIA",
  "Panadería Juan Carlos": "PANADERÍA / REPOSTERIA",
  "San Pedro": "PANADERÍA / REPOSTERIA",
  "Estilista CC": "PELUQUERÍAS",
  "Peluquería Javier": "PELUQUERÍAS",
  "La Pelu de Lur": "PELUQUERÍAS",
  "Innova": "PELUQUERÍAS",
  "Peluquería GHL": "PELUQUERÍAS",
  "Patxi": "RESTAURACIÓN / HOSTELERÍA",
  "Las Cadenas": "RESTAURACIÓN / HOSTELERÍA",
  "La Maliciosa": "RESTAURACIÓN / HOSTELERÍA",
  "Las Terrazas": "RESTAURACIÓN / HOSTELERÍA",
  "Donde Joha": "RESTAURACIÓN / HOSTELERÍA",
  "Kebab Amouche": "RESTAURACIÓN / HOSTELERÍA",
  "El Mesón": "RESTAURACIÓN / HOSTELERÍA",
  "Las Gacelas": "RESTAURACIÓN / HOSTELERÍA",
  "Caramba": "RESTAURACIÓN / HOSTELERÍA",
  "Cafetería Churrería": "RESTAURACIÓN / HOSTELERÍA",
  "El Recreo": "RESTAURACIÓN / HOSTELERÍA",
  "El Albero": "RESTAURACIÓN / HOSTELERÍA",
  "La Taberna": "RESTAURACIÓN / HOSTELERÍA",
  "Spigel": "RESTAURACIÓN / HOSTELERÍA",
  "La Gabarrera": "RESTAURACIÓN / HOSTELERÍA",
  "La Senderuela": "RESTAURACIÓN / HOSTELERÍA",
  "Mapfre": "SEGUROS",
  "Alberto Ruiz": "TAXI"
};

function normalizeString(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

async function run() {
  const { data: customers, error } = await supabase.from('customers').select('*');
  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }
  console.log(`Loaded ${customers.length} customers from DB.`);
  
  let matchCount = 0;
  for (const customer of customers) {
    const custNameNorm = normalizeString(customer.fiscal_name || "");
    const custCommNorm = normalizeString(customer.commercial_name || "");
    
    let matchedCategory = null;
    
    for (const [key, cat] of Object.entries(categories)) {
      const keyNorm = normalizeString(key);
      if (custNameNorm.includes(keyNorm) || custCommNorm.includes(keyNorm)) {
        matchedCategory = cat;
        break;
      }
    }
    
    if (matchedCategory) {
      console.log(`Matched: ${customer.fiscal_name} -> ${matchedCategory}`);
      await supabase.from('customers').update({ category: matchedCategory }).eq('id', customer.id);
      matchCount++;
    }
  }
  
  console.log(`Finished updating. Matched ${matchCount} out of ${customers.length} customers.`);
}

run();
