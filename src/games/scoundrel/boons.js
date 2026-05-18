import { CLUB, SPADE } from './constants'

export const BOONS = {
  // ---- Combat ----------------------------------------------------------
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Equipped weapons swing at +1 effective rank.',
    example: 'Your 5♦ strikes as a 6. Stack with Glass Cannon for +5.',
    tag: 'combat',
    weaponRankBonus: 1,
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'The first monster fought each room deals 2 less damage to you.',
    example: 'A 10♠ first up takes 2 off — bare-hand it for 8 instead of 10.',
    tag: 'combat',
    vanguardReduction: 2,
  },
  sworn_vendetta: {
    id: 'sworn_vendetta',
    name: 'Sworn Vendetta',
    description: 'Take 2 less damage from spades.',
    example: 'A 9♠ bare-handed hits for 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: SPADE,
    bonusVsSuitAmount: 2,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    description: 'Take 2 less damage from clubs.',
    example: 'A 9♣ bare-handed hits for 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: CLUB,
    bonusVsSuitAmount: 2,
  },
  riposte: {
    id: 'riposte',
    name: 'Riposte',
    description: 'When a monster wounds you, the next monster you fight strikes for that much less.',
    example: 'Eat 4 from a beast → next monster strikes for 4 less. Banked, then spent.',
    tag: 'combat',
    riposte: true,
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Carry a second weapon on your back. Whichever swings cleanest is drawn for each fight.',
    example: 'Keep a 5♦ for cheap kills and an 8♦ for the kings — each has its own binding.',
    tag: 'combat',
    quartermaster: true,
  },

  // ---- Survival --------------------------------------------------------
  iron_will: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Max HP +3.',
    example: 'Base 20 → 23. One extra hit you can survive.',
    tag: 'survival',
    maxHpBonus: 3,
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Once per descent, falling to 3 HP or less heals you to 6.',
    example: 'Triggers automatically the first time you drop low. A free potion at the worst moment.',
    tag: 'survival',
    secondWind: true,
  },
  soothsayer: {
    id: 'soothsayer',
    name: 'Soothsayer',
    description: 'You always see the next card waiting beneath the deck.',
    example: 'Know if the next refill is a potion you need, or a king you have to flee.',
    tag: 'survival',
    soothsayer: true,
  },

  // ---- Economy ---------------------------------------------------------
  sip_of_lethe: {
    id: 'sip_of_lethe',
    name: 'Sip of Lethe',
    description: 'Drink up to two potions per room.',
    example: 'A room with an 8♥ and a 6♥? Both heal you — 14 HP back in one room.',
    tag: 'economy',
    potionsPerRoom: 2,
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    description: 'A potion wasted over your room\'s limit still heals half its rank.',
    example: 'A second 8♥ in one room normally wastes — Alchemist drinks the dregs for 4 HP.',
    tag: 'economy',
    alchemist: true,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'When you flee, pocket one card — the best item, or the weakest beast — to carry into the next room.',
    example: 'Flee past a brutal room and the strongest potion comes with you.',
    tag: 'economy',
    pickpocket: true,
  },

  // ---- Build-defining --------------------------------------------------
  scoundrels_cloak: {
    id: 'scoundrels_cloak',
    name: "Scoundrel's Cloak",
    description: 'Once per descent, fleeing doesn\'t lock you out of fleeing again.',
    example: 'Chain two flees back-to-back to skip past two rooms of trouble.',
    tag: 'build',
    cloak: true,
  },
  glass_cannon: {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Weapons swing at +4 effective rank. Max HP set to 10.',
    example: 'Your 5♦ strikes as a 9. But 10 HP means one bad room can end you.',
    tag: 'build',
    weaponRankBonus: 4,
    maxHpOverride: 10,
  },
  twin_souls: {
    id: 'twin_souls',
    name: 'Twin Souls',
    description: 'Once per descent, a killing blow leaves you at 1 HP instead.',
    example: 'An extra life. Don\'t lean on it twice — it doesn\'t reload.',
    tag: 'build',
    twinSouls: true,
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'See the upcoming card order for the descent.',
    example: 'Read the whole dungeon. Every flee, every refill becomes a calculation.',
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
