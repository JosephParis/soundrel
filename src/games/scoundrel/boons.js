import { CLUB, SPADE } from './constants'

export const BOONS = {
  // ---- Combat ----------------------------------------------------------
  whetstone: {
    id: 'whetstone',
    name: 'Whetstone',
    description: 'Equipped weapons swing at +1 effective rank.',
    example: 'Your 5♦ strikes as a 6. Stacks with Glass Cannon for +5 total.',
    tag: 'combat',
    weaponRankBonus: 1,
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    description: 'The first monster you fight each room deals 2 less damage.',
    example: 'A 10♠ as the first monster of a room — bare-handed you take 8 instead of 10.',
    tag: 'combat',
    vanguardReduction: 2,
  },
  sworn_vendetta: {
    id: 'sworn_vendetta',
    name: 'Sworn Vendetta',
    description: 'Spade monsters deal 2 less damage.',
    example: 'A 9♠ bare-handed deals 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: SPADE,
    bonusVsSuitAmount: 2,
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    description: 'Club monsters deal 2 less damage.',
    example: 'A 9♣ bare-handed deals 7 instead of 9.',
    tag: 'combat',
    bonusVsSuit: CLUB,
    bonusVsSuitAmount: 2,
  },
  riposte: {
    id: 'riposte',
    name: 'Riposte',
    description: 'When a monster damages you, the next monster you fight deals half that much less damage (rounded down).',
    example: 'Take 4 from a monster → the next deals 2 less. Banked, then spent.',
    tag: 'build',
    riposte: true,
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster',
    description: 'Carry 2 weapons at once, each with its own binding. The higher-ranked usable one swings each fight.',
    example: 'Keep a 5♦ for cheap kills and an 8♦ for the kings.',
    tag: 'combat',
    quartermaster: true,
    // Temporarily removed from the offer pool while the swap-rule
    // question (DESIGN.md §9) is open. Re-enable by deleting `disabled`.
    disabled: true,
  },

  // ---- Survival --------------------------------------------------------
  iron_will: {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Max HP +3.',
    example: '20 base HP → 23. One more hit you can survive.',
    tag: 'survival',
    maxHpBonus: 3,
  },
  second_wind: {
    id: 'second_wind',
    name: 'Second Wind',
    description: 'Once per descent, dropping to 3 HP or less heals you to 6.',
    example: 'Triggers automatically the first time you drop low. A free heal at the worst moment.',
    tag: 'survival',
    secondWind: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },
  soothsayer: {
    id: 'soothsayer',
    name: 'Soothsayer',
    description: 'See the top card of the deck at all times.',
    example: 'Know if the next card is a potion you need or a king you must flee.',
    tag: 'survival',
    soothsayer: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },

  // ---- Economy ---------------------------------------------------------
  sip_of_lethe: {
    id: 'sip_of_lethe',
    name: 'Sip of Lethe',
    description: 'Drink up to 2 potions per room.',
    example: 'A room with an 8♥ and a 6♥ — both heal you, 14 HP in one room.',
    tag: 'economy',
    potionsPerRoom: 2,
  },
  alchemist: {
    id: 'alchemist',
    name: 'Alchemist',
    description: 'A potion drunk past the per-room limit still heals half its rank.',
    example: 'A second 8♥ in one room normally wastes — Alchemist gets you 4 HP from the dregs.',
    tag: 'economy',
    alchemist: true,
  },
  pickpocket: {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'When you flee, 1 card carries into the next room — the highest-rank weapon or potion if any, otherwise the lowest-rank monster.',
    example: 'Flee a brutal room and the strongest potion carries into the next.',
    tag: 'economy',
    pickpocket: true,
  },

  // ---- Build-defining --------------------------------------------------
  scoundrels_cloak: {
    id: 'scoundrels_cloak',
    name: "Scoundrel's Cloak",
    description: 'Once per descent, you can flee 2 rooms in a row.',
    example: 'Chain two flees back-to-back to skip past two rooms.',
    tag: 'survival',
    cloak: true,
  },
  glass_cannon: {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Equipped weapons swing at +4 effective rank. Max HP set to 10.',
    example: 'Your 5♦ strikes as a 9. But 10 HP means one bad room ends the descent.',
    tag: 'build',
    weaponRankBonus: 4,
    maxHpOverride: 10,
  },
  twin_souls: {
    id: 'twin_souls',
    name: 'Twin Souls',
    description: 'Once per descent, a killing blow leaves you at 1 HP instead.',
    example: 'One extra life per descent. Resets between descents, not within one.',
    tag: 'survival',
    twinSouls: true,
  },
  cartographer: {
    id: 'cartographer',
    name: 'Cartographer',
    description: 'See every remaining card in the deck, in order.',
    example: 'Every flee, every refill becomes a calculation.',
    tag: 'build',
    cartographer: true,
    // Temporarily removed from the offer pool.
    disabled: true,
  },
}

const ALL_BOON_IDS = Object.keys(BOONS)

export function getBoon(id) {
  return id ? BOONS[id] : null
}

// Pick `count` Boons not already taken. Bias toward tags the player has the
// least of so a run can't degenerate into "six Combat Boons in a row" (per
// DESIGN.md §4). Boons flagged `disabled: true` are skipped entirely.
export function pickBoonOffers(currentBoons, count, rng) {
  const taken = new Set(currentBoons)
  const available = ALL_BOON_IDS.filter(id => !taken.has(id) && !BOONS[id]?.disabled)
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
