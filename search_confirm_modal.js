import fs from 'fs';

const filePath = './src/components/ReservationPanel.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("orderConfirmModalOpen") || line.includes("Order Registered!")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
