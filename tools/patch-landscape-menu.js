const fs = require('fs');
const path = require('path');

const configPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'hexo-theme-landscape',
  '_config.yml'
);

if (!fs.existsSync(configPath)) {
  console.warn('[patch-landscape-menu] landscape theme config not found, skipping');
  process.exit(0);
}

const original = fs.readFileSync(configPath, 'utf8');
const patched = original.replace(
  /^menu:\s*\r?\n\s+Home: \/\r?\n\s+Archives: \/archives\r?\n/m,
  'menu:\n  首页: /\n  归档: /archives\n'
);

if (patched !== original) {
  fs.writeFileSync(configPath, patched, 'utf8');
  console.log('[patch-landscape-menu] menu labels patched');
} else {
  console.log('[patch-landscape-menu] menu labels already patched');
}
