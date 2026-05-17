import {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH, RANK_LABEL,
  BASE_MAX_HP, SIGIL_TARGET, FORGE_SIGILS,
  isMonster, isWeapon, isPotion, rankLabel,
} from './constants'
import { THEMES, getTheme, pickThemeId } from './themes'
import { BOONS, getBoon, pickBoonOffers } from './boons'

export {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH, RANK_LABEL,
  BASE_MAX_HP, SIGIL_TARGET, FORGE_SIGILS,
  isMonster, isWeapon, isPotion, rankLabel,
  THEMES, getTheme,
  BOONS, getBoon,
}

const FIRST_RUN_KEY = 'scoundrel_first_run_done'

function isFirstRunActive() {
  if (typeof localStorage === 'undefined') return true
  try {
    return localStorage.getItem(FIRST_RUN_KEY) !== '1'
  } catch {
    return true
  }
}

function markFirstRunDone() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(FIRST_RUN_KEY, '1')
  } catch {
    // ignore
  }
}

export function resetFirstRunFlag() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(FIRST_RUN_KEY)
  } catch {
    // ignore
  }
}

// -- Deck ---------------------------------------------------------------

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

// The "persistent deck" — base 44 minus strikes, with transmutes applied.
// IDs are stable across these edits. Used by the Forge UI and as the starting
// point for buildDescentDeck.
export function computeCurrentDeck(state) {
  let deck = buildBaseDeck()
  const strikeSet = new Set(state.strikes)
  deck = deck.filter(c => !strikeSet.has(c.id))
  deck = deck.map(c => {
    if (state.transmutes[c.id]) {
      return {
        ...c,
        suit: state.transmutes[c.id],
        transmuted: true,
        originalSuit: c.suit,
      }
    }
    return c
  })
  return deck
}

function buildDescentDeck(state, themeId, rng) {
  let deck = computeCurrentDeck(state)
  const theme = getTheme(themeId)
  if (theme?.applyToDeck) {
    deck = theme.applyToDeck(deck, rng)
  }
  return shuffle(deck, rng)
}

// -- Boon / theme helpers ----------------------------------------------

function sumBoonField(boons, field) {
  return boons.reduce((sum, id) => sum + (BOONS[id]?.[field] || 0), 0)
}
function maxBoonField(boons, field, baseline) {
  return boons.reduce((m, id) => Math.max(m, BOONS[id]?.[field] || baseline), baseline)
}

function computeMaxHp(state) {
  return BASE_MAX_HP + sumBoonField(state.boons, 'maxHpBonus') + (state.firstRunSoftener ? 3 : 0)
}

function computePotionsPerRoomLimit(boons) {
  return maxBoonField(boons, 'potionsPerRoom', 1)
}

function effectiveMonsterRank(card, themeId) {
  const theme = getTheme(themeId)
  return card.rank + (theme?.monsterRankBonus || 0)
}

function effectiveWeaponRank(weapon, boons) {
  if (!weapon) return 0
  return Math.max(0, weapon.rank + sumBoonField(boons, 'weaponRankBonus'))
}

function isWeaponUsable(state, monsterCard) {
  if (!state.weapon) return false
  // With no kills yet, the weapon can take any foe. After the first kill, the
  // weapon is bound to monsters at or below the last-killed rank.
  if (!state.lastSlain) return true
  return monsterCard.rank <= state.lastSlain.rank
}

// -- Logging -----------------------------------------------------------

function appendLog(state, line) {
  return { ...state, log: [...(state.log || []), line].slice(-14) }
}

// -- Run lifecycle -----------------------------------------------------

export function createRun(rng = Math.random) {
  const firstRunSoftener = isFirstRunActive()
  // On the very first sanctuary visit (before descent 1) there is no Boon
  // offer and no Forge — you haven't earned a sigil yet. The next descent's
  // theme is null if the first-run softener is active (descent 1 is quiet).
  const nextTheme = firstRunSoftener ? null : pickThemeId(rng)

  return {
    phase: 'sanctuary',
    sigilsEarned: 0,
    sigilTarget: SIGIL_TARGET,
    boons: [],
    strikes: [],
    transmutes: {},
    carriedWeapon: null,
    firstRunSoftener,
    rng,

    boonOffers: [],
    nextTheme,
    forgeOpen: false,
    forgeUsed: false,
    boonChosen: true, // no Boon to pick on the opening visit
    forgeView: null,

    hp: 0,
    maxHp: 0,
    deck: [],
    room: [],
    weapon: null,
    lastSlain: null,
    potionsUsedThisRoom: 0,
    canFlee: true,
    discard: [],
    theme: null,
    monstersFoughtThisRoom: 0,

    log: ['You wake in the great hall. The rune-chains hum.'],
  }
}

