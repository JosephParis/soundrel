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

function hasBoon(state, id) {
  return state.boons.includes(id)
}

function sumBoonField(boons, field) {
  return boons.reduce((sum, id) => sum + (BOONS[id]?.[field] || 0), 0)
}
function maxBoonField(boons, field, baseline) {
  return boons.reduce((m, id) => Math.max(m, BOONS[id]?.[field] || baseline), baseline)
}

function minMaxHpOverride(boons) {
  // The lowest override wins (most restrictive). null if none.
  let acc = null
  for (const id of boons) {
    const o = BOONS[id]?.maxHpOverride
    if (o != null && (acc == null || o < acc)) acc = o
  }
  return acc
}

function computeMaxHp(state, themeId = state.theme) {
  const theme = getTheme(themeId)
  const override = minMaxHpOverride(state.boons)
  const base = override != null ? override : BASE_MAX_HP
  return base + sumBoonField(state.boons, 'maxHpBonus') + (theme?.maxHpBonus || 0)
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

function bonusVsSuitFor(state, card) {
  for (const id of state.boons) {
    const b = BOONS[id]
    if (b?.bonusVsSuit && b.bonusVsSuit === card.suit) {
      return { amount: b.bonusVsSuitAmount || 0, name: b.name, id }
    }
  }
  return null
}

// -- Weapon helpers ----------------------------------------------------

function isWeaponBoundFor(weapon, monsterCard) {
  if (!weapon) return false
  if (!weapon.lastSlain) return true
  return monsterCard.rank <= weapon.lastSlain.rank
}

// Returns the player's two weapons (primary, spare) as an array with nulls
// filtered out. Order doesn't matter — callers should re-sort if they need to.
function allWeapons(state) {
  return [state.weapon, state.spareWeapon].filter(Boolean)
}

// Pick the best weapon for swinging at this monster.
// Prefers the highest *effective* rank among usable weapons. Returns
// { weapon, slot } where slot is 'primary' | 'spare'.
function pickBestWeaponFor(state, monsterCard) {
  const candidates = []
  if (state.weapon && isWeaponBoundFor(state.weapon, monsterCard)) {
    candidates.push({ weapon: state.weapon, slot: 'primary' })
  }
  if (state.spareWeapon && isWeaponBoundFor(state.spareWeapon, monsterCard)) {
    candidates.push({ weapon: state.spareWeapon, slot: 'spare' })
  }
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => {
    const a = effectiveWeaponRank(best.weapon, state.boons)
    const b = effectiveWeaponRank(cur.weapon, state.boons)
    return b > a ? cur : best
  })
}

function isWeaponUsable(state, monsterCard) {
  return !!pickBestWeaponFor(state, monsterCard)
}

// -- Logging -----------------------------------------------------------

function appendLog(state, line) {
  return { ...state, log: [...(state.log || []), line].slice(-14) }
}

// -- Run lifecycle -----------------------------------------------------

export function createRun(rng = Math.random) {
  // On the very first sanctuary visit (before descent 1) there is no Boon
  // offer and no Forge — you haven't earned a sigil yet. Descent 1 of every
  // run runs under "The Quiet" — a friendly warm-up theme that gives
  // +10 max HP. Tier-1 themes start at descent 2.
  const nextTheme = 'the_quiet'

  return {
    phase: 'sanctuary',
    sigilsEarned: 0,
    sigilTarget: SIGIL_TARGET,
    boons: [],
    strikes: [],
    transmutes: {},
    carriedWeapon: null,
    carriedSpareWeapon: null,
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
    spareWeapon: null,
    potionsUsedThisRoom: 0,
    canFlee: true,
    discard: [],
    theme: null,
    monstersFoughtThisRoom: 0,

    // Per-descent transient charges (reset at descent start)
    riposteCharge: 0,
    secondWindUsed: false,
    cloakUsed: false,
    twinSoulsUsed: false,

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
  const maxHp = computeMaxHp(state, themeId)

  // Carried weapons arrive rested (lastSlain cleared) — DESIGN.md §2.
  const weapon = state.carriedWeapon
    ? { rank: state.carriedWeapon.rank, originalRank: state.carriedWeapon.originalRank, lastSlain: null }
    : null
  const spareWeapon = state.carriedSpareWeapon
    ? { rank: state.carriedSpareWeapon.rank, originalRank: state.carriedSpareWeapon.originalRank, lastSlain: null }
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
    spareWeapon,
    potionsUsedThisRoom: 0,
    canFlee: true,
    discard: [],
    theme: themeId,
    monstersFoughtThisRoom: 0,
    forgeView: null,
    riposteCharge: 0,
    secondWindUsed: false,
    cloakUsed: false,
    twinSoulsUsed: false,
    log: [openingLine],
  }
}

