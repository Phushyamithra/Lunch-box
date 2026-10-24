import { describe, expect, it } from 'vitest';
import { excelDate, readXlsx } from './xlsx';

/** Builds a minimal zip (stored or deflated entries) in memory. */
async function zip(files: Record<string, string>, deflate = true): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const nameBytes = enc.encode(name);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, deflate ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    parts.push(local, data);
    central.push(cen);
    offset += local.length + data.length;
  }
  const cenSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
  let p = 0;
  for (const part of all) {
    out.set(part, p);
    p += part.length;
  }
  return out.buffer;
}

const WORKBOOK = {
  'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Expenses" sheetId="1" r:id="rId1"/><sheet name="Notes &amp; more" sheetId="2" r:id="rId2"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Item</t></si><si><t>Amount (₹)</t></si><si><r><t>Tea</t></r><r><t xml:space="preserve"> &amp; snacks</t></r></si></sst>',
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>46318</v></c><c r="C3"><f>SUM(1,2)</f><v>149.5</v></c></row></sheetData></worksheet>',
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Hello</t></is></c></row></sheetData></worksheet>',
};

describe('xlsx reader', () => {
  it('reads sheets, shared and inline strings, numbers and cached formula values', async () => {
    for (const deflate of [true, false]) {
      const sheets = await readXlsx(await zip(WORKBOOK, deflate));
      expect(sheets.map((s) => s.name)).toEqual(['Expenses', 'Notes & more']);
      expect(sheets[0].rows).toEqual([['Item', '', 'Amount (₹)'], [], ['Tea & snacks', 46318, 149.5]]);
      expect(sheets[1].rows).toEqual([['Hello']]);
    }
  });
  it('rejects other files', async () => {
    await expect(readXlsx(new TextEncoder().encode('not a zip').buffer)).rejects.toThrow(/isn’t an Excel/);
  });
  it('Excel dates', () => {
    expect(excelDate(46318)).toBe('2026-10-23');
    expect(excelDate(46311)).toBe('2026-10-16');
  });
});