export function startNewRun(rng = Math.random) {
  return createRun(rng)
}

// -- Descend ------------------------------------------------------------

export function descend(state) {
  if (state.phase !== 'sanctuary') return state
  if (!state.boonChosen) return state // must pick a Boon first

  const themeId = state.nextTheme
  const deck = buildDescentDeck(state, themeId, state.rng)
  const room = deck.splice(0, 4)
  const maxHp = computeMaxHp(state)

  const weapon = state.carriedWeapon
    ? { rank: state.carriedWeapon.rank }
    : null

  const theme = getTheme(themeId)
  const openingLine = theme
    ? `You descend. Tonight, ${theme.name.toLowerCase()} is upon the halls.`
    : 'You descend. The dungeon is quiet tonight; the deep dream is still asleep.'

  return {
    ...state,
    phase: 'descent',
    hp: maxHp,
    maxHp,
    deck,
    room,
    weapon,
    lastSlain: null,
    potionsUsedThisRoom: 0,
    canFlee: true,
    discard: [],
    theme: themeId,
    monstersFoughtThisRoom: 0,
    forgeView: null,
    log: [openingLine],
  }
}

// -- Combat -------------------------------------------------------------

function getMonsterDamage(state, monsterCard, useWeapon) {
  const effRank = effectiveMonsterRank(monsterCard, state.theme)
  let dmg
  if (useWeapon) {
    const weapRank = effectiveWeaponRank(state.weapon, state.boons)
    dmg = Math.max(0, effRank - weapRank)
  } else {
    dmg = effRank
  }
  if (state.monstersFoughtThisRoom === 0) {
    const reduction = maxBoonField(state.boons, 'vanguardReduction', 0)
    dmg = Math.max(0, dmg - reduction)
  }
  return dmg
}

function applyMonsterFight(state, monsterCard, index, useWeapon) {
  const damage = getMonsterDamage(state, monsterCard, useWeapon)
  const room = state.room.slice()
  room[index] = null

  let next = {
    ...state,
    room,
    discard: state.discard.concat(monsterCard),
    hp: state.hp - damage,
    monstersFoughtThisRoom: state.monstersFoughtThisRoom + 1,
  }

  if (useWeapon) {
    next.lastSlain = { rank: monsterCard.rank }
  }

  const glyph = SUIT_GLYPH[monsterCard.suit]
  const how = useWeapon
    ? `with the ${rankLabel(state.weapon.rank)}♦`
    : 'bare-handed'
  next = appendLog(next, `Fought ${rankLabel(monsterCard.rank)}${glyph} ${how} — took ${damage}.`)

  if (next.hp <= 0) {
    next.hp = 0
    return endDescentDeath(next)
  }

  return checkRefillAndComplete(next)
}

// -- Card plays ---------------------------------------------------------

function playPotion(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const limit = computePotionsPerRoomLimit(state.boons)

  let next = { ...state, room, discard: state.discard.concat(card) }

  if (next.potionsUsedThisRoom < limit) {
    const healed = Math.min(next.maxHp, next.hp + card.rank) - next.hp
    next.hp = next.hp + healed
    next.potionsUsedThisRoom = next.potionsUsedThisRoom + 1
    next = appendLog(next, `Drank potion ${rankLabel(card.rank)}♥ — restored ${healed} HP.`)
  } else {
    next = appendLog(next, `Potion ${rankLabel(card.rank)}♥ wasted — no thirst left.`)
  }

  return checkRefillAndComplete(next)
}

