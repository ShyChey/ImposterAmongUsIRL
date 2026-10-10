const test = require('node:test')
const assert = require('node:assert/strict')
const { determineWinner, resolveVotes, isDeadlineReached } = require('../lib/game-rules')

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

test('the highest vote ejects a living player', () => {
  const players = [{ id: 'a', name: 'A', status: 'alive' }, { id: 'b', name: 'B', status: 'alive' }, { id: 'c', name: 'C', status: 'alive' }]
  const result = resolveVotes(players, [{ voter_id: 'a', target_id: 'b' }, { voter_id: 'b', target_id: 'c' }, { voter_id: 'c', target_id: 'b' }])
  assert.equal(result.ejectedId, 'b')
  assert.deepEqual(result.summary, { A: 0, B: 2, C: 1, Skip: 0 })
})

test('a tied vote or skipped vote ejects no one', () => {
  const players = [{ id: 'a', name: 'A', status: 'alive' }, { id: 'b', name: 'B', status: 'alive' }]
  assert.equal(resolveVotes(players, [{ voter_id: 'a', target_id: 'b' }, { voter_id: 'b', target_id: 'a' }]).ejectedId, null)
  assert.equal(resolveVotes(players, [{ voter_id: 'a', target_id: null }]).ejectedId, null)
})

test('votes from dead players are ignored', () => {
  const players = [{ id: 'a', name: 'A', status: 'alive' }, { id: 'b', name: 'B', status: 'alive' }, { id: 'd', name: 'D', status: 'dead' }]
  const result = resolveVotes(players, [{ voter_id: 'd', target_id: 'a' }, { voter_id: 'a', target_id: 'b' }])
  assert.equal(result.ejectedId, 'b')
  assert.equal(result.summary.A, 0)
})

test('a meeting deadline resolves even if not every player voted', () => {
  const now = Date.parse('2026-10-09T18:00:00.000Z')
  assert.equal(isDeadlineReached('2026-10-09T17:59:59.000Z', now), true)
  assert.equal(isDeadlineReached('2026-10-09T18:00:01.000Z', now), false)
})
