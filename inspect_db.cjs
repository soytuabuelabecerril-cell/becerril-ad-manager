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

    // Query tables in public schema
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log("\nTables in database:");
    console.log(tables.rows.map(r => r.table_name));

    // Inspect columns of magazine_pages and ad_reservations
    for (const tableName of ['magazine_pages', 'ad_reservations']) {
      const columnsRes = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        AND table_schema = 'public';
      `);
      console.log(`\nColumns of ${tableName}:`);
      console.log(columnsRes.rows);
      
      const countRes = await client.query(`SELECT count(*) FROM public.${tableName}`);
      console.log(`Row count of ${tableName}:`, countRes.rows[0].count);
    }

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await client.end();
  }
}

run();
