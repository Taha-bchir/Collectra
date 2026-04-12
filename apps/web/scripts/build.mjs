import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const nextBin = require.resolve('next/dist/bin/next')

const originalWarn = console.warn.bind(console)
const originalError = console.error.bind(console)
const originalEmitWarning = process.emitWarning.bind(process)
const originalStdoutWrite = process.stdout.write.bind(process.stdout)
const originalStderrWrite = process.stderr.write.bind(process.stderr)

console.warn = (...args) => {
  if (shouldFilterBaselineWarning(args)) {
    return
  }

  originalWarn(...args)
}

console.error = (...args) => {
  if (shouldFilterBaselineWarning(args)) {
    return
  }

  originalError(...args)
}

process.emitWarning = (...args) => {
  if (shouldFilterBaselineWarning(args)) {
    return undefined
  }

  return originalEmitWarning(...args)
}

process.stdout.write = ((chunk, encoding, callback) => {
  if (shouldFilterBaselineWarning([chunk])) {
    if (typeof callback === 'function') {
      callback()
    }

    return true
  }

  return originalStdoutWrite(chunk, encoding, callback)
})

process.stderr.write = ((chunk, encoding, callback) => {
  if (shouldFilterBaselineWarning([chunk])) {
    if (typeof callback === 'function') {
      callback()
    }

    return true
  }

  return originalStderrWrite(chunk, encoding, callback)
})

process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA = 'true'
process.env.BROWSERSLIST_IGNORE_OLD_DATA = 'true'
process.argv = [process.argv[0], nextBin, 'build']

await import(pathToFileURL(nextBin).href)

function shouldFilterBaselineWarning(args) {
  return args.some((value) => {
    if (typeof value === 'string') {
      return value.includes('baseline-browser-mapping')
    }

    if (Buffer.isBuffer(value)) {
      return value.toString('utf8').includes('baseline-browser-mapping')
    }

    return false
  })
}