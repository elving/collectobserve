module.exports = async function publishToBuffer(key, channelId, text, url) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query: `mutation ($input: CreatePostInput!) {
        createPost(input: $input) {
          ... on PostActionSuccess { post { id status externalLink error { message } } }
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
