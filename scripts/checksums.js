// Writes SHA-256 sums for the installers in a folder: node scripts/checksums.js <dir> <outfile>
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const INSTALLER = /\.(exe|dmg|zip|AppImage|deb)$/;

function checksumLines(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => INSTALLER.test(n) && fs.statSync(path.join(dir, n)).isFile())
    .sort()
    .map((n) => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, n))).digest('hex')}  ${n}`);
}

if (require.main === module) {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) {
    console.error('usage: node scripts/checksums.js <dir> <outfile>');
    process.exit(2);
  }
  const lines = checksumLines(dir);
  if (lines.length === 0) {
    console.error(`no installers found in ${dir}`);
    process.exit(1);
  }
  fs.writeFileSync(out, lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

module.exports = { checksumLines };
