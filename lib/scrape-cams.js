const fs = require('fs-extra')
const path = require('path')
const async = require('async')
const random = require('lodash/random')
const flatten = require('lodash/flatten')
const request = require('request')
const cheerio = require('cheerio')
const jsonfile = require('jsonfile')

let page = 1
let camUrls = []
const cams = { all: [] }
const getCamsUrl = () => `http://www.opentopia.com/hiddencam.php?showmode=standard&country=*&seewhat=newest&p=${page}`

// Mode can be 'livestill' or 'livefeed'
module.exports = scrapeCams(mode='livestill', pages = 150) => {
  const camsPath = path.resolve(__dirname, `../data/cams-${mode}.json`)
  const camsPageUrl = getCamsUrl()

  request(camsPageUrl, (error, response, body) => {
    if (!error) {
      const $ = cheerio.load(body)
      const camSeries = []

      $('.camgrid3 a').each((i, el) => {
        const href = $(el).attr('href')
        camUrls.push(`http://www.opentopia.com${href}?viewmode=${mode}`)
      })

      camUrls.forEach((camUrl) => {
        camSeries.push((callback) => {
          request(camUrl, (error, response, body) => {
            const $ = cheerio.load(body)

            if (!error) {
              console.log(`scraped -> ${camUrl}`)

              const url = $('#caminfo label.right').eq(5).find('a').attr('src')
              const feed = $('.big img').attr('src')
              const city = $('#caminfo label.locality').text()
              const region = $('#caminfo label.region').text()
              const country = $('#caminfo label.country-name').text()
              const facility = $('#caminfo label.right').eq(0).text()
              const coordinates = $('#caminfo label.geo')
              const latitude = coordinates.find('.latitude').text()
              const longitude = coordinates.find('.longitude').text()

              callback(null, {
                url: url ? url.trim() : '',
                feed: feed ? feed.trim() : '',
                city: city ? city.trim() : '',
                region: region ? region.trim() : '',
                country: country ? country.trim() : '',
                facility: facility ? facility.trim() : '',
                coordinates: {
                  latitude: latitude ? latitude.trim() : '',
                  longitude: longitude ? longitude.trim() : ''
                }
              })
            } else {
              console.error(`scraping error -> ${camUrl} \n`)
              console.error(error)
              callback(null)
            }
          })
        })
      })

      async.series(camSeries, (error, results) => {
        if (error) {
          console.error(`\n scraping error -> ${camsPageUrl} \n`)
          console.error(error)
        } else {
          cams.all = flatten([cams.all, results])

          if (page <= pages) {
            console.log(`\n scraped -> ${camsPageUrl} \n`)

            page += 1
            camUrls = []

            jsonfile.writeFileSync(camsPath, cams, { spaces: 2 })
            scrapeCams(mode, pages)
          } else {
            jsonfile.writeFileSync(camsPath, cams, { spaces: 2 })
            console.log(`\n ${cams.all.length} cams collected.`)
          }
        }
      })
    } else {
      console.error(`\n scraping error -> ${camsPageUrl} \n`)
      console.error(error)
    }
  })
}
