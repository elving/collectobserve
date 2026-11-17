const { rm } = require('node:fs/promises')
const path = require('node:path')
const { setTimeout: delay } = require('node:timers/promises')
const { parseArgs } = require('node:util')

const createPublisher = require('./lib/tweet-gif')
const generateGif = require('./lib/generate-gif')
const generateStatus = require('./lib/generate-status')

async function main() {
  const { values: { preview } } = parseArgs({ options: { preview: { type: 'boolean' } } })
  const captureOptions = { feed: process.env.CAM_FEED, catalog: process.env.CAM_CATALOG }

  if (preview) {
    const gif = await generateGif(captureOptions)
    generateStatus()
    console.log(`Preview saved to ${gif.path}`)
    return
  }

  const publish = createPublisher(process.env)
  while (true) {
    console.log('\nstarting new broadcast...')
    let gif
    try {
      gif = await generateGif(captureOptions)
      await publish(generateStatus(), gif.path, gif.cam)
    } catch (error) {
      console.error(`Broadcast failed: ${error.message}`)
    } finally {
      if (gif) await rm(path.dirname(gif.path), { recursive: true, force: true })
    }
    await delay(600000)
  }
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
