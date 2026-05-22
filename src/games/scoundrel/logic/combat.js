import { SUIT_GLYPH, isMonster, isWeapon, isPotion, rankLabel } from '../constants'
import { BOONS } from '../boons'
import {
  appendLog, fmt,
  activeThemes, themesFor, themeFieldSum, themeFlagAny, getRoomSize,
  effectiveMonsterRank,
  activeBoons, hasBoon, maxBoonField,
  computePotionsPerRoomLimit, effectiveWeaponRank, bonusVsSuitFor,
  markTutorialLesson,
} from './helpers'
import { endDescentDeath, endDescentVictory } from './lifecycle'

// -- HP loss / death checks --------------------------------------------

// Apply pre-mitigated HP damage, honoring Twin Souls and Second Wind.
// Used by combat, Tithe, and Apothecary's sour second potion.
// Returns { state, dead }. If dead, state is already in gameover phase.
export function applyHpLoss(state, amount) {
  let next = { ...state }
  // Numb soaks the first chunk of incoming damage each room (any source).
  if (hasBoon(state, 'numb') && (state.numbRemaining || 0) > 0 && amount > 0) {
    const absorbed = Math.min(state.numbRemaining, amount)
    amount = amount - absorbed
    next = appendLog(
      { ...next, numbRemaining: state.numbRemaining - absorbed },
      `Numb absorbs ${absorbed}. The hurt slides off.`
    )
  }
  next = { ...next, hp: next.hp - amount }

  if (next.hp <= 0 && hasBoon(next, 'twin_souls') && !next.twinSoulsUsed) {
    next = appendLog({ ...next, hp: 1, twinSoulsUsed: true },
      'Twin Souls: the second self steadies the body. You stand at 1 HP.')
  }
  if (next.hp <= 0) {
    return { state: endDescentDeath({ ...next, hp: 0 }), dead: true }
  }
  if (next.hp > 0 && next.hp <= 3 && hasBoon(next, 'second_wind') && !next.secondWindUsed) {
    next = appendLog({ ...next, hp: Math.min(next.maxHp, 6), secondWindUsed: true },
      'Second Wind catches you. Breath returns, HP steadies at 6.')
  }
  return { state: next, dead: false }
}

// -- Weapon usability --------------------------------------------------

// Cracked Blade lifts the binding cap. The weapon swings at any monster,
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
export function pickBestWeaponFor(state, monsterCard) {
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

export function isWeaponUsable(state, monsterCard) {
  return !!pickBestWeaponFor(state, monsterCard)
}

// -- Room entry effects -------------------------------------------------

// Apply Tithe (HP loss), Oath (face-down first new card), Echo (extra
// duplicate slot), and increment roomsEntered. Called once per time a new
// room is presented to the player: initial descend, refill, or a flee.
export function applyRoomEntryEffects(state, room, firstNewIdx) {
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
      `Echo: ${monsters.map(fmt).join(', ')} ${monsters.length === 1 ? 'echoes' : 'echo'} to the bottom of the deck.`)
  }

  // Tithe: lose HP per room entered. Can kill (honors Twin Souls / Second Wind).
  const titheLoss = themeFieldSum(themes, 'tithe')
  if (titheLoss > 0) {
    next = appendLog(next, `Tithe: the hall takes ${titheLoss} HP at the threshold.`)
    const result = applyHpLoss(next, titheLoss)
    return { state: result.state, room: nextRoom, dead: result.dead }
  }

  return { state: next, room: nextRoom, dead: false }
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
    // or no. You only get one "opening" per room.
    cowardsRewardCharge: wasFirstFight ? 0 : (state.cowardsRewardCharge || 0),
  }

  // Weapon update: under Cracked Blade, slaying above the weapon's own
  // rank shatters it; otherwise lastSlain advances normally.
  // Crushing Blow: if the kill cost you no HP (weapon, Hunter, Vanguard,
  // Riposte, whatever brought it to 0), the binding is untouched.
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
    // Bare-handed kills raise the equipped weapon's ceiling. Even slay
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
  // this card is itself a carrion revenant. One return per original.
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
    next = appendLog(next, `Carrion: ${fmt(monsterCard)} stirs again in the deck as ${fmt(revenant)}.`)
  }

  const glyph = SUIT_GLYPH[monsterCard.suit]
  const how = weaponUsed
    ? `with the ${rankLabel(weaponUsed.rank)}♦`
    : 'bare-handed'
  next = appendLog(next, `Fought ${rankLabel(monsterCard.rank)}${glyph} ${how}, took ${damage}.`)

  if (consumedCowardsCharge > 0 && weaponUsed) {
    next = appendLog(next, `Coward's Reward: the opening swing landed +${consumedCowardsCharge}.`)
  }

  if (weaponShattered) {
    next = appendLog(next, 'The blade shatters under the strain. Cracked Blade claims it.')
  }

  // Riposte: bank half this fight's actual damage (rounded down).
  if (hasBoon(next, 'riposte') && damage > 0) {
    const charge = Math.floor(damage / 2)
    if (charge > 0) {
      next.riposteCharge = charge
      next = appendLog(next, `Riposte holds: the next monster deals ${charge} less.`)
    }
  }

  const dmgResult = applyHpLoss(next, damage)
  if (dmgResult.dead) return dmgResult.state
  next = dmgResult.state

  next = markTutorialLesson(next, weaponUsed ? 'fight' : 'barehands')

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
      `Set aside ${fmt(card)}. Stoic. No draught passes your lips.`
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
    next = appendLog(next, `Sour draught: ${fmt(card)} bites back for ${damage}.`)
    const result = applyHpLoss(next, damage)
    if (result.dead) return result.state
    return checkRefillAndComplete(result.state)
  }

  // Normal heal path: first potion always, plus extras up to Sip's limit.
  if (playedNow < limit) {
    const healAmount = bitterBrew ? Math.floor(card.rank / 2) : card.rank
    const healed = Math.min(next.maxHp, next.hp + healAmount) - next.hp
    next.hp = next.hp + healed
    const note = bitterBrew ? 'bitter, ' : ''
    next = appendLog(next, `Drank ${fmt(card)}, ${note}restored ${healed} HP.`)
    next = markTutorialLesson(next, 'potion')
  } else {
    // Overflow path: Alchemist and Field Surgeon stack, each adds its bit.
    const alchAmt = hasBoon(next, 'alchemist') ? Math.ceil(card.rank / 2) : 0
    const surgAmt = hasBoon(next, 'field_surgeon') ? 1 : 0
    const totalHeal = alchAmt + surgAmt
    if (totalHeal > 0) {
      const healed = Math.min(next.maxHp, next.hp + totalHeal) - next.hp
      next.hp = next.hp + healed
      const reasons = []
      if (alchAmt) reasons.push('Alchemist')
      if (surgAmt) reasons.push('Field Surgeon')
      next = appendLog(next, `Overflow ${fmt(card)}: ${reasons.join(' and ')} drew ${healed} HP from the dregs.`)
    } else {
      next = appendLog(next, `Potion ${fmt(card)} wasted. No thirst left.`)
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

  const wasArmed = !!state.weapon
  let next = {
    ...state,
    room,
    discard: state.discard.concat(card),
    weapon: nextWeapon,
    spareWeapon: nextSpare,
  }
  const rustNote = rusty < 0
    ? ` (rusty, bites as a ${rankLabel(effectiveRank)})`
    : ''
  next = appendLog(next, `Took up the ${rankLabel(card.rank)}♦${rustNote}${swapNote}.`)
  next = markTutorialLesson(next, wasArmed ? 'replace' : 'equip')

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

export function checkRefillAndComplete(state) {
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
