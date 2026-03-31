const xlsx = require('xlsx');
const fs = require('fs');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.xlsx'));
for (let f of files) {
  const workbook = xlsx.readFile(f);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('--- ' + f + ' ---');
  console.log(data[0]);
}
