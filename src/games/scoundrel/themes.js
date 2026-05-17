import { HEART, DIAMOND, CLUB, SPADE } from './constants'

export const THEMES = {
  the_crypt: {
    id: 'the_crypt',
    name: 'The Crypt',
    description: 'Two more spade face cards stir below; one heart is lost.',
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
      if (hearts.length > 0) {
        const remove = hearts[Math.floor(rng() * hearts.length)]
        result = result.filter(c => c.id !== remove.id)
      }
      return result.concat(additions)
    },
  },

  the_armory: {
    id: 'the_armory',
    name: 'The Armory',
    description: 'Three more diamonds glint in the dark; one club is missing.',
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
      if (clubs.length > 0) {
        const remove = clubs[Math.floor(rng() * clubs.length)]
        result = result.filter(c => c.id !== remove.id)
      }
      return result.concat(additions)
    },
  },

  sharpened_fangs: {
    id: 'sharpened_fangs',
    name: 'Sharpened Fangs',
    description: 'Every monster strikes with one rank more weight tonight.',
    tier: 1,
    monsterRankBonus: 1,
  },

  rusty_edge: {
    id: 'rusty_edge',
    name: 'Rusty Edge',
    description: 'Weapons taken up tonight come dulled — one rank lower (minimum 2).',
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
