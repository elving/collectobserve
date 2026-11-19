const { execFile } = require('node:child_process')
const { rename } = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const generateGif = require('../lib/generate-gif')
const generateStatus = require('../lib/generate-status')
const publishToBuffer = require('../lib/publish-to-buffer')

const exec = promisify(execFile)
const mediaTag = 'collectobserve-media'
const mediaRetentionMs = 14 * 24 * 60 * 60 * 1000

async function pruneOldAssets(repo) {
  const { stdout } = await exec('gh', ['release', 'view', mediaTag, '--repo', repo, '--json', 'assets'])
  for (const asset of JSON.parse(stdout).assets) {
    if (/^collectobserve-\d+\.gif$/.test(asset.name) && Date.now() - Date.parse(asset.createdAt) > mediaRetentionMs) {
      await exec('gh', ['release', 'delete-asset', mediaTag, asset.name, '--repo', repo, '--yes'])
    }
  }
}

async function main() {
  const { BUFFER_API_KEY: key, BUFFER_CHANNEL_ID: channelId, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: runId } = process.env
  const preview = process.argv.includes('--preview')
  if (!preview && (!key || !channelId || !repo || !/^\d+$/.test(runId ?? ''))) {
    throw new Error('Publishing requires Buffer credentials and a GitHub Actions run')
  }
  const gif = await generateGif({ feed: process.env.CAM_FEED, history: true })
  console.log(`Captured GIF from ${gif.cam.feed}`)
  const text = generateStatus()
  if (preview) {
    console.log(`Preview saved to ${gif.path}`)
    return
  }

  // Upload without --clobber so the same workflow run cannot submit a second post.
  const name = `collectobserve-${runId}.gif`
  const asset = path.join(path.dirname(gif.path), name)
  await rename(gif.path, asset)
  await exec('gh', ['release', 'upload', mediaTag, asset, '--repo', repo])
  await publishToBuffer(key, channelId, text, `https://github.com/${repo}/releases/download/${mediaTag}/${name}`)
  await pruneOldAssets(repo)
}

main().catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
