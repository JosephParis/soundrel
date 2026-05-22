import { HEART, DIAMOND, CLUB, SPADE } from '../constants'
import { themesFor } from './helpers'

// -- Base deck ---------------------------------------------------------

export function buildBaseDeck() {
  const cards = []
  for (const suit of [HEART, DIAMOND, CLUB, SPADE]) {
    for (let r = 2; r <= 14; r++) {
      const isRed = suit === HEART || suit === DIAMOND
      if (isRed && r >= 11) continue
      cards.push({ suit, rank: r, id: `${suit}${r}` })
    }
  }
  return cards
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// The "persistent deck": base 44 minus strikes, with transmutes and hefts
// applied. IDs are stable across these edits. Used by the Forge UI and as
// the starting point for buildDescentDeck.
export function computeCurrentDeck(state) {
  let deck = buildBaseDeck()
  const strikeSet = new Set(state.strikes)
  deck = deck.filter(c => !strikeSet.has(c.id))
  deck = deck.map(c => {
    let result = c
    if (state.transmutes[c.id]) {
      result = {
        ...result,
        suit: state.transmutes[c.id],
        transmuted: true,
        originalSuit: c.suit,
      }
    }
    const heftBonus = state.hefts?.[c.id]
    if (heftBonus) {
      result = {
        ...result,
        rank: result.rank + heftBonus,
        hefted: true,
        heftBonus,
        preHeftRank: c.rank,
      }
    }
    return result
  })
  return deck
}

// Themes that modify the deck return either a plain array (the new deck) or
// an object `{ deck, log }`. Compound themes chain through each child's
// applyToDeck in order, accumulating log lines.
export function buildDescentDeck(state, themeId, themeChildren, rng) {
  let deck = computeCurrentDeck(state)
  const themes = themesFor(themeId, themeChildren)
  let extraLog = []
  for (const theme of themes) {
    if (!theme.applyToDeck) continue
    const result = theme.applyToDeck(deck, rng)
    if (Array.isArray(result)) {
      deck = result
    } else {
      deck = result.deck
      extraLog = extraLog.concat(result.log || [])
    }
  }
  return { deck: shuffle(deck, rng), log: extraLog }
}

// Hand-curated tutorial deck. 22 cards. Order matters and we skip
// the shuffle so the tutorial hits each lesson in sequence:
//
//   Room 1 (dealt): 5♦ 3♣ 2♥ 7♠
//     → equip · fight · potion · carryover
//   Room 2 (carry 7♠ + 6♦ 4♣ 5♥)
//     → replace weapon · fight with fresh weapon · heal · carry
//   Room 3 (carry 4♣ + 9♠ 10♠ 9♣)
//     → all big monsters above the new binding, no new weapon, no
//       potion. FLEE is forced; the cue recommends the Flee button.
//   Post-flee Room (8♦ 8♥ 6♣ 7♥)
//     → fresh weapon, heal, manageable fight, carry potion
//   Room 4 (carry + 5♣ 6♥ 7♣) → standard play with the new blade
//   Room 5 (carry + 7♦ 8♠ 4♥) → another replacement opportunity
//   Room 6 (carry + 5♠ 10♣ ...) → tail. Cycled-back 4♣/9♠/10♠/9♣
//     reappear here when the player's binding is high enough to
//     handle (or at least eat) them.
export function buildTutorialDeck() {
  return [
    // Room 1
    { suit: DIAMOND, rank: 5, id: 'tut_d5' },
    { suit: CLUB,    rank: 3, id: 'tut_c3' },
    { suit: HEART,   rank: 2, id: 'tut_h2' },
    { suit: SPADE,   rank: 7, id: 'tut_s7' },
    // Room 2
    { suit: DIAMOND, rank: 6, id: 'tut_d6' },
    { suit: CLUB,    rank: 4, id: 'tut_c4' },
    { suit: HEART,   rank: 5, id: 'tut_h5' },
    // Room 3 (forces flee)
    { suit: SPADE,   rank: 9,  id: 'tut_s9' },
    { suit: SPADE,   rank: 10, id: 'tut_s10' },
    { suit: CLUB,    rank: 9,  id: 'tut_c9' },
    // Post-flee deal
    { suit: DIAMOND, rank: 8, id: 'tut_d8' },
    { suit: HEART,   rank: 8, id: 'tut_h8' },
    { suit: CLUB,    rank: 6, id: 'tut_c6' },
    { suit: HEART,   rank: 7, id: 'tut_h7' },
    // Room 4
    { suit: CLUB,    rank: 5, id: 'tut_c5' },
    { suit: HEART,   rank: 6, id: 'tut_h6' },
    { suit: CLUB,    rank: 7, id: 'tut_c7' },
    // Room 5
    { suit: DIAMOND, rank: 7, id: 'tut_d7' },
    { suit: SPADE,   rank: 8, id: 'tut_s8' },
    { suit: HEART,   rank: 4, id: 'tut_h4' },
    // Tail
    { suit: SPADE,   rank: 5,  id: 'tut_s5' },
    { suit: CLUB,    rank: 10, id: 'tut_c10' },
  ]
}
