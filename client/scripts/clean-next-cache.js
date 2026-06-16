/** Remove stale Next build dirs (OneDrive .next races on Windows). */
const fs = require('fs');
const path = require('path');

const roots = [
  path.join(__dirname, '..', '.next'),
  path.join(__dirname, '..', 'out'),
  path.join(__dirname, '..', 'node_modules', '.cache', 'gv-next'),
];

for (const dir of roots) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