// -- Combat -------------------------------------------------------------

// Returns the damage the player takes from this monster, given the chosen
// weapon (or null for bare-handed). Applies Vanguard, Vendetta/Hunter and
// Riposte in that order.
function getMonsterDamage(state, monsterCard, weaponUsed) {
  const effRank = effectiveMonsterRank(monsterCard, state.theme)
  let dmg
  if (weaponUsed) {
    const weapRank = effectiveWeaponRank(weaponUsed, state.boons)
    dmg = Math.max(0, effRank - weapRank)
  } else {
    dmg = effRank
  }
  if (state.monstersFoughtThisRoom === 0) {
    const reduction = maxBoonField(state.boons, 'vanguardReduction', 0)
    dmg = Math.max(0, dmg - reduction)
  }
  const suitBonus = bonusVsSuitFor(state, monsterCard)
  if (suitBonus) dmg = Math.max(0, dmg - suitBonus.amount)
  if (state.riposteCharge > 0) dmg = Math.max(0, dmg - state.riposteCharge)
  return dmg
}

function applyMonsterFight(state, monsterCard, index, useWeapon) {
  const chosen = useWeapon ? pickBestWeaponFor(state, monsterCard) : null
  const weaponUsed = chosen?.weapon || null
  const damage = getMonsterDamage(state, monsterCard, weaponUsed)
  const room = state.room.slice()
  room[index] = null

  let next = {
    ...state,
    room,
    discard: state.discard.concat(monsterCard),
    hp: state.hp - damage,
    monstersFoughtThisRoom: state.monstersFoughtThisRoom + 1,
    // Riposte charge from THIS fight will be set below; previous charge has
    // been consumed in getMonsterDamage.
    riposteCharge: 0,
  }

  if (chosen) {
    const updated = { ...weaponUsed, lastSlain: { rank: monsterCard.rank } }
    if (chosen.slot === 'primary') next.weapon = updated
    else next.spareWeapon = updated
  }

  const glyph = SUIT_GLYPH[monsterCard.suit]
  const how = weaponUsed
    ? `with the ${rankLabel(weaponUsed.rank)}♦`
    : 'bare-handed'
  next = appendLog(next, `Fought ${rankLabel(monsterCard.rank)}${glyph} ${how} — took ${damage}.`)

  // Riposte: bank this fight's actual damage for the next fight.
  if (hasBoon(next, 'riposte') && damage > 0) {
    next.riposteCharge = damage
    next = appendLog(next, `Riposte holds — next monster strikes for ${damage} less.`)
  }

  // Twin Souls: a killing blow leaves you at 1 HP instead, once per descent.
  if (next.hp <= 0 && hasBoon(next, 'twin_souls') && !next.twinSoulsUsed) {
    next.hp = 1
    next.twinSoulsUsed = true
    next = appendLog(next, 'Twin Souls — the second self steadies the body. You stand at 1 HP.')
  }

  if (next.hp <= 0) {
    next.hp = 0
    return endDescentDeath(next)
  }

  // Second Wind: once per descent, dropping to 3 HP or less heals to 6.
  if (
    next.hp > 0 &&
    next.hp <= 3 &&
    hasBoon(next, 'second_wind') &&
    !next.secondWindUsed
  ) {
    next.hp = Math.min(next.maxHp, 6)
    next.secondWindUsed = true
    next = appendLog(next, 'Second Wind catches you — breath returns, HP steadies at 6.')
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
  } else if (hasBoon(next, 'alchemist')) {
    const half = Math.ceil(card.rank / 2)
    const healed = Math.min(next.maxHp, next.hp + half) - next.hp
    next.hp = next.hp + healed
    next = appendLog(next, `Potion ${rankLabel(card.rank)}♥ over your thirst — Alchemist drew ${healed} HP from its dregs.`)
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

  const newWeapon = { rank: effectiveRank, originalRank: card.rank, lastSlain: null }

  let nextWeapon, nextSpare, swapNote
  if (hasBoon(state, 'quartermaster')) {
    if (!state.weapon) {
      nextWeapon = newWeapon
      nextSpare = state.spareWeapon
      swapNote = ''
    } else {
      // Push current primary to spare; discard whatever the old spare was.
      nextWeapon = newWeapon
      nextSpare = state.weapon
      swapNote = state.spareWeapon
        ? ` (slung the old ${rankLabel(state.weapon.rank)}♦ to your back; the spent ${rankLabel(state.spareWeapon.rank)}♦ left on the stone)`
        : ` (slung the old ${rankLabel(state.weapon.rank)}♦ to your back)`
    }
  } else {
    nextWeapon = newWeapon
    nextSpare = null
    swapNote = ''
  }

  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    weapon: nextWeapon,
    spareWeapon: nextSpare,
  }
  const rustNote = rusty < 0
    ? ` (rusty — bites as a ${rankLabel(effectiveRank)})`
    : ''
  next = appendLog(next, `Took up the ${rankLabel(card.rank)}♦${rustNote}${swapNote}.`)

  return checkRefillAndComplete(next)
}

