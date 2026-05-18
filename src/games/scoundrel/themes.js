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

// Helper for themes that sample N cards from a suit and clone them with new ids.
function sampleSuit(deck, suit, count, rng, tag, filter) {
  const pool = deck.filter(c => c.suit === suit && (!filter || filter(c)))
  const additions = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    const pick = pool[Math.floor(rng() * pool.length)]
    additions.push({ ...pick, id: `${pick.id}_${tag}${i}`, themed: true })
  }
  return additions
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

  // ---- Tier 1 ----------------------------------------------------------

  the_crypt: {
    id: 'the_crypt',
    name: 'The Crypt',
    description: 'Adds 2 random spade face cards to the deck. Removes 1 random potion.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, SPADE, 2, rng, 'crypt', c => c.rank >= 11)
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
    description: 'Adds 3 low-rank weapons (rank 2–5) to the deck. Plenty of blades, none of them king-killers.',
    tier: 1,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, DIAMOND, 3, rng, 'armory', c => c.rank <= 5)
      const log = []
      if (additions.length > 0) {
        log.push(`The Armory added ${joinList(additions.map(fmt))} to the deck.`)
      }
      return { deck: deck.concat(additions), log }
    },
  },

  the_menagerie: {
    id: 'the_menagerie',
    name: 'The Menagerie',
    description: 'Club monsters act as 2 ranks higher this descent.',
    tier: 1,
    monsterRankBonusBySuit: { [CLUB]: 2 },
  },

  the_apothecary: {
    id: 'the_apothecary',
    name: 'The Apothecary',
    description: 'Adds 2 random potions to the deck. The second potion of any room damages you for its rank instead of healing.',
    tier: 1,
    secondPotionDamages: true,
    applyToDeck(deck, rng) {
      const additions = sampleSuit(deck, HEART, 2, rng, 'apoth')
      const log = []
      if (additions.length > 0) {
        log.push(`The Apothecary added ${joinList(additions.map(fmt))} to the deck.`)
      }
      return { deck: deck.concat(additions), log }
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

  bitter_brew: {
    id: 'bitter_brew',
    name: 'Bitter Brew',
    description: 'Potions heal only half their rank, rounded down.',
    tier: 1,
    potionHealHalf: true,
  },

  // ---- Tier 2 ----------------------------------------------------------

  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    description: 'Max HP −4 this descent.',
    tier: 2,
    maxHpBonus: -4,
  },

  hungry_dark: {
    id: 'hungry_dark',
    name: 'Hungry Dark',
    description: 'You cannot flee this descent.',
    tier: 2,
    cannotFlee: true,
  },

  cramped_halls: {
    id: 'cramped_halls',
    name: 'Cramped Halls',
    description: 'Rooms hold 5 cards. Clear 4 to refill.',
    tier: 2,
    roomSize: 5,
  },

  iron_bones: {
    id: 'iron_bones',
    name: 'Iron Bones',
    description: 'You cannot fight bare-handed while a usable weapon is equipped. The iron remembers every kill.',
    tier: 2,
    ironBones: true,
  },

  cracked_blade: {
    id: 'cracked_blade',
    name: 'Cracked Blade',
    description: 'Your weapon is no longer bound by rank, but it shatters if it slays a monster of higher rank than itself.',
    tier: 2,
    crackedBlade: true,
  },

  the_oath: {
    id: 'the_oath',
    name: 'The Oath',
    description: 'The first new card drawn into each room is face-down until played.',
    tier: 2,
    oath: true,
  },

  tithe: {
    id: 'tithe',
    name: 'Tithe',
    description: 'Lose 1 HP each time a room is entered.',
    tier: 2,
    tithe: 1,
  },

  // ---- Tier 3 ----------------------------------------------------------

  echo: {
    id: 'echo',
    name: 'Echo',
    description: 'Every third room: every monster present is duplicated and slid to the bottom of the deck.',
    tier: 3,
    echo: 3,
  },

  carrion: {
    id: 'carrion',
    name: 'Carrion',
    description: 'Each slain monster returns to the deck once, as a rank-2 of its suit.',
    tier: 3,
    carrion: true,
  },

  wormwood: {
    id: 'wormwood',
    name: 'Wormwood',
    description: 'One of your Boons is muted this descent.',
    tier: 3,
    wormwood: true,
  },

  the_long_night: {
    id: 'the_long_night',
    name: 'The Long Night',
    description: 'Two Tier 2 themes at once.',
    tier: 3,
    compound: true,
  },
}

const TIER_1_IDS = Object.values(THEMES).filter(t => t.tier === 1).map(t => t.id)
const TIER_2_IDS = Object.values(THEMES).filter(t => t.tier === 2).map(t => t.id)
const TIER_3_IDS = Object.values(THEMES).filter(t => t.tier === 3).map(t => t.id)

// Each band of descents draws exclusively from its own tier — higher tiers
// crowd lower ones out as the dungeon deepens:
// - 0–2 sigils → Tier 1 only (descents 2–3)
// - 3–4 sigils → Tier 2 only (descents 4–5)
// - 5+ sigils  → Tier 3 only (descents 6–7)
function getThemePool(sigils) {
  if (sigils >= 5) return TIER_3_IDS
  if (sigils >= 3) return TIER_2_IDS
  return TIER_1_IDS
}

export function pickThemeId(rng, sigils = 0) {
  const pool = getThemePool(sigils)
  return pool[Math.floor(rng() * pool.length)]
}

// For compound themes (currently only The Long Night), pick two distinct
// Tier 2 children deterministically from the run's rng. Returns null for
// non-compound themes so callers can store a uniform `children` slot.
export function resolveThemeChildren(themeId, rng) {
  const theme = THEMES[themeId]
  if (!theme?.compound) return null
  const pool = TIER_2_IDS.slice()
  if (pool.length < 2) return null
  const aIdx = Math.floor(rng() * pool.length)
  const a = pool.splice(aIdx, 1)[0]
  const b = pool[Math.floor(rng() * pool.length)]
  return [a, b]
}

export function getTheme(id) {
  return id ? THEMES[id] : null
}

// Returns the array of theme objects whose effects apply this descent.
// For non-compound themes that's just the theme itself; for compound it's
// the resolved children. Callers iterate this and sum/combine fields.
export function getActiveThemes(themeId, themeChildren) {
  const base = getTheme(themeId)
  if (!base) return []
  if (base.compound && themeChildren) {
    return themeChildren.map(getTheme).filter(Boolean)
  }
  return [base]
}