function playWeapon(state, index, card) {
  const room = state.room.slice()
  room[index] = null

  const theme = getTheme(state.theme)
  const rusty = theme?.weaponRankModifier || 0
  const effectiveRank = Math.max(2, card.rank + rusty)

  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    weapon: { rank: effectiveRank, originalRank: card.rank },
    lastSlain: null,
  }
  const note = rusty < 0
    ? ` (rusty — bites as a ${rankLabel(effectiveRank)})`
    : ''
  next = appendLog(next, `Took up the ${rankLabel(card.rank)}♦${note}.`)

  return checkRefillAndComplete(next)
}

function playMonster(state, index, card, useWeapon) {
  return applyMonsterFight(state, card, index, useWeapon)
}

export function playCard(state, index) {
  if (state.phase !== 'descent') return state
  const card = state.room[index]
  if (!card) return state
  if (isPotion(card)) return playPotion(state, index, card)
  if (isWeapon(card)) return playWeapon(state, index, card)
  if (isMonster(card)) return playMonster(state, index, card, isWeaponUsable(state, card))
  return state
}

export function playCardBare(state, index) {
  if (state.phase !== 'descent') return state
  const card = state.room[index]
  if (!card || !isMonster(card)) return state
  return applyMonsterFight(state, card, index, false)
}

// -- Room refill / descent completion ----------------------------------

function checkRefillAndComplete(state) {
  const remaining = state.room.filter(Boolean)

  if (state.deck.length === 0 && remaining.length === 0) {
    return endDescentVictory(state)
  }

  if (remaining.length === 1) {
    const newRoom = remaining.slice()
    const deck = state.deck.slice()
    while (newRoom.length < 4 && deck.length > 0) {
      newRoom.push(deck.shift())
    }
    return {
      ...state,
      deck,
      room: newRoom,
      potionsUsedThisRoom: 0,
      canFlee: true,
      monstersFoughtThisRoom: 0,
    }
  }

  return state
}

function endDescentDeath(state) {
  if (state.firstRunSoftener) markFirstRunDone()
  return appendLog(
    { ...state, phase: 'gameover' },
    'You fall in the dark. The hall above forgets you.'
  )
}

function endDescentVictory(state) {
  const newSigils = state.sigilsEarned + 1
  const carriedWeapon = state.weapon ? { rank: state.weapon.rank } : null

  if (newSigils >= state.sigilTarget) {
    if (state.firstRunSoftener) markFirstRunDone()
    return appendLog(
      {
        ...state,
        sigilsEarned: newSigils,
        phase: 'victory',
        carriedWeapon,
      },
      'The seventh sigil is set in the threshold. The high gate opens.'
    )
  }

  const rng = state.rng
  const nextTheme = pickThemeId(rng)
  const boonOffers = pickBoonOffers(state.boons, 3, rng)
  const forgeOpen = FORGE_SIGILS.has(newSigils)

  return appendLog(
    {
      ...state,
      sigilsEarned: newSigils,
      phase: 'sanctuary',
      carriedWeapon,
      nextTheme,
      boonOffers,
      forgeOpen,
      forgeUsed: false,
      boonChosen: false,
      forgeView: null,

      // Wipe descent-only state
      deck: [],
      room: [],
        theme: null,
      weapon: null,
      lastSlain: null,
      discard: [],
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
    },
    `You return to the hall. Sigil ${newSigils} of ${state.sigilTarget} is set.`
  )
}

// -- Flee --------------------------------------------------------------

export function fleeRoom(state) {
  if (state.phase !== 'descent') return state
  if (!state.canFlee) return state

  const carry = state.room.filter(Boolean)
  const deck = state.deck.concat(carry)
  const room = deck.splice(0, 4)

  return appendLog(
    {
      ...state,
      deck,
      room,
      canFlee: false,
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
    },
    'You retreat. The room scatters back into the dark.'
  )
}

// -- Sanctuary actions -------------------------------------------------

export function pickBoon(state, boonId) {
  if (state.phase !== 'sanctuary') return state
  if (state.boonChosen) return state
  if (!state.boonOffers.includes(boonId)) return state
  return appendLog(
    {
      ...state,
      boons: state.boons.concat(boonId),
      boonChosen: true,
      boonOffers: [],
    },
    `Took the ${BOONS[boonId]?.name}.`
  )
}

export function openForgeAction(state, action) {
  if (state.phase !== 'sanctuary') return state
  if (!state.forgeOpen || state.forgeUsed) return state
  return { ...state, forgeView: action }
}

