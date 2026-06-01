const XLSX = require('xlsx');

try {
  const filePath = 'C:\\Users\\Shadow\\Desktop\\FACT_ 2025 I´M YOUR GRANNY.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  console.log("Sheet Names:", workbook.SheetNames);
  
  // Print the first 30 rows of the first sheet to understand the structure
  const sheetName = workbook.SheetNames[0];
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log(data.slice(0, 30)); // print first 30 rows
} catch (e) {
  console.error("Error reading Excel file:", e);
}
