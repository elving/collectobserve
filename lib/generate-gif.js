const { execFile } = require('node:child_process')
const { mkdir, mkdtemp, readFile, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')
const { promisify } = require('node:util')
const sampleSize = require('lodash/sampleSize')

const exec = promisify(execFile)
const tmp = path.resolve(__dirname, '../tmp')
const defaultCatalog = path.resolve(__dirname, '../data/cams-livefeed.json')
const frameCount = 5
const frameDurationMs = 1000
const maxImageBytes = 8 * 1024 * 1024

async function ffmpeg(args) {
  try {
    await exec('ffmpeg', ['-nostdin', '-loglevel', 'error', ...args], { timeout: 20000 })
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('FFmpeg is required. Install it and make sure ffmpeg is on PATH.', { cause: error })
    }
    throw error
  }
}

async function downloadImage(feed, destination) {
  const response = await fetch(feed, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    throw new Error(`Camera returned HTTP ${response.status}`)
  }

  let size = 0
  const chunks = []
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > maxImageBytes) throw new Error('Camera image exceeds 8 MB')
    chunks.push(chunk)
  }
  await writeFile(destination, Buffer.concat(chunks, size))
}

async function historicalFeeds(feed) {
  const id = /^https:\/\/images\.opentopia\.com\/cams\/(\d+)\/big\.jpg$/.exec(feed)?.[1]
  if (!id) throw new Error('A hosted capture requires an OpenTopia snapshot feed')

  const page = await fetch(`https://www.opentopia.com/webcam/${id}?viewmode=animated`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!page.ok) throw new Error(`OpenTopia camera page returned HTTP ${page.status}`)
  const matcher = new RegExp(`https://images\\.opentopia\\.com/cams/${id}/(\\d+)\\.jpg`, 'g')
  const snapshots = [...new Set([...(await page.text()).matchAll(matcher)].map(match => match[0]))]
  return snapshots.sort().reverse()
}

async function captureGif(cam, directory, history) {
  const source = path.join(directory, 'snapshot')
  const gif = path.join(directory, 'cam.gif')
  let dimensions = '350:350'
  const feeds = history ? await historicalFeeds(cam.feed) : Array(frameCount).fill(cam.feed)
  const frames = []
  for (const feed of feeds) {
    if (!history && frames.length > 0) await delay(frameDurationMs)
    await downloadImage(feed, source)

    const output = path.join(directory, `frame-${frames.length}.png`)
    const fit = `scale=${dimensions}:force_original_aspect_ratio=decrease`
    const filter = frames.length === 0 ? fit : `${fit},pad=${dimensions}:(ow-iw)/2:(oh-ih)/2`
    await ffmpeg([
      '-protocol_whitelist', 'file',
      '-format_whitelist', 'image2,jpeg_pipe,png_pipe,webp_pipe,gif,bmp_pipe,tiff_pipe',
      '-i', source, '-frames:v', '1', '-vf', `${filter},format=rgb24,setsar=1`, '-update', '1', '-y', output,
    ])

    const png = await readFile(output)
    if (frames.length === 0) {
      // The PNG header stores width and height at bytes 16 and 20.
      dimensions = `${png.readUInt32BE(16)}:${png.readUInt32BE(20)}`
    }
    if (history && frames.some(previous => previous.equals(png))) continue
    frames.push(png)
    if (frames.length === frameCount) break
  }

  if (frames.length !== frameCount) throw new Error('OpenTopia did not have five distinct snapshots')
  if (history) {
    await Promise.all(frames.reverse().map((png, frame) => writeFile(path.join(directory, `frame-${frame}.png`), png)))
  }

  await ffmpeg([
    '-framerate', `1000/${frameDurationMs}`, '-i', path.join(directory, 'frame-%d.png'),
    '-filter_complex', '[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse',
    '-gifflags', '0', '-loop', '0', '-final_delay', String(frameDurationMs / 10), gif,
  ])
  return gif
}

function usableCamera(cam) {
  const url = URL.parse(cam?.feed ?? '')
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
  if (url.hostname === 'images.opentopia.com') url.protocol = 'https:'
  return { ...cam, feed: url.href }
}

module.exports = async ({ feed, catalog = defaultCatalog, history = false } = {}) => {
  const entries = feed ? [{ feed }] : JSON.parse(await readFile(catalog, 'utf8')).all
  if (!Array.isArray(entries)) throw new Error('Camera catalog must contain an "all" array')
  const cameras = sampleSize(entries.map(usableCamera).filter(Boolean), 5)
  if (cameras.length === 0) throw new Error('No HTTP or HTTPS camera feeds are configured')

  await mkdir(tmp, { recursive: true })
  const failures = []
  for (const cam of cameras) {
    const directory = await mkdtemp(path.join(tmp, 'capture-'))
    try {
      const gif = await captureGif(cam, directory, history)
      // A preview needs only the finished GIF.
      await rm(path.join(directory, 'snapshot'))
      await Promise.all(Array.from({ length: frameCount }, (_, frame) => (
        rm(path.join(directory, `frame-${frame}.png`))
      )))
      return { cam, path: gif }
    } catch (error) {
      await rm(directory, { recursive: true, force: true })
      if (error.cause?.code === 'ENOENT') throw error
      failures.push(error.message)
    }
  }

  throw new Error(`Could not capture a GIF from ${cameras.length} camera(s)\n${failures.join('\n')}`)
}
