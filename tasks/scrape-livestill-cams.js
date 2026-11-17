const scrapeCams = require('../lib/scrape-cams')

scrapeCams('livestill', process.argv[2]).catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
