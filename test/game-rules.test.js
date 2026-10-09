const test = require('node:test')
const assert = require('node:assert/strict')
const { determineWinner } = require('../lib/game-rules')

const player = (role, status = 'alive') => ({ role, status })

test('crewmates win after every imposter is ejected', () => {
  assert.equal(determineWinner([player('imposter', 'ejected'), player('crewmate'), player('crewmate')], []), 'crewmates')
})

test('imposters win at parity with crewmates', () => {
  assert.equal(determineWinner([player('imposter'), player('crewmate')], []), 'imposters')
})

test('crewmates win when all assigned tasks are complete', () => {
  assert.equal(determineWinner([player('imposter'), player('crewmate'), player('crewmate')], [{ is_completed: true }, { is_completed: true }]), 'crewmates')
})

test('an incomplete task does not end the game', () => {
  assert.equal(determineWinner([player('imposter'), player('crewmate'), player('crewmate')], [{ is_completed: true }, { is_completed: false }]), null)
})
