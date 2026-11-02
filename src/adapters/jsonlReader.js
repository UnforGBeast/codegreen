const fs = require('node:fs');

// Incremental line reader. Remembers, per file, the byte offset just past the last
// complete line, so a partial trailing line is picked up whole on a later read.
function createReader() {
  const offsets = new Map();

  function readNew(filePath) {
    let fd;
    try {
      fd = fs.openSync(filePath, 'r');
      const size = fs.fstatSync(fd).size;
      let offset = offsets.get(filePath) || 0;
      if (size < offset) offset = 0; // shrunk or replaced: start over
      if (size === offset) {
        offsets.set(filePath, offset);
        return [];
      }
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

module.exports = { createReader };
