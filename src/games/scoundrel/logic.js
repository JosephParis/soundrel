import {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH, RANK_LABEL,
  BASE_MAX_HP, SIGIL_TARGET, FORGE_SIGILS, ROOM_SIZE,
  isMonster, isWeapon, isPotion, rankLabel, suitColor,
} from './constants'
import { THEMES, getTheme, getActiveThemes, pickThemeId, resolveThemeChildren } from './themes'
import { BOONS, getBoon, pickBoonOffers } from './boons'

export {
  HEART, DIAMOND, CLUB, SPADE,
  SUIT_GLYPH, RANK_LABEL,
  BASE_MAX_HP, SIGIL_TARGET, FORGE_SIGILS, ROOM_SIZE,
  isMonster, isWeapon, isPotion, rankLabel, suitColor,
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

// The "persistent deck" — base 44 minus strikes, with transmutes and hefts
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

// -- Formatting --------------------------------------------------------

function fmt(card) {
  return `${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]}`
}

// -- Theme helpers -----------------------------------------------------

function activeThemes(state) {
  return getActiveThemes(state.theme, state.themeChildren)
}

function themesFor(themeId, themeChildren) {
  return getActiveThemes(themeId, themeChildren)
}

function themeFieldSum(themes, field) {
  return themes.reduce((s, t) => s + (t[field] || 0), 0)
}

function themeFlagAny(themes, field) {
  return themes.some(t => t[field])
}

function getRoomSize(themes) {
  let size = ROOM_SIZE
  for (const t of themes) {
    if (t.roomSize && t.roomSize > size) size = t.roomSize
  }
  return size
}

// Themes that modify the deck return either a plain array (the new deck) or
// an object `{ deck, log }`. Compound themes chain through each child's
// applyToDeck in order, accumulating log lines.
function buildDescentDeck(state, themeId, themeChildren, rng) {
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

// -- Boon helpers ------------------------------------------------------

// Wormwood mutes one Boon for the descent. activeBoons filters it out so
// every effect-read consults the same gated list.
function activeBoons(state) {
  if (state.mutedBoon) return state.boons.filter(id => id !== state.mutedBoon)
  return state.boons
}

function hasBoon(state, id) {
  return activeBoons(state).includes(id)
}

function sumBoonField(boons, field) {
  return boons.reduce((sum, id) => sum + (BOONS[id]?.[field] || 0), 0)
}
function maxBoonField(boons, field, baseline) {
  return boons.reduce((m, id) => Math.max(m, BOONS[id]?.[field] || baseline), baseline)
}

function minMaxHpOverride(boons) {
  let acc = null
  for (const id of boons) {
    const o = BOONS[id]?.maxHpOverride
    if (o != null && (acc == null || o < acc)) acc = o
  }
  return acc
}

function computeMaxHp(state, themeId = state.theme, themeChildren = state.themeChildren) {
  const themes = themesFor(themeId, themeChildren)
  const boons = activeBoons(state)
  const override = minMaxHpOverride(boons)
  const base = override != null ? override : BASE_MAX_HP
  return base + sumBoonField(boons, 'maxHpBonus') + themeFieldSum(themes, 'maxHpBonus')
}

function computePotionsPerRoomLimit(boons) {
  return maxBoonField(boons, 'potionsPerRoom', 1)
}

function effectiveMonsterRank(state, card) {
  const themes = activeThemes(state)
  let bonus = 0
  for (const t of themes) {
    bonus += t.monsterRankBonus || 0
    bonus += t.monsterRankBonusBySuit?.[card.suit] || 0
  }
  return card.rank + bonus
}

function effectiveWeaponRank(state, weapon) {
  if (!weapon) return 0
  const boons = activeBoons(state)
  let bonus = sumBoonField(boons, 'weaponRankBonus')
  if (hasBoon(state, 'wounded_lion') && state.hp < 10) bonus += 2
  if (hasBoon(state, 'berserker')) bonus += (state.monstersFoughtThisRoom || 0)
  return Math.max(0, weapon.rank + bonus)
}

function bonusVsSuitFor(state, card) {
  for (const id of activeBoons(state)) {
    const b = BOONS[id]
    if (b?.bonusVsSuit && b.bonusVsSuit === card.suit) {
      return { amount: b.bonusVsSuitAmount || 0, name: b.name, id }
    }
  }
  return null
}

// -- Weapon helpers ----------------------------------------------------

// Cracked Blade lifts the binding cap — the weapon swings at any monster,
// but shatters if it kills above its previous high (handled in
// applyMonsterFight). Without that theme, the usual lastSlain rule applies.
function isWeaponBoundFor(state, weapon, monsterCard) {
  if (!weapon) return false
  if (!weapon.lastSlain) return true
  if (themeFlagAny(activeThemes(state), 'crackedBlade')) return true
  return monsterCard.rank <= weapon.lastSlain.rank
}

// Pick the best weapon for swinging at this monster.
// Prefers the highest *effective* rank among usable weapons.
function pickBestWeaponFor(state, monsterCard) {
  const candidates = []
  if (state.weapon && isWeaponBoundFor(state, state.weapon, monsterCard)) {
    candidates.push({ weapon: state.weapon, slot: 'primary' })
  }
  if (state.spareWeapon && isWeaponBoundFor(state, state.spareWeapon, monsterCard)) {
    candidates.push({ weapon: state.spareWeapon, slot: 'spare' })
  }
  if (candidates.length === 0) return null
  return candidates.reduce((best, cur) => {
    const a = effectiveWeaponRank(state, best.weapon)
    const b = effectiveWeaponRank(state, cur.weapon)
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

// -- HP loss / death checks --------------------------------------------

// Apply pre-mitigated HP damage, honoring Twin Souls and Second Wind.
// Used by combat, Tithe, and Apothecary's sour second potion.
// Returns { state, dead }. If dead, state is already in gameover phase.
function applyHpLoss(state, amount) {
  let next = { ...state }
  // Numb soaks the first chunk of incoming damage each room (any source).
  if (hasBoon(state, 'numb') && (state.numbRemaining || 0) > 0 && amount > 0) {
    const absorbed = Math.min(state.numbRemaining, amount)
    amount = amount - absorbed
    next = appendLog(
      { ...next, numbRemaining: state.numbRemaining - absorbed },
      `Numb absorbs ${absorbed} — the hurt slides off.`
    )
  }
  next = { ...next, hp: next.hp - amount }

  if (next.hp <= 0 && hasBoon(next, 'twin_souls') && !next.twinSoulsUsed) {
    next = appendLog({ ...next, hp: 1, twinSoulsUsed: true },
      'Twin Souls — the second self steadies the body. You stand at 1 HP.')
  }
  if (next.hp <= 0) {
    return { state: endDescentDeath({ ...next, hp: 0 }), dead: true }
  }
  if (next.hp > 0 && next.hp <= 3 && hasBoon(next, 'second_wind') && !next.secondWindUsed) {
    next = appendLog({ ...next, hp: Math.min(next.maxHp, 6), secondWindUsed: true },
      'Second Wind catches you — breath returns, HP steadies at 6.')
  }
  return { state: next, dead: false }
}

// -- Room entry effects -------------------------------------------------

// Apply Tithe (HP loss), Oath (face-down first new card), Echo (extra
// duplicate slot), and increment roomsEntered. Called once per time a new
// room is presented to the player: initial descend, refill, or a flee.
function applyRoomEntryEffects(state, room, firstNewIdx) {
  const themes = activeThemes(state)
  const roomsEntered = (state.roomsEntered || 0) + 1
  let next = { ...state, roomsEntered }
  // Refresh Numb's per-room shield before any room-entry damage (Tithe).
  if (hasBoon(next, 'numb')) {
    next = { ...next, numbRemaining: 2 }
  }
  let nextRoom = room.slice()

  // Oath: mark the first newly-drawn card face-down.
  if (themeFlagAny(themes, 'oath') && firstNewIdx != null && nextRoom[firstNewIdx]) {
    nextRoom[firstNewIdx] = { ...nextRoom[firstNewIdx], faceDown: true }
  }

  // Echo: every Nth room, every monster in the room is duplicated and slid
  // to the bottom of the deck. The dead come back round.
  for (const t of themes) {
    if (!t.echo) continue
    if (roomsEntered % t.echo !== 0) continue
    const monsters = nextRoom.filter(c => c && isMonster(c))
    if (monsters.length === 0) continue
    const dups = monsters.map(m => ({
      ...m,
      id: `${m.id}_echo${roomsEntered}`,
      faceDown: false,
    }))
    next = { ...next, deck: next.deck.concat(dups) }
    next = appendLog(next,
      `Echo — ${monsters.map(fmt).join(', ')} ${monsters.length === 1 ? 'echoes' : 'echo'} to the bottom of the deck.`)
  }

  // Tithe: lose HP per room entered. Can kill (honors Twin Souls / Second Wind).
  const titheLoss = themeFieldSum(themes, 'tithe')
  if (titheLoss > 0) {
    next = appendLog(next, `Tithe — the hall takes ${titheLoss} HP at the threshold.`)
    const result = applyHpLoss(next, titheLoss)
    return { state: result.state, room: nextRoom, dead: result.dead }
  }

  return { state: next, room: nextRoom, dead: false }
}

// -- Run lifecycle ------------------------------------------------------

export function createRun(rng = Math.random) {
  // On the very first sanctuary visit (before descent 1) there is no Boon
  // offer and no Forge. Descent 1 of every run runs under "The Quiet" — a
  // friendly warm-up theme that gives +10 max HP. Tier-1 themes start at
  // descent 2.
  const nextTheme = 'the_quiet'

  return {
    phase: 'sanctuary',
    sigilsEarned: 0,
    sigilTarget: SIGIL_TARGET,
    boons: [],
    strikes: [],
    transmutes: {},
    hefts: {},
    carriedWeapon: null,
    carriedSpareWeapon: null,
    rng,

    boonOffers: [],
    nextTheme,
    nextThemeChildren: null,
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
    themeChildren: null,
    monstersFoughtThisRoom: 0,
    lastMonsterSuit: null,
    roomsEntered: 0,
    mutedBoon: null,

    // Per-descent transient charges (reset at descent start)
    riposteCharge: 0,
    secondWindUsed: false,
    cloakUsed: false,
    twinSoulsUsed: false,
    cowardsRewardCharge: 0,
    numbRemaining: 0,

    log: ['You wake in the great hall. The rune-chains hum.'],
  }
}

export function startNewRun(rng = Math.random) {
  return createRun(rng)
}

// -- Descend ------------------------------------------------------------

export function descend(state) {
  if (state.phase !== 'sanctuary') return state
  if (!state.boonChosen) return state

  const themeId = state.nextTheme
  const themeChildren = state.nextThemeChildren
  const themes = themesFor(themeId, themeChildren)

  const { deck: builtDeck, log: themeLog } = buildDescentDeck(state, themeId, themeChildren, state.rng)
  const deck = builtDeck.slice()
  const roomSize = getRoomSize(themes)
  const room = deck.splice(0, roomSize)

  // Wormwood mutes one random Boon for this descent. Decided first so the
  // mute is in effect when computeMaxHp reads Iron Will / Glass Cannon.
  let mutedBoon = null
  if (themeFlagAny(themes, 'wormwood') && state.boons.length > 0) {
    mutedBoon = state.boons[Math.floor(state.rng() * state.boons.length)]
  }
  const muteState = mutedBoon ? { ...state, mutedBoon } : state
  const maxHp = computeMaxHp(muteState, themeId, themeChildren)

  // Carried weapons arrive rested (lastSlain cleared) — DESIGN.md §2.
  const weapon = state.carriedWeapon
    ? { rank: state.carriedWeapon.rank, originalRank: state.carriedWeapon.originalRank, lastSlain: null }
    : null
  const spareWeapon = state.carriedSpareWeapon
    ? { rank: state.carriedSpareWeapon.rank, originalRank: state.carriedSpareWeapon.originalRank, lastSlain: null }
    : null

  const baseTheme = getTheme(themeId)
  const baseLine = !baseTheme
    ? 'You descend. The dungeon is quiet tonight; the deep dream is still asleep.'
    : (themes.length > 1
        ? `You descend. Tonight, ${baseTheme.name.toLowerCase()} is upon the halls — ${themes.map(t => t.name).join(' and ')}.`
        : `You descend. Tonight, ${baseTheme.name.toLowerCase()} is upon the halls.`)

  const canFlee = !themeFlagAny(themes, 'cannotFlee')

  let descentState = {
    ...state,
    phase: 'descent',
    hp: maxHp,
    maxHp,
    deck,
    room,
    weapon,
    spareWeapon,
    potionsUsedThisRoom: 0,
    canFlee,
    discard: [],
    theme: themeId,
    themeChildren,
    monstersFoughtThisRoom: 0,
    lastMonsterSuit: null,
    roomsEntered: 0,
    mutedBoon,
    forgeView: null,
    riposteCharge: 0,
    secondWindUsed: false,
    cloakUsed: false,
    twinSoulsUsed: false,
    cowardsRewardCharge: 0,
    numbRemaining: 0,
    log: [baseLine, ...themeLog],
  }

  if (mutedBoon) {
    descentState = appendLog(descentState,
      `Wormwood — ${BOONS[mutedBoon]?.name} falls silent this descent.`)
  }

  // Apply first-room entry effects with slot 0 as the "first new card".
  const entry = applyRoomEntryEffects(descentState, descentState.room, 0)
  if (entry.dead) return entry.state
  return { ...entry.state, room: entry.room }
}

// -- Combat -------------------------------------------------------------

// Returns the damage the player takes from this monster, given the chosen
// weapon (or null for bare-handed). Applies theme rank bonuses, Vanguard,
// Vendetta/Hunter and Riposte in that order.
function getMonsterDamage(state, monsterCard, weaponUsed) {
  const effRank = effectiveMonsterRank(state, monsterCard)

  let dmg
  if (weaponUsed) {
    const weapRank = effectiveWeaponRank(state, weaponUsed)
    dmg = Math.max(0, effRank - weapRank)
  } else {
    dmg = effRank
    const brawler = maxBoonField(activeBoons(state), 'brawlerReduction', 0)
    if (brawler > 0) dmg = Math.max(0, dmg - brawler)
  }
  if (state.monstersFoughtThisRoom === 0) {
    const reduction = maxBoonField(activeBoons(state), 'vanguardReduction', 0)
    dmg = Math.max(0, dmg - reduction)
    if (weaponUsed && hasBoon(state, 'cowards_reward') && (state.cowardsRewardCharge || 0) > 0) {
      dmg = Math.max(0, dmg - state.cowardsRewardCharge)
    }
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
  const wasFirstFight = state.monstersFoughtThisRoom === 0
  const consumedCowardsCharge = wasFirstFight ? (state.cowardsRewardCharge || 0) : 0
  const room = state.room.slice()
  room[index] = null

  const themes = activeThemes(state)

  let next = {
    ...state,
    room,
    discard: state.discard.concat(monsterCard),
    monstersFoughtThisRoom: state.monstersFoughtThisRoom + 1,
    lastMonsterSuit: monsterCard.suit,
    riposteCharge: 0,
    // Coward's Reward charge is spent on the first fight of a room, weapon
    // or no — you only get one "opening" per room.
    cowardsRewardCharge: wasFirstFight ? 0 : (state.cowardsRewardCharge || 0),
  }

  // Weapon update: under Cracked Blade, slaying above the weapon's own
  // rank shatters it; otherwise lastSlain advances normally.
  // Crushing Blow: if the kill cost you no HP — weapon, Hunter, Vanguard,
  // Riposte, whatever brought it to 0 — the binding is untouched.
  let weaponShattered = false
  if (chosen) {
    const shatters = themeFlagAny(themes, 'crackedBlade') && monsterCard.rank > weaponUsed.rank
    if (shatters) {
      weaponShattered = true
      if (chosen.slot === 'primary') next.weapon = null
      else next.spareWeapon = null
    } else {
      const crushed = hasBoon(state, 'crushing_blow') && damage === 0
      if (!crushed) {
        const updated = { ...weaponUsed, lastSlain: { rank: monsterCard.rank } }
        if (chosen.slot === 'primary') next.weapon = updated
        else next.spareWeapon = updated
      }
    }
  } else if (hasBoon(state, 'executioner')) {
    // Bare-handed kills raise the equipped weapon's ceiling — even slay
    // a K with your fists to free the blade for everything below.
    const lift = (w) => {
      if (!w) return w
      const prior = w.lastSlain?.rank ?? 0
      if (monsterCard.rank <= prior) return w
      return { ...w, lastSlain: { rank: monsterCard.rank } }
    }
    next.weapon = lift(next.weapon)
    next.spareWeapon = lift(next.spareWeapon)
  }

  // Carrion: slain monsters return once at rank 2 of their suit. Skip if
  // this card is itself a carrion revenant — one return per original.
  if (themeFlagAny(themes, 'carrion') && !monsterCard.carrioned) {
    const revenant = {
      suit: monsterCard.suit,
      rank: 2,
      id: `${monsterCard.id}_carrion`,
      carrioned: true,
    }
    const deck = next.deck.slice()
    const insertAt = deck.length === 0 ? 0 : Math.floor(state.rng() * (deck.length + 1))
    deck.splice(insertAt, 0, revenant)
    next = { ...next, deck }
    next = appendLog(next, `Carrion — ${fmt(monsterCard)} stirs again in the deck as ${fmt(revenant)}.`)
  }

  const glyph = SUIT_GLYPH[monsterCard.suit]
  const how = weaponUsed
    ? `with the ${rankLabel(weaponUsed.rank)}♦`
    : 'bare-handed'
  next = appendLog(next, `Fought ${rankLabel(monsterCard.rank)}${glyph} ${how} — took ${damage}.`)

  if (consumedCowardsCharge > 0 && weaponUsed) {
    next = appendLog(next, `Coward's Reward — the opening swing landed +${consumedCowardsCharge}.`)
  }

  if (weaponShattered) {
    next = appendLog(next, 'The blade shatters under the strain — Cracked Blade claims it.')
  }

  // Riposte: bank half this fight's actual damage (rounded down).
  if (hasBoon(next, 'riposte') && damage > 0) {
    const charge = Math.floor(damage / 2)
    if (charge > 0) {
      next.riposteCharge = charge
      next = appendLog(next, `Riposte holds — the next monster deals ${charge} less.`)
    }
  }

  const dmgResult = applyHpLoss(next, damage)
  if (dmgResult.dead) return dmgResult.state
  next = dmgResult.state

  return checkRefillAndComplete(next)
}

// -- Card plays ---------------------------------------------------------

function playPotion(state, index, card) {
  const room = state.room.slice()
  room[index] = null
  const limit = computePotionsPerRoomLimit(activeBoons(state))
  const themes = activeThemes(state)
  const apothecary = themeFlagAny(themes, 'secondPotionDamages')
  const bitterBrew = themeFlagAny(themes, 'potionHealHalf')
  const playedNow = state.potionsUsedThisRoom

  // Stoic: hearts pass straight to the discard, no heal, no apothecary bite,
  // no alchemist dregs. The +10 max HP is the entire compensation.
  if (hasBoon(state, 'stoic')) {
    const next = appendLog(
      { ...state, room, discard: state.discard.concat(card) },
      `Set aside ${fmt(card)} — Stoic. No draught passes your lips.`
    )
    return checkRefillAndComplete(next)
  }

  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    potionsUsedThisRoom: state.potionsUsedThisRoom + 1,
  }

  // Apothecary: any potion after the first damages instead of healing.
  if (apothecary && playedNow >= 1) {
    const damage = card.rank
    next = appendLog(next, `Sour draught — ${fmt(card)} bites back for ${damage}.`)
    const result = applyHpLoss(next, damage)
    if (result.dead) return result.state
    return checkRefillAndComplete(result.state)
  }

  // Normal heal path — first potion always, plus extras up to Sip's limit.
  if (playedNow < limit) {
    const healAmount = bitterBrew ? Math.floor(card.rank / 2) : card.rank
    const healed = Math.min(next.maxHp, next.hp + healAmount) - next.hp
    next.hp = next.hp + healed
    const note = bitterBrew ? 'bitter, ' : ''
    next = appendLog(next, `Drank ${fmt(card)} — ${note}restored ${healed} HP.`)
  } else {
    // Overflow path: Alchemist and Field Surgeon stack — each adds its bit.
    const alchAmt = hasBoon(next, 'alchemist') ? Math.ceil(card.rank / 2) : 0
    const surgAmt = hasBoon(next, 'field_surgeon') ? 1 : 0
    const totalHeal = alchAmt + surgAmt
    if (totalHeal > 0) {
      const healed = Math.min(next.maxHp, next.hp + totalHeal) - next.hp
      next.hp = next.hp + healed
      const reasons = []
      if (alchAmt) reasons.push('Alchemist')
      if (surgAmt) reasons.push('Field Surgeon')
      next = appendLog(next, `Overflow ${fmt(card)} — ${reasons.join(' and ')} drew ${healed} HP from the dregs.`)
    } else {
      next = appendLog(next, `Potion ${fmt(card)} wasted — no thirst left.`)
    }
  }

  return checkRefillAndComplete(next)
}

function playWeapon(state, index, card) {
  const room = state.room.slice()
  room[index] = null

  const themes = activeThemes(state)
  const rusty = themeFieldSum(themes, 'weaponRankModifier')
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
  // Iron Bones forbids bare-handed fights while a usable weapon is equipped.
  if (themeFlagAny(activeThemes(state), 'ironBones') && isWeaponUsable(state, card)) {
    return state
  }
  return applyMonsterFight(state, card, index, false)
}

// -- Room refill / descent completion ----------------------------------

function checkRefillAndComplete(state) {
  const remaining = state.room.filter(Boolean)

  if (state.deck.length === 0 && remaining.length === 0) {
    return endDescentVictory(state)
  }

  if (remaining.length === 1) {
    const themes = activeThemes(state)
    const targetSize = getRoomSize(themes)

    // Rebuild a fixed-size room: place the leftover (in its old slot if it
    // still fits, else slot 0), then fill the rest from the deck.
    const leftover = state.room.find(Boolean)
    const leftoverIdx = state.room.findIndex(c => c && c.id === leftover.id)
    const slot = leftoverIdx < targetSize ? leftoverIdx : 0

    const newRoom = new Array(targetSize).fill(null)
    newRoom[slot] = leftover

    let next = state
    const deck = next.deck.slice()
    let firstNewIdx = null
    for (let i = 0; i < newRoom.length; i++) {
      if (newRoom[i] === null && deck.length > 0) {
        newRoom[i] = deck.shift()
        if (firstNewIdx === null) firstNewIdx = i
      }
    }

    next = {
      ...next,
      deck,
      room: newRoom,
      potionsUsedThisRoom: 0,
      canFlee: !themeFlagAny(themes, 'cannotFlee'),
      monstersFoughtThisRoom: 0,
    }

    const entry = applyRoomEntryEffects(next, next.room, firstNewIdx)
    if (entry.dead) return entry.state
    return { ...entry.state, room: entry.room }
  }

  return state
}

function endDescentDeath(state) {
  return appendLog(
    { ...state, phase: 'gameover' },
    'You fall in the dark. The hall above forgets you.'
  )
}

export function retireRun(state) {
  if (state.phase !== 'sanctuary' && state.phase !== 'descent') return state
  return appendLog(
    { ...state, phase: 'gameover', retired: true },
    'You lay down your blade and walk back into the light.'
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
  const nextTheme = pickThemeId(rng, newSigils)
  const nextThemeChildren = resolveThemeChildren(nextTheme, rng)
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
      nextThemeChildren,
      boonOffers,
      forgeOpen,
      forgeUsed: false,
      boonChosen: false,
      forgeView: null,

      // Wipe descent-only state
      deck: [],
      room: [],
      theme: null,
      themeChildren: null,
      weapon: null,
      spareWeapon: null,
      discard: [],
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
      lastMonsterSuit: null,
      roomsEntered: 0,
      mutedBoon: null,
      riposteCharge: 0,
      secondWindUsed: false,
      cloakUsed: false,
      twinSoulsUsed: false,
      cowardsRewardCharge: 0,
      numbRemaining: 0,
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
  const themes = activeThemes(state)
  if (themeFlagAny(themes, 'cannotFlee')) return state

  const usingCloak = hasBoon(state, 'scoundrels_cloak') && !state.cloakUsed
  const targetSize = getRoomSize(themes)
  // Coward's Reward — each flee banks +1 on your next opening swing (cap 3).
  const cowardsCharge = hasBoon(state, 'cowards_reward')
    ? Math.min(3, (state.cowardsRewardCharge || 0) + 1)
    : (state.cowardsRewardCharge || 0)

  if (hasBoon(state, 'pickpocket')) {
    const filled = state.room.filter(Boolean)
    const kept = pickPocketTarget(filled)
    const keptIndex = kept ? state.room.findIndex(c => c && c.id === kept.id) : -1
    const others = kept ? filled.filter(c => c.id !== kept.id) : filled
    const deck = state.deck.concat(others)

    const newRoom = new Array(targetSize).fill(null)
    if (kept && keptIndex >= 0 && keptIndex < targetSize) newRoom[keptIndex] = kept
    let firstNewIdx = null
    for (let i = 0; i < newRoom.length; i++) {
      if (newRoom[i] === null && deck.length > 0) {
        newRoom[i] = deck.shift()
        if (firstNewIdx === null) firstNewIdx = i
      }
    }

    const note = kept
      ? `You retreat — palmed ${rankLabel(kept.rank)}${SUIT_GLYPH[kept.suit]} on the way out.`
      : 'You retreat. The room scatters back into the dark.'
    let next = appendLog(
      {
        ...state,
        deck,
        room: newRoom,
        canFlee: usingCloak,
        cloakUsed: usingCloak ? true : state.cloakUsed,
        potionsUsedThisRoom: 0,
        monstersFoughtThisRoom: 0,
        cowardsRewardCharge: cowardsCharge,
      },
      usingCloak ? `${note} (Scoundrel's Cloak — you can flee again.)` : note
    )
    if (hasBoon(next, 'cowards_reward')) {
      next = appendLog(next, `Coward's Reward — opening swing banked at +${cowardsCharge}.`)
    }

    const entry = applyRoomEntryEffects(next, next.room, firstNewIdx)
    if (entry.dead) return entry.state
    return { ...entry.state, room: entry.room }
  }

  const carry = state.room.filter(Boolean)
  const deck = state.deck.concat(carry)
  const room = deck.splice(0, targetSize)

  let next = appendLog(
    {
      ...state,
      deck,
      room,
      canFlee: usingCloak,
      cloakUsed: usingCloak ? true : state.cloakUsed,
      potionsUsedThisRoom: 0,
      monstersFoughtThisRoom: 0,
      cowardsRewardCharge: cowardsCharge,
    },
    usingCloak
      ? 'You retreat. The room scatters back into the dark. (Scoundrel\'s Cloak — you can flee again.)'
      : 'You retreat. The room scatters back into the dark.'
  )
  if (hasBoon(next, 'cowards_reward')) {
    next = appendLog(next, `Coward's Reward — opening swing banked at +${cowardsCharge}.`)
  }

  const entry = applyRoomEntryEffects(next, next.room, 0)
  if (entry.dead) return entry.state
  return { ...entry.state, room: entry.room }
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

// Strike's offering may match the monster's rank or fall up to this many
// ranks below it — a lighter blade can still balance the carving, within
// reason. K and A monsters are effectively immune since no offering reaches
// their weight (rank ≤ 10 cap on hearts and diamonds).
export const STRIKE_OFFERING_RANGE = 2

export function applyStrike(state, monsterId, offeringId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const monster = current.find(c => c.id === monsterId)
  const offering = current.find(c => c.id === offeringId)
  if (!monster || !offering) return state
  if (!isMonster(monster)) return state
  if (!(isWeapon(offering) || isPotion(offering))) return state
  const diff = monster.rank - offering.rank
  if (diff < 0 || diff > STRIKE_OFFERING_RANGE) return state

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
  // Color-locked: ♥↔♦ and ♣↔♠ only. The threshold won't accept a
  // cross-color carving — too far a reshape for the rite to hold.
  if (suitColor(card.suit) !== suitColor(newSuit)) return state

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

export const HEFT_BONUS = 2
export const HEFT_RANK_CAP = 10

export function applyHeft(state, cardId) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  const current = computeCurrentDeck(state)
  const card = current.find(c => c.id === cardId)
  if (!card) return state
  if (!(isWeapon(card) || isPotion(card))) return state
  if (card.rank + HEFT_BONUS > HEFT_RANK_CAP) return state
  // Stack with any prior heft on this card (still capped).
  const prior = state.hefts?.[cardId] || 0
  const next = prior + HEFT_BONUS

  return appendLog(
    {
      ...state,
      hefts: { ...(state.hefts || {}), [cardId]: next },
      forgeUsed: true,
      forgeView: null,
    },
    `Hefted ${rankLabel(card.rank)}${SUIT_GLYPH[card.suit]} → ${rankLabel(card.rank + HEFT_BONUS)}${SUIT_GLYPH[card.suit]}.`
  )
}

// -- Convenience inspection (used by UI) -------------------------------

export function getStrikeOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return { monsters: [], byRank: {} }
  const current = computeCurrentDeck(state)
  const monsters = current.filter(c => isMonster(c))
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

// Heft can target any weapon or potion whose rank, after the +2 bonus,
// still respects the lore cap (no king-grade weapons or potions).
export function getHeftOptions(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen) return []
  return computeCurrentDeck(state).filter(
    c => (isWeapon(c) || isPotion(c)) && c.rank + HEFT_BONUS <= HEFT_RANK_CAP
  )
}

export function isWeaponUsableFor(state, card) {
  return isWeaponUsable(state, card)
}

export function previewMonsterDamage(state, card) {
  if (!card || !isMonster(card)) {
    return { weapon: null, bare: { value: 0, parts: [], clamped: false }, faceDown: false }
  }
  if (card.faceDown) {
    return { weapon: null, bare: null, faceDown: true }
  }
  const bare = describeDamage(state, card, null)
  const chosen = pickBestWeaponFor(state, card)
  const weapon = chosen ? describeDamage(state, card, chosen.weapon) : null
  return { weapon, bare, faceDown: false }
}

// Returns the resolved list of active themes for this descent — the parent
// for single-theme nights, or the children of a compound theme like
// The Long Night. UI uses this to display "tonight's air" expansively.
export function getActiveThemesForState(state) {
  return activeThemes(state)
}

// -- Numeric breakdown helpers (for UI transparency) -------------------
//
// Each describe* returns { value, parts } where parts is an array of
// { label, value, op }. Display layer formats as e.g. "23 (20 + 3 first run)".

function sumParts(parts) {
  return parts.reduce((s, p) => s + (p.op === '-' ? -p.value : p.value), 0)
}

export function describeMaxHp(state) {
  const boons = activeBoons(state)
  const override = minMaxHpOverride(boons)
  const baseValue = override != null ? override : BASE_MAX_HP
  const overrideBoon = override != null
    ? boons.find(id => BOONS[id]?.maxHpOverride === override)
    : null
  const baseLabel = overrideBoon ? BOONS[overrideBoon].name : 'base'

  const parts = [{ label: baseLabel, value: baseValue, op: '+' }]
  for (const id of boons) {
    const bonus = BOONS[id]?.maxHpBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  for (const t of activeThemes(state)) {
    if (!t.maxHpBonus) continue
    parts.push({
      label: t.name,
      value: Math.abs(t.maxHpBonus),
      op: t.maxHpBonus > 0 ? '+' : '-',
    })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// Describe the strength of a specific weapon (or state.weapon by default).
export function describeWeaponStrength(state, weapon = state.weapon) {
  if (!weapon) return null
  const parts = [{ label: 'base', value: weapon.rank, op: '+' }]
  for (const id of activeBoons(state)) {
    const bonus = BOONS[id]?.weaponRankBonus || 0
    if (bonus > 0) parts.push({ label: BOONS[id].name, value: bonus, op: '+' })
    else if (bonus < 0) parts.push({ label: BOONS[id].name, value: -bonus, op: '-' })
  }
  if (hasBoon(state, 'wounded_lion') && state.hp < 10) {
    parts.push({ label: 'Wounded Lion', value: 2, op: '+' })
  }
  if (hasBoon(state, 'berserker') && (state.monstersFoughtThisRoom || 0) > 0) {
    parts.push({ label: 'Berserker', value: state.monstersFoughtThisRoom, op: '+' })
  }
  return { value: Math.max(0, sumParts(parts)), parts }
}

// `weaponUsed` is the actual weapon object (or null for bare-handed).
export function describeDamage(state, card, weaponUsed) {
  const parts = []
  parts.push({ label: 'monster', value: card.rank, op: '+' })

  const themes = activeThemes(state)
  for (const t of themes) {
    const bonus = t.monsterRankBonus || 0
    if (bonus) parts.push({ label: t.name, value: Math.abs(bonus), op: bonus < 0 ? '-' : '+' })
    const suitBonus = t.monsterRankBonusBySuit?.[card.suit] || 0
    if (suitBonus) parts.push({ label: t.name, value: Math.abs(suitBonus), op: suitBonus < 0 ? '-' : '+' })
  }

  if (weaponUsed) {
    const ws = describeWeaponStrength(state, weaponUsed)
    if (ws) parts.push({ label: 'weapon', value: ws.value, op: '-' })
  } else {
    for (const id of activeBoons(state)) {
      const reduction = BOONS[id]?.brawlerReduction || 0
      if (reduction) {
        parts.push({ label: BOONS[id].name, value: reduction, op: '-' })
        break
      }
    }
  }

  if (state.monstersFoughtThisRoom === 0) {
    for (const id of activeBoons(state)) {
      const reduction = BOONS[id]?.vanguardReduction || 0
      if (reduction) {
        parts.push({ label: BOONS[id].name, value: reduction, op: '-' })
        break
      }
    }
    if (weaponUsed && hasBoon(state, 'cowards_reward') && (state.cowardsRewardCharge || 0) > 0) {
      parts.push({ label: "Coward's Reward", value: state.cowardsRewardCharge, op: '-' })
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