function playMonster(state, index, card) {
  return applyMonsterFight(state, card, index, isWeaponUsable(state, card))
}

export function playCard(state, index) {
  if (state.phase !== 'descent') return state
  const card = state.room[index]
  if (!card) return state
  if (isPotion(card)) return playPotion(state, index, card)
  if (isWeapon(card)) return playWeapon(state, index, card)
  if (isMonster(card)) return playMonster(state, index, card)
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
    // Preserve the surviving card's slot — keep state.room's layout (nulls
    // included) and fill the empty positions left-to-right from the deck top.
    // Without this, the leftover card visibly jumps to index 0 on every refill.
    const deck = state.deck.slice()
    const newRoom = state.room.slice()
    for (let i = 0; i < newRoom.length; i++) {
      if (newRoom[i] === null && deck.length > 0) {
        newRoom[i] = deck.shift()
      }
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
  return appendLog(
    { ...state, phase: 'gameover' },
    'You fall in the dark. The hall above forgets you.'
  )
}

function endDescentVictory(state) {
  const newSigils = state.sigilsEarned + 1
  const carriedWeapon = state.weapon ? { rank: state.weapon.rank, originalRank: state.weapon.originalRank } : null
  const carriedSpareWeapon = state.spareWeapon ? { rank: state.spareWeapon.rank, originalRank: state.spareWeapon.originalRank } : null

  if (newSigils >= state.sigilTarget) {
    return appendLog(
      {
        ...state,
        sigilsEarned: newSigils,
        phase: 'victory',
        carriedWeapon,
        carriedSpareWeapon,
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
      carriedSpareWeapon,
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
      spareWeapon: null,
      discard: [],
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
      riposteCharge: 0,
      secondWindUsed: false,
      cloakUsed: false,
      twinSoulsUsed: false,
    },
    `You return to the hall. Sigil ${newSigils} of ${state.sigilTarget} is set.`
  )
}

// -- Flee --------------------------------------------------------------

// Pick the best card to "pocket" when fleeing: highest-rank item (weapon or
// potion), or the lowest-rank monster if no items remain.
function pickPocketTarget(room) {
  const items = room.filter(c => c && (isWeapon(c) || isPotion(c)))
  if (items.length > 0) {
    return items.reduce((a, b) => (b.rank > a.rank ? b : a))
  }
  const monsters = room.filter(c => c && isMonster(c))
  if (monsters.length > 0) {
    return monsters.reduce((a, b) => (b.rank < a.rank ? b : a))
  }
  return null
}

export function fleeRoom(state) {
  if (state.phase !== 'descent') return state
  if (!state.canFlee) return state

  const usingCloak = hasBoon(state, 'scoundrels_cloak') && !state.cloakUsed

  if (hasBoon(state, 'pickpocket')) {
    const filled = state.room.filter(Boolean)
    const kept = pickPocketTarget(filled)
    // Find the kept card's original slot so it doesn't shift when the rest of
    // the room is refreshed from the deck.
    const keptIndex = kept ? state.room.findIndex(c => c && c.id === kept.id) : -1
    const others = kept ? filled.filter(c => c.id !== kept.id) : filled
    const deck = state.deck.concat(others)

    const newRoom = [null, null, null, null]
    if (kept && keptIndex >= 0) newRoom[keptIndex] = kept
    for (let i = 0; i < newRoom.length; i++) {
      if (newRoom[i] === null && deck.length > 0) {
        newRoom[i] = deck.shift()
      }
    }

    const note = kept
      ? `You retreat — palmed ${rankLabel(kept.rank)}${SUIT_GLYPH[kept.suit]} on the way out.`
      : 'You retreat. The room scatters back into the dark.'
    return appendLog(
      {
        ...state,
        deck,
        room: newRoom,
        canFlee: usingCloak,
        cloakUsed: usingCloak ? true : state.cloakUsed,
        potionsUsedThisRoom: 0,
        monstersFoughtThisRoom: 0,
      },
      usingCloak ? `${note} (Scoundrel's Cloak — you can flee again.)` : note
    )
  }

  const carry = state.room.filter(Boolean)
  const deck = state.deck.concat(carry)
  const room = deck.splice(0, 4)

  return appendLog(
    {
      ...state,
      deck,
      room,
      canFlee: usingCloak,
      cloakUsed: usingCloak ? true : state.cloakUsed,
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
    },
    usingCloak
      ? 'You retreat. The room scatters back into the dark. (Scoundrel\'s Cloak — you can flee again.)'
      : 'You retreat. The room scatters back into the dark.'
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
  const bare = describeDamage(state, card, null)
  const chosen = pickBestWeaponFor(state, card)
  const weapon = chosen ? describeDamage(state, card, chosen.weapon) : null
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
  const override = minMaxHpOverride(state.boons)
  const baseValue = override != null ? override : BASE_MAX_HP
  const overrideBoon = override != null
    ? state.boons.find(id => BOONS[id]?.maxHpOverride === override)
    : null
  const baseLabel = overrideBoon ? BOONS[overrideBoon].name : 'base'

  const parts = [{ label: baseLabel, value: baseValue, op: '+' }]
  for (const id of state.boons) {
    const bonus = BOONS[id]?.maxHpBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  const theme = getTheme(state.theme)
  if (theme?.maxHpBonus) {
    const bonus = theme.maxHpBonus
    parts.push({
      label: theme.name,
      value: Math.abs(bonus),
      op: bonus > 0 ? '+' : '-',
    })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// Describe the strength of a specific weapon (or state.weapon by default).
export function describeWeaponStrength(state, weapon = state.weapon) {
  if (!weapon) return null
  const parts = [{ label: 'base', value: weapon.rank, op: '+' }]
  for (const id of state.boons) {
    const bonus = BOONS[id]?.weaponRankBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// `weaponUsed` is now the actual weapon object (or null for bare-handed).
export function describeDamage(state, card, weaponUsed) {
  const parts = []
  parts.push({ label: 'monster', value: card.rank, op: '+' })

  const theme = getTheme(state.theme)
  const themeBonus = theme?.monsterRankBonus || 0
  if (themeBonus && theme) {
    parts.push({ label: theme.name, value: Math.abs(themeBonus), op: themeBonus < 0 ? '-' : '+' })
  }

  if (weaponUsed) {
    const ws = describeWeaponStrength(state, weaponUsed)
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

  const suitBonus = bonusVsSuitFor(state, card)
  if (suitBonus) parts.push({ label: suitBonus.name, value: suitBonus.amount, op: '-' })

  if (state.riposteCharge > 0) {
    parts.push({ label: 'Riposte', value: state.riposteCharge, op: '-' })
  }

  const raw = sumParts(parts)
  return { value: Math.max(0, raw), parts, clamped: raw < 0 }
}
