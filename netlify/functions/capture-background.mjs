import { randomUUID, timingSafeEqual } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import binary from 'ffmpeg-static'
import catalog from '../../data/cams-livefeed.json' with { type: 'json' }
import { getMediaStore, hourMs, publishingEnabled } from '../../lib/netlify-media.mjs'
import generateGif from '../../lib/generate-gif.js'
import generateStatus from '../../lib/generate-status.js'
import publishToBuffer from '../../lib/publish-to-buffer.js'

export const config = { background: true }

function allowed(request, secret) {
  if (request.method !== 'POST' || !secret) return false
  const expected = Buffer.from(secret)
  const supplied = Buffer.from(request.headers.get('x-collectobserve-job-key') || '')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

function clearExpired(store) {
  const cutoff = Date.now() - 48 * hourMs
  return Promise.all(['media/', 'hour/'].map(async prefix => {
    const { blobs } = await store.list({ prefix })
    await Promise.all(blobs.filter(({ key }) => Number(key.slice(prefix.length, prefix.length + 13)) < cutoff)
      .map(({ key }) => store.delete(key)))
  }))
}

export default async function capture(request, context) {
  const { COLLECTOBSERVE_JOB_KEY, BUFFER_API_KEY, BUFFER_CHANNEL_ID } = process.env
  if (!allowed(request, COLLECTOBSERVE_JOB_KEY)) {
    console.warn('Capture declined because job authentication failed')
    return new Response(null, { status: 401 })
  }
  const { preview, hour } = await request.json().catch(() => ({})) ?? {}
  const store = getMediaStore()
  if (preview !== true && (hour !== Math.floor(Date.now() / hourMs) * hourMs || !await publishingEnabled(store))) {
    return new Response(null, { status: 204 })
  }
  if (preview !== true && (!BUFFER_API_KEY || !BUFFER_CHANNEL_ID)) throw new Error('Missing Buffer publishing credentials')

  const slot = `hour/${hour}`
  if (preview !== true && await store.getMetadata(slot)) return new Response(null, { status: 204 })

  const gif = await generateGif({ catalog, history: true, workDir: tmpdir(), binary })
  const filename = `${Date.now()}-${randomUUID()}.gif`
  try {
    await store.set(`media/${filename}`, new Blob([await readFile(gif.path)], { type: 'image/gif' }))
  } finally {
    await rm(path.dirname(gif.path), { recursive: true, force: true })
  }
  const url = new URL(`/media/${filename}`, context.site.url)
  url.protocol = 'https:'
  console.log(`Captured GIF from ${gif.cam.feed}: ${url.href}`)

  // Reserve the hour before calling Buffer so a delivery retry can't send it twice.
  if (preview !== true && (await store.set(slot, url.href, { onlyIfNew: true })).modified) {
    await publishToBuffer(BUFFER_API_KEY, BUFFER_CHANNEL_ID, generateStatus(), url.href)
  }
  await clearExpired(store).catch(error => console.warn(`Could not prune old GIFs: ${error.message}`))
  return new Response(null, { status: 204 })
}
