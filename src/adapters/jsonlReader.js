const fs = require('node:fs');
const path = require('node:path');

// Incremental line reader. Remembers, per file, the byte offset just past the last
// complete line, so a partial trailing line is picked up whole on a later read.
function createReader() {
  const offsets = new Map();

  function readNew(filePath) {
    let fd;
    try {
      let offset = offsets.get(filePath) || 0;
      // cheap stat first: an unchanged file is never opened
      const size = fs.statSync(filePath).size;
      if (size === offset) return [];
      if (size < offset) offset = 0; // shrunk or replaced: start over
      fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(size - offset);
      const read = fs.readSync(fd, buf, 0, buf.length, offset);
      const end = buf.subarray(0, read).lastIndexOf(0x0a);
      if (end === -1) {
        offsets.set(filePath, offset);
        return [];
      }
      offsets.set(filePath, offset + end + 1);
      return buf
        .subarray(0, end)
        .toString('utf8')
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.length > 0);
    } catch {
      return [];
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }

  return { readNew };
}

function findJsonl(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) findJsonl(full, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

// Caches the file list so the full directory walk runs at most once per interval;
// in between, callers only touch the files they already know.
function createLister(rootDir, { intervalMs = 30000, now = Date.now } = {}) {
  let files = [];
  let walkedAt = null;
  return {
    list() {
      if (walkedAt === null || now() - walkedAt >= intervalMs) {
        files = findJsonl(rootDir);
        walkedAt = now();
      }
      return files;
    },
  };
}

module.exports = { createReader, createLister, findJsonl };
