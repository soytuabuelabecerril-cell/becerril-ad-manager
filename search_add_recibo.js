import fs from 'fs';

const filePath = './src/components/ReservationPanel.jsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("addRecibo({")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
