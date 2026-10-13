const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('1_Planner/Vyom_Planner_offline_copy.html', 'utf8');
const m = html.match(/<script id="plan" type="application\/json">([\s\S]*?)<\/script>/);
const p = JSON.parse(m[1]);

const bookDir = '2_Books';
const subFolders = {
  M: 'Maths',
  S: 'Science',
  SS: 'SST',
  E: 'English',
  H: 'Hindi',
  SK: 'Sanskrit',
  AI: 'AI'
};

const allBookFiles = {};
for (const [k, folder] of Object.entries(subFolders)) {
  const full = path.join(bookDir, folder);
  if (fs.existsSync(full)) {
    allBookFiles[k] = fs.readdirSync(full).filter(f => f.endsWith('.pdf'));
  } else {
    allBookFiles[k] = [];
  }
}

// Map each chapter ID to { bookPdf: string|null, webSearch: string, webTitle: string }
const resources = {};

p.ch.forEach(c => {
  const files = allBookFiles[c.s] || [];
  let found = null;

  if (c.s === 'M') {
    const num = c.id.replace('M', '');
    const pad = num.padStart(2, '0');
    found = files.find(f => f.startsWith(`${pad} Ch ${num} `) || f.startsWith(`${pad} `));
  } else if (c.s === 'S') {
    const num = c.id.replace('S', '');
    const pad = num.padStart(2, '0');
    found = files.find(f => f.startsWith(`${pad} Ch ${num} `) || f.startsWith(`${pad} `));
  } else if (c.s === 'SS') {
    if (c.id.startsWith('SS')) {
      const num = c.id.replace('SS', '');
      const pad = num.padStart(2, '0');
      found = files.find(f => f.startsWith(`${pad} Part 1 Ch ${num} `) || f.startsWith(`${pad} `));
    } else if (c.id.startsWith('SP')) {
      const num = +c.id.replace('SP', '');
      if (num <= 3) {
        found = files.find(f => f.includes('pages 001-077'));
      } else {
        found = files.find(f => f.includes('pages 078-154'));
      }
    }
  } else if (c.s === 'E') {
    if (c.id.startsWith('E') && c.id !== 'EG') {
      const num = c.id.replace('E', '');
      const pad = num.padStart(2, '0');
      found = files.find(f => f.startsWith(`${pad} Unit ${num} `) || f.startsWith(`${pad} `));
    }
  } else if (c.s === 'H') {
    if (c.id.startsWith('H') && c.id !== 'HG') {
      const num = c.id.replace('H', '');
      const pad = num.padStart(2, '0');
      found = files.find(f => f.startsWith(`${pad} पाठ ${num} `) || f.startsWith(`${pad} `));
    }
  } else if (c.s === 'SK') {
    if (c.id.startsWith('SKA')) {
      const num = c.id.replace('SKA', '');
      const ranges = ['1-10', '11-20', '21-28', '29-32', '33-37'];
      const r = ranges[+num - 1];
      if (r) found = files.find(f => f.includes(r));
    } else if (c.id.startsWith('SK')) {
      const num = c.id.replace('SK', '');
      const pad = num.padStart(2, '0');
      found = files.find(f => f.startsWith(`${pad} Path ${num}`));
    }
  }

  const bookPath = found ? `../2_Books/${subFolders[c.s]}/${found}` : null;
  
  // Clean chapter name for search query
  let cleanName = c.name.replace(/^[^\s·]+(\s*·\s*|\s*-\s*)/, '').trim();
  let query = `Class 9 ${p.sub[c.s]} ${cleanName}`;
  if (c.s === 'AI') {
    query = `CBSE Class 9 Artificial Intelligence 417 ${cleanName}`;
  } else if (c.s === 'H') {
    query = `Class 9 Hindi ${cleanName} NCERT explanation`;
  } else if (c.s === 'SK') {
    query = `Class 9 Sanskrit ${cleanName} explanation hindi anuvad`;
  } else if (c.id === 'EG') {
    query = `Class 9 English Grammar Tenses Modals Reported Speech`;
  } else if (c.id === 'HG') {
    query = `Class 9 Hindi Vyakaran Upsarg Pratyay Samas Alankar`;
  }

  resources[c.id] = {
    book: bookPath,
    query: query,
    sub: p.sub[c.s],
    name: c.name
  };
});

console.log('Sample 5 resources:');
console.log(Object.entries(resources).slice(0, 5));

// Verify total mapped
const withBook = Object.values(resources).filter(r => r.book !== null).length;
console.log(`With book: ${withBook} / ${p.ch.length}`);