export function closeForgeView(state) {
  return { ...state, forgeView: null }
}

export function applyStrike(state, monsterId, offeringId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const monster = current.find(c => c.id === monsterId)
  const offering = current.find(c => c.id === offeringId)
  if (!monster || !offering) return state
  if (!isMonster(monster)) return state
  if (!(isWeapon(offering) || isPotion(offering))) return state
  if (monster.rank !== offering.rank) return state
  if (monster.rank > 10) return state // face-card dead are immune

  const mGlyph = SUIT_GLYPH[monster.suit]
  const oGlyph = SUIT_GLYPH[offering.suit]
  return appendLog(
    {
      ...state,
      strikes: state.strikes.concat([monsterId, offeringId]),
      forgeUsed: true,
      forgeView: null,
    },
    `Carved ${rankLabel(monster.rank)}${mGlyph} into the threshold; ${rankLabel(offering.rank)}${oGlyph} offered to the kindling.`
  )
}

export function applyTransmute(state, cardId, newSuit) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const card = current.find(c => c.id === cardId)
  if (!card) return state
  if (card.suit === newSuit) return state

  return appendLog(
    {
      ...state,
      transmutes: { ...state.transmutes, [cardId]: newSuit },
      forgeUsed: true,
      forgeView: null,
    },
    `Transmuted ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank)}${SUIT_GLYPH[newSuit]}.`
  )
}

// -- Convenience inspection (used by UI) -------------------------------

export function getStrikeOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return { monsters: [], byRank: {} }
  const current = computeCurrentDeck(state)
  const monsters = current.filter(c => isMonster(c) && c.rank <= 10)
  const byRank = {}
  for (const c of current) {
    if (isWeapon(c) || isPotion(c)) {
      if (!byRank[c.rank]) byRank[c.rank] = []
      byRank[c.rank].push(c)
    }
  }
  return { monsters, byRank }
}

export function getTransmuteOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return computeCurrentDeck(state)
}

export function isWeaponUsableFor(state, card) {
  return isWeaponUsable(state, card)
}

export function previewMonsterDamage(state, card) {
  if (!card || !isMonster(card)) {
    return { weapon: null, bare: { value: 0, parts: [], clamped: false } }
  }
  const bare = describeDamage(state, card, false)
  const weapon = isWeaponUsable(state, card) ? describeDamage(state, card, true) : null
  return { weapon, bare }
}

// -- Numeric breakdown helpers (for UI transparency) -------------------
//
// Each describe* returns { value, parts } where parts is an array of
// { label, value, op }. Display layer formats as e.g. "23 (20 + 3 first run)".

function sumParts(parts) {
  return parts.reduce((s, p) => s + (p.op === '-' ? -p.value : p.value), 0)
}

export function describeMaxHp(state) {
  const parts = [{ label: 'base', value: BASE_MAX_HP, op: '+' }]
  for (const id of state.boons) {
    const bonus = BOONS[id]?.maxHpBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  if (state.firstRunSoftener) {
    parts.push({ label: 'first run', value: 3, op: '+' })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

export function describeWeaponStrength(state) {
  if (!state.weapon) return null
  const parts = [{ label: 'base', value: state.weapon.rank, op: '+' }]
  for (const id of state.boons) {
    const bonus = BOONS[id]?.weaponRankBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

export function describeDamage(state, card, useWeapon) {
  const parts = []
  parts.push({ label: 'monster', value: card.rank, op: '+' })

  const theme = getTheme(state.theme)
  const themeBonus = theme?.monsterRankBonus || 0
  if (themeBonus && theme) {
    parts.push({ label: theme.name, value: Math.abs(themeBonus), op: themeBonus < 0 ? '-' : '+' })
  }

  if (useWeapon && state.weapon) {
    const ws = describeWeaponStrength(state)
    if (ws) parts.push({ label: 'weapon', value: ws.value, op: '-' })
  }

  if (state.monstersFoughtThisRoom === 0) {
    for (const id of state.boons) {
      const reduction = BOONS[id]?.vanguardReduction || 0
      if (reduction) {
        parts.push({ label: BOONS[id].name, value: reduction, op: '-' })
        break
      }
    }
  }

  const raw = sumParts(parts)
  return { value: Math.max(0, raw), parts, clamped: raw < 0 }
}
