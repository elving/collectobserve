const scrapeCams = require('../lib/scrape-cams')

scrapeCams('livefeed', process.argv[2]).catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
