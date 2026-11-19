import { hourMs, publishingEnabled } from '../../lib/netlify-media.mjs'

export const config = { schedule: '13 * * * *' }

export default async function dispatch(_request, context) {
  if (!await publishingEnabled()) return new Response(null, { status: 204 })

  const jobKey = process.env.COLLECTOBSERVE_JOB_KEY
  if (!jobKey) throw new Error('Scheduled publishing requires COLLECTOBSERVE_JOB_KEY')
  const hour = Math.floor(Date.now() / hourMs) * hourMs
  const endpoint = new URL('/.netlify/functions/capture-background', context.site.url)
  endpoint.protocol = 'https:'
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'X-CollectObserve-Job-Key': jobKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ hour }),
    signal: AbortSignal.timeout(10000),
  })
  if (response.status !== 202) throw new Error(`Capture dispatch returned HTTP ${response.status}`)
  console.log(`Capture queued for ${new Date(hour).toISOString()}`)
  return new Response(null, { status: 204 })
}
