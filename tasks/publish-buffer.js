const { execFile } = require('node:child_process')
const { rename } = require('node:fs/promises')
const path = require('node:path')
const { promisify } = require('node:util')
const generateGif = require('../lib/generate-gif')
const generateStatus = require('../lib/generate-status')

const exec = promisify(execFile)
const mediaTag = 'collectobserve-media'
const mediaRetentionMs = 14 * 24 * 60 * 60 * 1000
const fields = 'id status externalLink error { message }'

async function publishToBuffer(key, channelId, text, url) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query: `mutation ($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { ${fields} } }
          ... on MutationError { message }
        }
      }`,
      variables: { input: {
        channelId, text, schedulingType: 'automatic', mode: 'shareNow', assets: [{ image: { url } }],
      } },
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Buffer returned HTTP ${response.status}`)
  const { data, errors } = await response.json()
  const result = data?.createPost
  if (errors?.length || !result?.post) {
    throw new Error(errors?.[0]?.message || result?.message || 'Buffer did not return a post')
  }
  if (result.post.status === 'error') throw new Error(result.post.error?.message || 'Buffer could not publish the post')
  console.log(`Buffer ${result.post.status}: ${result.post.externalLink || result.post.id}`)
}

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
  const feed = process.env.CAM_FEED || 'https://images.opentopia.com/cams/19458/big.jpg'
  const gif = await generateGif({ feed, history: true })
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
