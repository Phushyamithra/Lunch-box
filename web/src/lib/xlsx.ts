/**
 * Minimal .xlsx reader: enough to read values (not formulas or styles) from
 * a workbook's sheets. An .xlsx is a zip of XML files; we read the zip's
 * central directory, inflate entries with the platform's
 * DecompressionStream, and pick cell values out of the sheet XML.
 * No dependency, works in the browser and in Node 18+.
 */

export interface Sheet {
  name: string;
  /** rows[r][c], 0-based; formulas give their cached value. Empty cells are ''. */
  rows: (string | number)[][];
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([new Uint8Array(data)]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}

/** Files in a zip archive, by name. */
export async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const b = new Uint8Array(buf);
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
    if (u32(b, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('This isn’t an Excel (.xlsx) file.');
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('The .xlsx file looks damaged.');
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lNameLen = u16(b, local + 26);
    const lExtraLen = u16(b, local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const raw = b.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, await inflateRaw(raw));
  }
  return files;
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
const textOf = (xml: string) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => unescapeXml(m[1])).join('');
const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = await unzip(buf);
  const text = (name: string) => {
    const f = files.get(name);
    return f ? new TextDecoder().decode(f) : null;
  };
  const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textOf(m[1]));
  const wb = text('xl/workbook.xml');
  const rels = text('xl/_rels/workbook.xml.rels');
  if (!wb || !rels) throw new Error('This isn’t an Excel (.xlsx) file.');
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [m[0].match(/Id="([^"]+)"/)?.[1] ?? '', m[0].match(/Target="([^"]+)"/)?.[1] ?? '']));
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = unescapeXml(m[0].match(/name="([^"]*)"/)?.[1] ?? 'Sheet');
    const rid = m[0].match(/r:id="([^"]+)"/)?.[1] ?? '';
    const t = target.get(rid);
    if (!t) continue;
    const path = t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`;
    const xml = text(path);
    if (!xml) continue;
    const rows: (string | number)[][] = [];
    for (const r of xml.matchAll(/<(?:\w+:)?row\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
      const rowNum = Number(r[1].match(/r="(\d+)"/)?.[1] ?? rows.length + 1) - 1;
      const row: (string | number)[] = [];
      for (const c of r[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const attrs = c[1];
        const inner = c[2] ?? '';
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
        const type = attrs.match(/t="(\w+)"/)?.[1];
        const v = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1];
        let val: string | number = '';
        if (type === 's' && v !== undefined) val = shared[Number(v)] ?? '';
        else if (type === 'inlineStr') val = textOf(inner);
        else if (type === 'str' || type === 'e') val = v !== undefined ? unescapeXml(v) : '';
        else if (type === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (v !== undefined) val = Number(v);
        const col = ref ? colIndex(ref) : row.length;
        while (row.length < col) row.push('');
        row[col] = val;
      }
      while (rows.length < rowNum) rows.push([]);
      rows[rowNum] = row;
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

/** Excel date serial (days since 1899-12-30) → YYYY-MM-DD. */
export function excelDate(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000).toISOString().slice(0, 10);
}
