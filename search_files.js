import fs from 'fs';
import path from 'path';

const searchDir = '.';
const pattern = 'last_auto_reminder_day';

function searchFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(pattern)) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes(pattern)) {
          console.log(`${filePath}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  } catch (e) {
    // Ignore binary/unreadable files
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        traverse(fullPath);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs') || file.endsWith('.sql') || file.endsWith('.tsx') || file.endsWith('.ts')) {
        searchFile(fullPath);
      }
    }
  }
}

console.log(`Searching for "${pattern}" in source files...`);
traverse(searchDir);
console.log('Search complete.');
