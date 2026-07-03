// One-time setup: adds Google Docs env vars to Vercel
// Usage: node setup-vercel-env.js YOUR_VERCEL_TOKEN
// Get token from: https://vercel.com/account/tokens

const fs    = require('fs')
const https = require('https')

const TOKEN = process.argv[2]
if (!TOKEN) {
  console.error('\nUsage: node setup-vercel-env.js YOUR_VERCEL_TOKEN')
  console.error('Get token: https://vercel.com/account/tokens → Create → copy it\n')
  process.exit(1)
}

const PROJECT_ID = 'prj_EF7xKMQavzIwRvat8f6LRdPNX6V0'
const TARGET     = ['production', 'preview', 'development']

const serviceAccountPath = './navi-499311-52b8621e9899.json'
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`\nCannot find ${serviceAccountPath}`)
  console.error('Make sure you run this from inside the navi folder.\n')
  process.exit(1)
}

const serviceAccountJson = fs.readFileSync(serviceAccountPath, 'utf8').trim()

const ENV_VARS = [
  { key: 'GOOGLE_SERVICE_ACCOUNT_JSON', value: serviceAccountJson, type: 'encrypted' },
  { key: 'GOOGLE_SHARE_EMAIL',           value: 'brendacwk@gmail.com', type: 'plain' },
]

function post(path, body) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body)
    const req = https.request(
      {
        hostname: 'api.vercel.com',
        path,
        method: 'POST',
        headers: {
          Authorization:    `Bearer ${TOKEN}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(raw),
        },
      },
      res => {
        let data = ''
        res.on('data', d => (data += d))
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }))
      }
    )
    req.on('error', reject)
    req.write(raw)
    req.end()
  })
}

async function run() {
  console.log('\n── Adding Vercel environment variables ──\n')

  for (const v of ENV_VARS) {
    const { status, body } = await post(
      `/v10/projects/${PROJECT_ID}/env`,
      { key: v.key, value: v.value, type: v.type, target: TARGET }
    )

    if (status >= 200 && status < 300) {
      console.log(`✅  ${v.key}`)
    } else if (body.error?.code === 'ENV_ALREADY_EXISTS') {
      console.log(`⚠️  ${v.key} already exists — skipped (update it manually if needed)`)
    } else {
      console.log(`❌  ${v.key}: ${body.error?.message ?? JSON.stringify(body)}`)
    }
  }

  console.log('\n── Done ──')
  console.log('Vercel will use the new vars on next deploy.')
  console.log('Trigger one now: https://vercel.com/dashboard → Navi → Deployments → Redeploy\n')
}

run().catch(console.error)
