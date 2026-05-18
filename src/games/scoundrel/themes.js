import { HEART, DIAMOND, CLUB, SPADE, SUIT_GLYPH, rankLabel } from './constants'

function fmt(card) {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

// "A" → "A"; "A and B" → "A and B"; "A, B, and C" → "A, B and C" (no Oxford comma).
function joinList(arr) {
  if (arr.length === 0) return ''
  if (arr.length === 1) return arr[0]
  return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]
}

export const THEMES = {
  // The opening-descent theme. Assigned to descent 1 of every run by
  // createRun(); not in any tier pool, so the dungeon never rolls it.
  the_quiet: {
    id: 'the_quiet',
    name: 'The Quiet',
    description: 'Max HP +10 this descent.',
    maxHpBonus: 10,
  },

  the_crypt: {
    id: 'the_crypt',
    name: 'The Crypt',
    description: 'Adds 2 random spade face cards to the deck. Removes 1 random potion.',
    tier: 1,
    applyToDeck(deck, rng) {
      const spadeFaces = deck.filter(c => c.suit === SPADE && c.rank >= 11)
      const additions = []
      for (let i = 0; i < 2 && spadeFaces.length > 0; i++) {
        const pick = spadeFaces[Math.floor(rng() * spadeFaces.length)]
        additions.push({ ...pick, id: `${pick.id}_crypt${i}`, themed: true })
      }
      const hearts = deck.filter(c => c.suit === HEART)
      let result = deck.slice()
      let removed = null
      if (hearts.length > 0) {
        removed = hearts[Math.floor(rng() * hearts.length)]
        result = result.filter(c => c.id !== removed.id)
      }
      const log = []
      if (additions.length > 0) {
        log.push(`The Crypt added ${joinList(additions.map(fmt))} to the deck.`)
      }
      if (removed) {
        log.push(`The Crypt removed ${fmt(removed)} from the deck.`)
      }
      return { deck: result.concat(additions), log }
    },
  },

  the_armory: {
    id: 'the_armory',
    name: 'The Armory',
    description: 'Adds 3 random weapons to the deck. Removes 1 random club monster.',
    tier: 1,
    applyToDeck(deck, rng) {
      const diamonds = deck.filter(c => c.suit === DIAMOND)
      const additions = []
      for (let i = 0; i < 3 && diamonds.length > 0; i++) {
        const pick = diamonds[Math.floor(rng() * diamonds.length)]
        additions.push({ ...pick, id: `${pick.id}_armory${i}`, themed: true })
      }
      const clubs = deck.filter(c => c.suit === CLUB)
      let result = deck.slice()
      let removed = null
      if (clubs.length > 0) {
        removed = clubs[Math.floor(rng() * clubs.length)]
        result = result.filter(c => c.id !== removed.id)
      }
      const log = []
      if (additions.length > 0) {
        log.push(`The Armory added ${joinList(additions.map(fmt))} to the deck.`)
      }
      if (removed) {
        log.push(`The Armory removed ${fmt(removed)} from the deck.`)
      }
      return { deck: result.concat(additions), log }
    },
  },

  sharpened_fangs: {
    id: 'sharpened_fangs',
    name: 'Sharpened Fangs',
    description: 'Every monster acts as 1 rank higher this descent.',
    tier: 1,
    monsterRankBonus: 1,
  },

  rusty_edge: {
    id: 'rusty_edge',
    name: 'Rusty Edge',
    description: 'Weapons taken up this descent enter at 1 rank lower (minimum 2).',
    tier: 1,
    weaponRankModifier: -1,
  },
}

const TIER_1_IDS = Object.values(THEMES).filter(t => t.tier === 1).map(t => t.id)

export function pickThemeId(rng) {
  return TIER_1_IDS[Math.floor(rng() * TIER_1_IDS.length)]
}

export function getTheme(id) {
  return id ? THEMES[id] : null
}
