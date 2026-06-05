const { Client } = require('pg');

const connectionString = 'postgresql://postgres:pBX5dYZR6XcYvJ1EHvzA@db.dfjxmnsozvmfhojnuikx.supabase.co:5432/postgres';

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to database.");

    // Query magazine_pages
    const pagesRes = await client.query(`
      SELECT page_number, status 
      FROM public.magazine_pages 
      ORDER BY page_number ASC;
    `);
    console.log("\nPages from magazine_pages:");
    console.log(JSON.stringify(pagesRes.rows));

    // Query ad_reservations
    const adsRes = await client.query(`
      SELECT id, page_number, customer_name, ad_type, is_pre_reserved, is_paid 
      FROM public.ad_reservations 
      ORDER BY page_number ASC;
    `);
    console.log("\nActive ad reservations:");
    console.log(JSON.stringify(adsRes.rows));

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await client.end();
  }
}

run();
