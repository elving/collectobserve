const head = require('lodash/head')
const path = require('path')
const join = require('lodash/join')
const times = require('lodash/times')
const split = require('lodash/split')
const random = require('lodash/random')
const sample = require('lodash/sample')
const flatten = require('lodash/flatten')
const replace = require('lodash/replace')
const trimEnd = require('lodash/trimEnd')
const toUpper = require('lodash/toUpper')
const jsonfile = require('jsonfile')

const terms = jsonfile.readFileSync(
  path.resolve(__dirname, '../data/terms.json')
)

const allTerms = flatten([
  terms.birds,
  terms.demons,
  terms.biases,
  terms.phobias,
  terms.viruses,
  terms.negative,
  terms.movieScores,
  terms.mentalDisorders,
  terms.phoneticAlphabet,
  terms.militaryOperations,
])

const randomDate = () => {
  const end = new Date(1999, 1, 1)
  const start = new Date(1950, 1, 1)

  const date = new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  )

  const day = date.getDay()
  const time = head(split(date.toTimeString(), ' '))
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  return `${month}.${day}.${year} ${time}`
}

const randomYear = () => (
  random(1980, 2000)
)

const randomYears = () => (
  `${randomYear()} ${randomYear()} ${randomYear()} ${randomYear()}`
)

const word = () => (
  sample(allTerms)
)

const words = () => (
  `${word()} ${word()} ${word()}`
)

const wordNoSpaces = () => (
  replace(word(), ' ', '')
)

const wordWithDate = () => (
  `${word()} ${randomDate()}`
)

const wordsWithDate = () => (
  `${words()} ${randomDate()}`
)

const wordNoSpacesWithDate = () => (
  `${wordNoSpaces()} ${randomDate()}`
)

const movieScores = () => (
  sample(terms.movieScores)
)

const disorder = () => (
  sample(terms.mentalDisorders)
)

const phobia = () => (
  sample(terms.phobias)
)

const bias = () => (
  sample(terms.biases)
)

const bird = () => (
  sample(terms.birds)
)

const negative = () => (
  sample(terms.negative)
)

const virus = () => (
  sample(terms.viruses)
)

const demon = () => (
  sample(terms.demons)
)

const phonetic = () => (
  sample(terms.phoneticAlphabet)
)

const phoneticAlphabet = () => (
  trimEnd(join(times(random(1, 10), `${phonetic()} `), ''))
)

const phoneticAlphabetNoSpaces = () => (
  join(times(random(1, 10), phonetic()), '')
)

const phoneticAlphabetWithDate = () => (
  `${phoneticAlphabet()} ${randomDate()}`
)

const phoneticAlphabetNoSpacesWithDate = () => (
  `${phoneticAlphabetNoSpaces()} ${randomDate()}`
)

const numberStationLine = () => {
  const _number = () => (
    random(1000, 9999)
  )

  const _phonetic = () => (
    toUpper(phonetic())
  )

  return random(1, 2) === 1
    ? `${_number()} ${_number()} ${_number()} ${_number()}`
    : `${_phonetic()} ${_phonetic()} ${_phonetic()} ${_phonetic()}`
}

const numberStation = () => (`
${numberStationLine()}
${numberStationLine()}
${numberStationLine()}
${numberStationLine()}
`)

const randomNumber = () => (
  join(times(random(1, 10), (() => random(1, 10))), '')
)

const randomNumberWithDate = () => (
  `${randomNumber()} ${randomDate()}`
)

const textGenerationMethods = [
  word,
  bias,
  bird,
  words,
  virus,
  demon,
  phobia,
  disorder,
  negative,
  randomDate,
  movieScores,
  randomYears,
  randomNumber,
  wordNoSpaces,
  wordWithDate,
  wordsWithDate,
  numberStation,
  phoneticAlphabet,
  randomNumberWithDate,
  wordNoSpacesWithDate,
  phoneticAlphabetNoSpaces,
  phoneticAlphabetWithDate,
  phoneticAlphabetNoSpacesWithDate,
]

const randomTextGenerationMethod = () => (
  sample(textGenerationMethods)
)

module.exports = () => {
  console.log('generating status')

  const method = randomTextGenerationMethod()
  const generatedText = method ? method() : ''

  if (generatedText) {
    console.log(`status generated: ${generatedText}`)
    return generatedText
  } else {
    console.log('status generated: observe')
    return 'observe'
  }
}
