/**
 * Minimal XLSX reader: first worksheet → rows of strings.
 * An .xlsx file is a zip of XML parts; fflate (≈8 kB) unzips it and the
 * browser's DOMParser reads the XML. Enough for question spreadsheets,
 * without shipping a full spreadsheet library.
 */
import { strFromU8, unzipSync } from 'fflate'

function xml(files: Record<string, Uint8Array>, path: string): Document | null {
  const data = files[path]
  return data ? new DOMParser().parseFromString(strFromU8(data), 'application/xml') : null
}

function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = xml(files, 'xl/workbook.xml')
  const rels = xml(files, 'xl/_rels/workbook.xml.rels')
  const rid = workbook?.getElementsByTagName('sheet')[0]?.getAttribute('r:id')
  if (rid && rels) {
    for (const rel of Array.from(rels.getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('Id') === rid) {
        const target = rel.getAttribute('Target') ?? ''
        return target.startsWith('/') ? target.slice(1) : `xl/${target}`
      }
    }
  }
  return Object.keys(files).find((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)) ?? null
}

/** "AB12" → 27 (zero-based column) */
function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1
}

const textOf = (el: Element) => Array.from(el.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')

export function readXlsx(buffer: ArrayBuffer): string[][] {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error('IMPORT_FILE_INVALID')
  }
  const shared = xml(files, 'xl/sharedStrings.xml')
  const strings = shared ? Array.from(shared.getElementsByTagName('si')).map(textOf) : []
  const sheetPath = firstSheetPath(files)
  const sheet = sheetPath ? xml(files, sheetPath) : null
  if (!sheet) throw new Error('IMPORT_FILE_INVALID')

  const rows: string[][] = []
  for (const rowEl of Array.from(sheet.getElementsByTagName('row'))) {
    const rowIndex = Number(rowEl.getAttribute('r') ?? rows.length + 1) - 1
    const row: string[] = []
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const type = c.getAttribute('t')
      const value = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let text = value
      if (type === 's') text = strings[Number(value)] ?? ''
      else if (type === 'inlineStr') text = textOf(c)
      else if (type === 'b') text = value === '1' ? 'true' : 'false'
      row[columnIndex(c.getAttribute('r') ?? '')] = text
    }
    rows[rowIndex] = Array.from(row, (v) => v ?? '')
  }
  return Array.from(rows, (r) => r ?? [])
}
