function determineWinner(players, tasks) {
  const alive = players.filter((player) => player.status === 'alive')
  const imposters = alive.filter((player) => player.role === 'imposter')
  const crewmates = alive.filter((player) => player.role === 'crewmate')

  if (imposters.length === 0) return 'crewmates'
  if (imposters.length >= crewmates.length) return 'imposters'
  if (tasks.length > 0 && tasks.every((task) => task.is_completed)) return 'crewmates'
  return null
}

function resolveVotes(players, votes) {
  const alive = players.filter((player) => player.status === 'alive')
  const allowedVoters = new Set(alive.map((player) => player.id))
  const allowedTargets = new Set(alive.map((player) => player.id))
  const counts = new Map([...alive.map((player) => [player.id, 0]), ['skip', 0]])

  for (const vote of votes) {
    if (!allowedVoters.has(vote.voter_id)) continue
    const target = vote.target_id ?? 'skip'
    if (target === 'skip' || allowedTargets.has(target)) {
      counts.set(target, (counts.get(target) || 0) + 1)
    }
  }

  let highest = 0
  let winnerId = 'skip'
  let tied = false
  for (const [id, count] of counts) {
    if (count > highest) {
      highest = count
      winnerId = id
      tied = false
    } else if (count === highest && count > 0) {
      tied = true
    }
  }

  return {
    ejectedId: tied || winnerId === 'skip' || highest === 0 ? null : winnerId,
    tied,
    summary: Object.fromEntries([
      ...alive.map((player) => [player.name, counts.get(player.id) || 0]),
      ['Skip', counts.get('skip') || 0],
    ]),
  }
}

function isDeadlineReached(deadline, now = Date.now()) {
  return Boolean(deadline) && new Date(deadline).getTime() <= now
}

module.exports = { determineWinner, resolveVotes, isDeadlineReached }
