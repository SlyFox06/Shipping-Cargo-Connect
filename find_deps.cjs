const fs = require('fs');
const path = require('path');

function getImports(dir) {
  let deps = new Set();
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getImports(fullPath).forEach(d => deps.add(d));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = [...content.matchAll(/from ['"]([^'".\\]+)['"]/g)];
      for (const m of matches) {
        if (!m[1].startsWith('.')) {
          let pkg = m[1].split('/')[0];
          if (pkg.startsWith('@')) pkg += '/' + m[1].split('/')[1];
          deps.add(pkg);
        }
      }
    }
  }
  return deps;
}

const deps = getImports('./src');
console.log(Array.from(deps).join(' '));
