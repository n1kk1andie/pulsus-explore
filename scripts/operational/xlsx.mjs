// A small reader for the publisher's own .xlsx files, with no dependency: an
// .xlsx is a zip of XML parts. Reads each sheet's cells (shared strings,
// inline strings and numbers) into rows of values. Enough for the regulators'
// plain data tables; not a general spreadsheet engine.
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

function unzip(buf) {
  // The end of central directory record, then each central directory entry.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + csize);
    files[name] = method === 0 ? data : inflateRawSync(data);
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
const col = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

/** Every sheet of an .xlsx, by name: an array of rows, each an array of cell values (string, number or null). */
export function readXlsx(path) {
  const z = unzip(readFileSync(path));
  const text = (n) => (z[n] ? z[n].toString("utf8") : "");
  const shared = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unxml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));
  const rels = Object.fromEntries([...text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((m) => [m[1], m[2].replace(/^\/?xl\//, "")]));
  const out = {};
  for (const m of text("xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const xml = text(`xl/${rels[m[2]]}`);
    const rows = [];
    for (const r of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const row = [];
      for (const c of r[2].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /r="([A-Z]+\d+)"/.exec(c[1])?.[1]; const t = /t="(\w+)"/.exec(c[1])?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(c[2] || "")?.[1];
        let val = null;
        if (t === "s" && v !== undefined) val = shared[+v];
        else if (t === "inlineStr") val = unxml([...(c[2] || "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(""));
        else if (t === "str") val = v !== undefined ? unxml(v) : null;
        else if (v !== undefined) val = Number(v);
        if (ref) row[col(ref)] = val;
      }
      rows[+r[1] - 1] = Array.from(row, (x) => (x === undefined ? null : x));
    }
    out[unxml(m[1])] = Array.from(rows, (x) => x || []);
  }
  return out;
}
