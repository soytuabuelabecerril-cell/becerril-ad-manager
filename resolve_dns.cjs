const dns = require('dns');

dns.lookup('db.dfjxmnsozvmfhojnuikx.supabase.co', { all: true }, (err, addresses) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('Addresses:', addresses);
});

dns.resolveCname('db.dfjxmnsozvmfhojnuikx.supabase.co', (err, addresses) => {
  if (err) {
    console.log('Cname resolution failed/no CNAME:', err.message);
  } else {
    console.log('CNAMEs:', addresses);
  }
});
