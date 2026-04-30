const csvText = `fullName,email,amount,phone,address
Khalil Bchir,zeolixkhalil@gmail.com,150.0,+216 12 345 678,"Tunis, Tunisia"
Khalil B.,itskhvlil@outlook.com,200.5,+216 23 456 789,"Sousse, Tunisia"
Mohamed Khalil Bchir,khalil.bchir@nexus-lab.io,340.0,+216 12 345 678,Nexus Lab Office
M. Khalil Bchir,mohamedkhalil.bchir@polytechnicien.tn,1000.0,+216 12 345 678,Polytechnique Campus
John Doe,john.doe@example.com,50.25,+216 12 345 678,"123 Dummy St, Sample City"`;

function detectDelimiter(csvText) {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim().length > 0) || ''
  const candidates = [',', ';', '\t']

  let selected = ','
  let maxCount = -1

  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > maxCount) {
      maxCount = count
      selected = candidate
    }
  }

  return selected
}

function stripBom(value) { return value.replace(/^\uFEFF/, '') }

function isEmptyRow(row) { return row.every((cell) => !cell || !cell.trim()) }

function parseCsv(csvText) {
  const delimiter = detectDelimiter(csvText)
  const rows = []

  let row = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]
    const next = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(stripBom(value.trim()))
      value = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1
      }

      row.push(stripBom(value.trim()))
      value = ''

      if (!isEmptyRow(row)) {
        rows.push(row)
      }
      row = []
      continue
    }

    value += char
  }

  if (value.length > 0 || row.length > 0) {
    row.push(stripBom(value.trim()))
    if (!isEmptyRow(row)) {
      rows.push(row)
    }
  }

  return rows
}

const rows = parseCsv(csvText)
console.log('Detected delimiter:', detectDelimiter(csvText))
console.log('Parsed rows count:', rows.length)
rows.forEach((r, i) => console.log(i, r))
