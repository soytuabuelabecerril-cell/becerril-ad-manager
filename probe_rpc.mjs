// probe_rpc.mjs - try to create tables via any available RPC route

const projectRef = 'dfjxmnsozvmfhojnuikx';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmanhtbnNvenZtZmhvam51aWt4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMwOTM3OCwiZXhwIjoyMDk1ODg1Mzc4fQ.QNPGwOX8BJ-LoRtO06Ng3tW8_NpZSH4IXacJaw0Tcrc';
const base = `https://${projectRef}.supabase.co`;
const headers = {
  'apikey': serviceKey,
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text();
  return { status: r.status, body: t };
}

// Check if exec_ddl exists already
console.log('=== Checking for exec_ddl RPC ===');
const check = await post('/rest/v1/rpc/exec_ddl', { query: 'SELECT 1' });
console.log('exec_ddl status:', check.status);
console.log('exec_ddl body:', check.body.slice(0, 200));

// Try exec_sql
console.log('\n=== Checking for exec_sql RPC ===');
const check2 = await post('/rest/v1/rpc/exec_sql', { sql: 'SELECT 1' });
console.log('exec_sql status:', check2.status);
console.log('exec_sql body:', check2.body.slice(0, 200));

// If neither exists, we need another approach
// Try using the Supabase pg-meta endpoint (internal) 
console.log('\n=== Trying pg-meta endpoint ===');
const pgmeta = await fetch(`${base}/pg/tables`, { headers });
console.log('pg-meta tables status:', pgmeta.status);

// Try the database/query endpoint
console.log('\n=== Trying database/query endpoint ===');
const dbq = await post('/database/query', { query: 'SELECT 1' });
console.log('database/query status:', dbq.status);
console.log('database/query body:', dbq.body.slice(0, 200));
