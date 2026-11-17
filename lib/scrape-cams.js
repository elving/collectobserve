const { randomUUID } = require('node:crypto')
const { mkdir, rename, rm, writeFile } = require('node:fs/promises')
const path = require('node:path')
const cheerio = require('cheerio')

const directory = 'https://www.opentopia.com'
const viewModes = { livefeed: 'savedstill', livestill: 'livestill' }

async function getPage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return cheerio.load(await response.text())
}

async function getCamera(url, mode) {
  const page = new URL(url)
  page.searchParams.set('viewmode', viewModes[mode])
  const $ = await getPage(page)
  const image = $(mode === 'livestill' ? '.big img#stillimage' : '.big img').first().attr('src')
  const feed = image?.trim() && URL.parse(image.trim(), page)
  if (!feed || !['http:', 'https:'].includes(feed.protocol)) return null

  const info = $('#caminfo')
  return {
    url,
    feed: feed.href,
    city: info.find('label.locality').text().trim(),
    region: info.find('label.region').text().trim(),
    country: info.find('label.country-name').text().trim(),
    facility: info.find('label.right').first().text().trim(),
    coordinates: {
      latitude: info.find('.latitude').text().trim(),
      longitude: info.find('.longitude').text().trim(),
    },
  }
}

module.exports = async (mode = 'livestill', pages = 150) => {
  pages = Number(pages)
  if (!Object.hasOwn(viewModes, mode)) throw new Error('Camera mode must be livefeed or livestill')
  if (!Number.isSafeInteger(pages) || pages < 1) throw new Error('Page count must be a positive integer')

  const seen = new Set()
  const all = []
  for (let page = 1; page <= pages; page++) {
    const listing = new URL('/hiddencam.php', directory)
    listing.search = new URLSearchParams({ showmode: 'standard', country: '*', seewhat: 'newest', p: page })
    const $ = await getPage(listing)
    const urls = $('.camgrid3 a[href]').toArray().flatMap(element => {
      const url = URL.parse($(element).attr('href'), listing)
      return url?.origin === directory && /^\/webcam\/\d+\/?$/.test(url.pathname)
        ? [`${url.origin}${url.pathname}`]
        : []
    })
    let added = 0
    for (const url of urls) {
      if (seen.has(url)) continue
      seen.add(url)
      added++
      try {
        const camera = await getCamera(url, mode)
        if (camera) all.push(camera)
      } catch (error) {
        console.warn(`Could not read ${url}: ${error.message}`)
      }
    }
    if (added === 0) break
    console.log(`Scraped catalog page ${page} (${all.length} cameras so far)`)
  }

  if (all.length === 0) throw new Error(`OpenTopia returned no ${mode} cameras`)
  const output = path.resolve(__dirname, `../tmp/cams-${mode}.json`)
  await mkdir(path.dirname(output), { recursive: true })
  const staging = `${output}.${randomUUID()}.tmp`
  try {
    await writeFile(staging, `${JSON.stringify({ all }, null, 2)}\n`, { flag: 'wx' })
    await rename(staging, output)
  } finally {
    await rm(staging, { force: true })
  }
  console.log(`Saved ${all.length} cameras to ${output}`)
}
