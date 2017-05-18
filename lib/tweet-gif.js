const fs = require('fs-extra')
const get = require('lodash/get')
const path = require('path')
const Twit = require('twit')

const Twitter = new Twit({
  timeout_ms: (60 * 1000),
  access_token: process.env.TOKEN,
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token_secret: process.env.TOKEN_SECRET,
})

module.exports = (status, gifPath, cam) => (
  new Promise((resolve, reject) => {
    let location = 'Everywhere'

    const city = get(cam, 'city')
    const region = get(cam, 'region')
    const country = get(cam, 'country')
    const facility = get(cam, 'facility')
    const latitude = get(cam, 'coordinates.latitude')
    const longitude = get(cam, 'coordinates.longitude')

    if (latitude && longitude) {
      location = `${latitude}, ${longitude}`
    } else if (country && region) {
      location = `${region}, ${country}`
    } else if (facility) {
      location = facility
    }

    fs.readFile(gifPath, {
      encoding: 'base64',
    }, (err, b64content) => {
      if (!err && b64content) {
        Twitter.post('media/upload', {
          media_data: b64content
        }, (err, data) => {
          if (err) {
            return reject(err)
          }

          Twitter.post('statuses/update', {
            status,
            media_ids: [data.media_id_string],
          }, (err, data, resp) => {
            if (err) {
              return reject(err)
            } else if (data) {
              console.log(`broadcasted: https://twitter.com/collectobserve/status/${data.id_str}`)

              Twitter.post('account/update_profile', {
                location
              }, (err) => {
                if (!err) {
                  console.log(`updated location: ${location}`)
                }
              })

              fs.emptyDir(path.resolve(__dirname, '../tmp'))
            }
          })
        })
      } else {
        return reject(err)
      }
    })
  })
)
