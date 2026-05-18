import { CLUB, SPADE } from './constants'

export const BOONS = {
  // ---- Combat ----------------------------------------------------------
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Equipped weapons swing at +1 effective rank.',
    tag: 'combat',
    weaponRankBonus: 1,
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'The first monster fought each room deals 2 less damage to you.',
    tag: 'combat',
    vanguardReduction: 2,
  },
  sworn_vendetta: {
    id: 'sworn_vendetta',
    name: 'Sworn Vendetta',
    description: 'Take 2 less damage from spades.',
    tag: 'combat',
    bonusVsSuit: SPADE,
    bonusVsSuitAmount: 2,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    description: 'Take 2 less damage from clubs.',
    tag: 'combat',
    bonusVsSuit: CLUB,
    bonusVsSuitAmount: 2,
  },
  riposte: {
    id: 'riposte',
    name: 'Riposte',
    description: 'When a monster wounds you, the next monster you fight strikes for that much less.',
    tag: 'combat',
    riposte: true,
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Carry a second weapon on your back. Whichever swings cleanest is drawn for each fight.',
    tag: 'combat',
    quartermaster: true,
  },

  // ---- Survival --------------------------------------------------------
  iron_will: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Max HP +3.',
    tag: 'survival',
    maxHpBonus: 3,
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Once per descent, falling to 3 HP or less heals you to 6.',
    tag: 'survival',
    secondWind: true,
  },
  soothsayer: {
    id: 'soothsayer',
    name: 'Soothsayer',
    description: 'You always see the next card waiting beneath the deck.',
    tag: 'survival',
    soothsayer: true,
  },

  // ---- Economy ---------------------------------------------------------
  sip_of_lethe: {
    id: 'sip_of_lethe',
    name: 'Sip of Lethe',
    description: 'Drink up to two potions per room.',
    tag: 'economy',
    potionsPerRoom: 2,
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    description: 'A potion wasted over your room’s limit still heals half its rank from its dregs.',
    tag: 'economy',
    alchemist: true,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'When you flee, pocket one card — the best item, or the weakest beast — to carry into the next room.',
    tag: 'economy',
    pickpocket: true,
  },

  // ---- Build-defining --------------------------------------------------
  scoundrels_cloak: {
    id: 'scoundrels_cloak',
    name: "Scoundrel's Cloak",
    description: 'Once per descent, fleeing doesn’t lock you out of fleeing again.',
    tag: 'build',
    cloak: true,
  },
  glass_cannon: {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Weapons swing at +4 effective rank. Max HP is set to 10.',
    tag: 'build',
    weaponRankBonus: 4,
    maxHpOverride: 10,
  },
  twin_souls: {
    id: 'twin_souls',
    name: 'Twin Souls',
    description: 'Once per descent, a killing blow leaves you at 1 HP instead.',
    tag: 'build',
    twinSouls: true,
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'See the upcoming card order for the descent.',
    tag: 'build',
    cartographer: true,
  },
}

const ALL_BOON_IDS = Object.keys(BOONS)

export function getBoon(id) {
  return id ? BOONS[id] : null
}

// Pick `count` Boons not already taken. Bias toward tags the player has the
// least of so a run can't degenerate into "six Combat Boons in a row" (per
// DESIGN.md §4).
export function pickBoonOffers(currentBoons, count, rng) {
  const taken = new Set(currentBoons)
  const available = ALL_BOON_IDS.filter(id => !taken.has(id))
  if (available.length <= count) return available

  const tagCounts = currentBoons.reduce((acc, id) => {
    const tag = BOONS[id]?.tag || 'misc'
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {})

  // Weight = 1 / (1 + tagCount). Heavier weight = more likely to be picked.
  const weighted = available.map(id => {
    const tag = BOONS[id]?.tag || 'misc'
    return { id, weight: 1 / (1 + (tagCounts[tag] || 0)) }
  })

  const offers = []
  const pool = weighted.slice()
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((s, x) => s + x.weight, 0)
    let roll = rng() * total
    let idx = 0
    for (; idx < pool.length; idx++) {
      roll -= pool[idx].weight
      if (roll <= 0) break
    }
    if (idx >= pool.length) idx = pool.length - 1
    offers.push(pool[idx].id)
    pool.splice(idx, 1)
  }
  return offers
}
