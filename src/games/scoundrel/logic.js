export const HEART = 'H'
export const DIAMOND = 'D'
export const CLUB = 'C'
export const SPADE = 'S'

export const SUIT_GLYPH = { H: '♥', D: '♦', C: '♣', S: '♠' }
export const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
export const MAX_HP = 20

export function isMonster(c) { return c && (c.suit === CLUB || c.suit === SPADE) }
export function isWeapon(c) { return c && c.suit === DIAMOND }
export function isPotion(c) { return c && c.suit === HEART }

export function rankLabel(r) { return RANK_LABEL[r] ?? String(r) }

// 44-card Scoundrel deck: remove red face cards (J/Q/K of H/D) and red aces (A of H/D).
export function buildDeck() {
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

export function createGame(rng = Math.random) {
  const deck = shuffle(buildDeck(), rng)
  const room = deck.splice(0, 4)
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    deck,
    room,
    weapon: null,
    lastSlain: null,
    potionUsedThisRoom: false,
    canFlee: true,
    discard: [],
    over: false,
    won: false,
    log: ['You enter the dungeon.'],
  }
}

function appendLog(state, line) {
  return { ...state, log: [...state.log, line].slice(-12) }
}

function refillRoomIfNeeded(state) {
  if (state.over) return state
  const remaining = state.room.filter(Boolean)
  if (remaining.length !== 1) return state
  const next = { ...state, room: remaining, potionUsedThisRoom: false, canFlee: true }
  while (next.room.length < 4 && next.deck.length > 0) {
    next.room.push(next.deck.shift())
  }
  return next
}

function checkVictory(state) {
  if (state.over) return state
  if (state.deck.length === 0 && state.room.every(c => !c)) {
    return { ...state, over: true, won: true, log: [...state.log, 'You escape the dungeon alive.'] }
  }
  return state
}

export function playCard(state, index) {
  if (state.over) return state
  const card = state.room[index]
  if (!card) return state

  const room = state.room.slice()
  room[index] = null
  let next = { ...state, room, discard: state.discard.concat(card) }

  if (isPotion(card)) {
    if (!next.potionUsedThisRoom) {
      const healed = Math.min(next.maxHp, next.hp + card.rank) - next.hp
      next.hp = next.hp + healed
      next.potionUsedThisRoom = true
      next = appendLog(next, `Potion ${rankLabel(card.rank)} restored ${healed} HP.`)
    } else {
      next = appendLog(next, `Potion ${rankLabel(card.rank)} wasted — only one per room.`)
    }
  } else if (isWeapon(card)) {
    next.weapon = { rank: card.rank }
    next.lastSlain = null
    next = appendLog(next, `Equipped weapon ${rankLabel(card.rank)}♦.`)
  } else if (isMonster(card)) {
    const canUseWeapon = next.weapon && (!next.lastSlain || card.rank < next.lastSlain.rank)
    const damage = canUseWeapon ? Math.max(0, card.rank - next.weapon.rank) : card.rank
    next.hp = next.hp - damage
    if (canUseWeapon) next.lastSlain = { rank: card.rank }
    const how = canUseWeapon
      ? `with weapon ${rankLabel(next.weapon.rank)}♦`
      : 'bare-handed'
    next = appendLog(next, `Fought ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} ${how} — took ${damage}.`)
    if (next.hp <= 0) {
      next.hp = 0
      next.over = true
      next.won = false
      next = appendLog(next, 'You fall in the dungeon.')
    }
  }

  next = refillRoomIfNeeded(next)
  next = checkVictory(next)
  return next
}

export function fleeRoom(state) {
  if (state.over || !state.canFlee) return state
  const carry = state.room.filter(Boolean)
  const deck = state.deck.concat(carry)
  const room = deck.splice(0, 4)
  return appendLog(
    {
      ...state,
      deck,
      room,
      canFlee: false,
      potionUsedThisRoom: false,
    },
    'You flee. The room is shuffled to the bottom.',
  )
}
