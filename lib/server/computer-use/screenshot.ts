import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function createSolidColorPng(
  width: number,
  height: number,
  rgb: [number, number, number] = [245, 245, 245],
): Buffer {
  const safeWidth = Math.max(64, Math.min(2560, width));
  const safeHeight = Math.max(64, Math.min(2560, height));
  const rowSize = 1 + safeWidth * 3;
  const raw = Buffer.alloc(rowSize * safeHeight);

  for (let y = 0; y < safeHeight; y += 1) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < safeWidth; x += 1) {
      const pixelStart = rowStart + 1 + x * 3;
      raw[pixelStart] = rgb[0];
      raw[pixelStart + 1] = rgb[1];
      raw[pixelStart + 2] = rgb[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(safeWidth, 0);
  ihdr.writeUInt32BE(safeHeight, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function isValidPng(buffer: Buffer): boolean {
  if (buffer.length < 33) return false;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return false;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width >= 64 && height >= 64;
}

export function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (!isValidPng(buffer)) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
