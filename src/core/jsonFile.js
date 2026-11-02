const fs = require('node:fs');
const path = require('node:path');

// Reads JSON and runs it through `validate`, which returns the cleaned value or null.
// A missing file gives null. A file that exists but is unreadable, unparsable or invalid
// is kept as `<path>.bak` and gives null, so callers start fresh and never crash.
function readJsonOrBackup(filePath, validate) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  try {
    const value = validate(JSON.parse(text));
    if (value) return value;
  } catch {
    // fall through to backup
  }
  try {
    fs.renameSync(filePath, filePath + '.bak');
  } catch {
    // keeping the backup is best effort
  }
  return null;
}

// Writes a temp file then renames it over the target, so a crash never leaves half a file.
function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

module.exports = { readJsonOrBackup, writeJsonAtomic };
