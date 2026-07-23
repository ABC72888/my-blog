const fs = require('fs');
const path = require('path');

// 1) Patch article.ejs: add busuanzi counter inside article footer
const articleEjs = path.join(__dirname, '..', 'node_modules', 'hexo-theme-landscape', 'layout', '_partial', 'article.ejs');
if (fs.existsSync(articleEjs)) {
  let code = fs.readFileSync(articleEjs, 'utf8');
  if (!code.includes('busuanzi_value_page_pv')) {
    const counter = '<% if (!index){ %> <span style="margin-left:12px;color:#999;font-size:13px"><span class="fa fa-eye"></span> <span id="busuanzi_container_page_pv" style="display:inline;"><span id="busuanzi_value_page_pv"></span> 次浏览</span></span><% } %>';
    code = code.replace(
      '<span class="fa fa-share"><%= __(\'share\') %></span>',
      '<span class="fa fa-share"><%= __(\'share\') %></span>' + counter
    );
    fs.writeFileSync(articleEjs, code, 'utf8');
    console.log('[patch-landscape-menu] busuanzi counter added');
  } else {
    console.log('[patch-landscape-menu] busuanzi counter already present');
  }
}

// 2) Patch after-footer.ejs: load busuanzi script
const afterFooter = path.join(__dirname, '..', 'node_modules', 'hexo-theme-landscape', 'layout', '_partial', 'after-footer.ejs');
if (fs.existsSync(afterFooter)) {
  let footer = fs.readFileSync(afterFooter, 'utf8');
  if (!footer.includes('busuanzi.pure.mini')) {
    footer += '\n<script async src="//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"></script>\n';
    fs.writeFileSync(afterFooter, footer, 'utf8');
    console.log('[patch-landscape-menu] busuanzi script injected');
  } else {
    console.log('[patch-landscape-menu] busuanzi script already present');
  }
}

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
