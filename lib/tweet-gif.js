const { TwitterApi } = require('twitter-api-v2')

module.exports = ({ CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET }) => {
  const required = { CONSUMER_KEY, CONSUMER_SECRET, TOKEN, TOKEN_SECRET }
  const missing = Object.keys(required).filter(name => !required[name]?.trim())
  if (missing.length) {
    throw new Error(`Missing X credentials: ${missing.join(', ')}. Run npm run preview to generate a local GIF.`)
  }

  const client = new TwitterApi({
    appKey: CONSUMER_KEY,
    appSecret: CONSUMER_SECRET,
    accessToken: TOKEN,
    accessSecret: TOKEN_SECRET,
  }, {
    plugins: [{
      onBeforeRequest({ requestOptions }) {
        requestOptions.timeout ??= 60000
      },
    }],
  })

  return async (status, gifPath, cam) => {
    const mediaId = await client.v2.uploadMedia(gifPath, {
      media_type: 'image/gif',
      media_category: 'tweet_gif',
    })
    const { data } = await client.v2.tweet({ text: status, media: { media_ids: [mediaId] } })
    console.log(`broadcasted: https://x.com/i/status/${data.id}`)

    const { coordinates, region, country, facility } = cam
    let location = facility || 'Everywhere'
    if (coordinates?.latitude && coordinates?.longitude) {
      location = `${coordinates.latitude}, ${coordinates.longitude}`
    } else if (region && country) {
      location = `${region}, ${country}`
    }

    try {
      await client.v1.updateAccountProfile({ location })
      console.log(`updated location: ${location}`)
    } catch (error) {
      console.warn(`Profile location update failed: ${error.message}`)
    }
    return data
  }
}
