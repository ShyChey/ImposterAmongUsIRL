function determineWinner(players, tasks) {
  const alive = players.filter((player) => player.status === 'alive')
  const imposters = alive.filter((player) => player.role === 'imposter')
  const crewmates = alive.filter((player) => player.role === 'crewmate')

  if (imposters.length === 0) return 'crewmates'
  if (imposters.length >= crewmates.length) return 'imposters'
  if (tasks.length > 0 && tasks.every((task) => task.is_completed)) return 'crewmates'
  return null
}

module.exports = { determineWinner }
