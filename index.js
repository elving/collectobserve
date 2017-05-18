require('dotenv').load()

const fs = require('fs-extra')
const path = require('path')
const Twit = require('twit')

const tweetGif = require('./lib/tweet-gif')
const generateGif = require('./lib/generate-gif')
const generateStatus = require('./lib/generate-status')

let intervalId = null

const broadcast = async () => {
  console.log('starting new broadcast...')

  try {
    const gif = await generateGif()
    const status = generateStatus()

    try {
      await tweetGif(status, gif.path, gif.cam)
    } catch(err) {
      console.error(err)
      startBroadcast()
    }
  } catch (err) {
    console.error(err)
    startBroadcast()
  }
}

const startBroadcast = () => {
  clearInterval(intervalId)
  intervalId = setInterval(broadcast, 600000)
  broadcast()
}

startBroadcast()

process.on('uncaughtException', (err) => {
  startBroadcast()
})

process.on('rejectionHandled', (err) => {
  startBroadcast()
})

process.on('unhandledRejection', (err) => {
  startBroadcast()
})
