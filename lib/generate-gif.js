const fs = require('fs-extra')
const get = require('lodash/get')
const size = require('lodash/size')
const path = require('path')
const last = require('lodash/last')
const async = require('async')
const split = require('lodash/split')
const random = require('lodash/random')
const isEmpty = require('lodash/isEmpty')
const replace = require('lodash/replace')
const request = require('request')
const easyimg = require('easyimage')
const jsonfile = require('jsonfile')
const GIFEncoder = require('gifencoder')
const pngFileStream = require('png-file-stream')

let frame = 1
let lastEffect

const data = jsonfile.readFileSync(
  path.resolve(__dirname, '../data/cams-livestill.json')
)

const cams = get(data, 'all', [])
const randomCam = () => cams[random(0, size(cams) - 1)]

const generateImage = cam => (
  new Promise((resolve, reject) => {
    const camFeed = get(cam, 'feed')

    if (isEmpty(camFeed)) {
      return reject(new Error('"camFeed" is empty'))
    }

    const imageName = replace(last(split(camFeed, '/')), /\?.+/, '')

    if (isEmpty(imageName)) {
      return reject(new Error('"imageName" is empty'))
    }

    const imagePath = path.resolve(__dirname, `../tmp/${imageName}`)
    const imageWriteStream = fs.createWriteStream(imagePath)

    imageWriteStream.on('finish', () => {
      easyimg
        .convert({
          src: imagePath,
          dst: path.resolve(__dirname, `../tmp/frame-${frame}.png`),
          quality: 100,
        })
        .then((image) => {
          easyimg
            .resize({
              src: image.path,
              dst: image.path,
              width: 350,
              height: 350,
            })
            .then((image) => {
              return resolve(image)
            })
            .catch((err) => {
              return reject(err)
            })
        })
        .catch((err) => {
          return reject(err)
        })
    })

    imageWriteStream.on('error', (err) => {
      return reject(err)
    })

    request(camFeed, {
      timeout: 30000,
    })
    .on('error', (err) => {
      return reject(err)
    })
    .pipe(imageWriteStream)
  })
)

module.exports = () => (
  new Promise((resolve, reject) => {
    const cam = randomCam()
    const isntLastFrame = () => frame <= 5

    const generateFrame = (next) => {
      generateImage(cam)
        .then((image) => {
          frame++
          return next(null, image)
        })
        .catch((err) => {
          return next(err)
        })
    }

    console.log(`generating gif from: ${cam.feed}`)

    async.whilst(isntLastFrame, generateFrame, (err, image) => {
      if (err) {
        return reject(err)
      } else {
        const gifPath = path.resolve(__dirname, '../tmp/cam.gif')
        const encoder = new GIFEncoder(image.width, image.height)

        pngFileStream(path.resolve(__dirname, '../tmp/frame-?.png'))
          .pipe(encoder.createWriteStream({
            delay: 250,
            repeat: 0,
            quality: 10,
          }))
          .pipe(fs.createWriteStream(gifPath))
          .on('finish', () => {
            console.log(`generated gif`)
            frame = 1
            return resolve({ cam, path: gifPath })
          })
          .on('error', (err) => {
            return reject(err)
          })
      }
    })
  })
)
