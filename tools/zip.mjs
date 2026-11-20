/**
 * Minimal ZIP writer (DEFLATE, UTF-8 names) on top of node:zlib – no dependencies.
 * Enough for a Foundry module package: files only, forward-slash paths, fixed timestamps
 * so the same input always gives the same archive.
 */
import zlib from "node:zlib";

const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

function dosTime(date) {
  return {
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1),
    date: ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  };
}

/**
 * @param {{name: string, data: Buffer}[]} files  name with "/" separators, relative to the archive root
 * @returns {Buffer}
 */
export function createZip(files) {
  const { time, date } = dosTime(FIXED_DATE);
  const UTF8 = 0x0800;
  const DEFLATE = 8;
  const local = [];
  const central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name.replace(/\\/g, "/"), "utf8");
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data) >>> 0;

    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);   // local file header
    head.writeUInt16LE(20, 4);           // version needed
    head.writeUInt16LE(UTF8, 6);
    head.writeUInt16LE(DEFLATE, 8);
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(date, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, nameBuf, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);  // central directory header
    entry.writeUInt16LE(20, 4);          // version made by
    entry.writeUInt16LE(20, 6);          // version needed
    entry.writeUInt16LE(UTF8, 8);
    entry.writeUInt16LE(DEFLATE, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);     // extra/comment/disk/attributes stay 0
    central.push(entry, nameBuf);

    offset += head.length + nameBuf.length + packed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);      // end of central directory
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBuf, end]);
}
