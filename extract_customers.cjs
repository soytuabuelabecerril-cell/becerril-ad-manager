const XLSX = require('xlsx');
const fs = require('fs');

try {
  const filePath = 'C:\\Users\\Shadow\\Desktop\\FACT_ 2025 I´M YOUR GRANNY.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  const customers = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let customer = {
      invoice: sheetName,
      fiscal_name: '',
      nif: '',
      address: '',
      last_year_product: ''
    };

    // Find the rows with data
    for (let i = 0; i < data.length; i++) {
      const row = data[i] || [];
      const col0 = String(row[0] || '').trim();
      
      if (col0.startsWith('FACTURA A')) {
        customer.fiscal_name = String(row[1] || '').trim();
        // The address is usually on the next row at index 1
        if (data[i+1]) customer.address = String(data[i+1][1] || '').trim();
      }
      
      if (col0 === 'CIF') {
        // There are two CIFs. The first is Granny's, the second is the customer's.
        // The customer's CIF is around row 13.
        if (i > 10) {
           customer.nif = String(row[1] || '').trim().replace(/\n/g, '');
        }
      }

      if (col0 === 'CANTIDAD') {
        // The product description is usually on the row after 'CANTIDAD'
        if (data[i+2]) {
           customer.last_year_product = String(data[i+2][1] || '').trim();
        }
      }
    }
    
    if (customer.fiscal_name) {
      customers.push(customer);
    }
  }

  // Save to JSON
  fs.writeFileSync('extracted_customers.json', JSON.stringify(customers, null, 2));
  console.log(`Successfully extracted ${customers.length} customers to extracted_customers.json`);
} catch (e) {
  console.error("Error reading Excel file:", e);
}
