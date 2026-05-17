export const BOONS = {
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Equipped weapons gain +1 effective rank.',
    weaponRankBonus: 1,
  },
  iron_will: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Max HP +3.',
    maxHpBonus: 3,
  },
  sip_of_lethe: {
    id: 'sip_of_lethe',
    name: 'Sip of Lethe',
    description: 'Drink up to two potions per room.',
    potionsPerRoom: 2,
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'The first monster fought each room deals 2 less damage to you.',
    vanguardReduction: 2,
  },
}

const ALL_BOON_IDS = Object.keys(BOONS)

export function getBoon(id) {
  return id ? BOONS[id] : null
}

export function pickBoonOffers(currentBoons, count, rng) {
  const taken = new Set(currentBoons)
  const available = ALL_BOON_IDS.filter(id => !taken.has(id))
  if (available.length <= count) return available

  const pool = available.slice()
  const offers = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length)
    offers.push(pool[idx])
    pool.splice(idx, 1)
  }
  return offers
}
