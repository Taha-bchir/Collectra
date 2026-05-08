const fetch = globalThis.fetch || require('node-fetch')
const fs = require('fs')

// Load .env.development from repo root (simple parse)
const envText = fs.readFileSync('.env.development', 'utf8')
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map(line => {
  const idx = line.indexOf('=')
  if (idx === -1) return [line, '']
  const k = line.slice(0, idx).trim()
  const v = line.slice(idx + 1).trim()
  return [k, v]
}))

const BREVO_API_KEY = env.BREVO_API_KEY
const SENDER = env.BREVO_SENDER_EMAIL || 'noreply@collectra.xyz'

async function main() {
  if (!BREVO_API_KEY) {
    console.error('Missing BREVO_API_KEY in .env.development')
    process.exit(2)
  }

  const body = {
    sender: { email: SENDER, name: 'Collectra' },
    to: [{ email: 'you@example.com', name: 'Test Recipient' }],
    subject: 'Collectra debug test',
    htmlContent: '<p>Debug test</p>',
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    console.log('status', res.status)
    console.log('ok', res.ok)
    console.log('body', text)
  } catch (err) {
    console.error('request error', err)
    process.exit(1)
  }
}

main()
