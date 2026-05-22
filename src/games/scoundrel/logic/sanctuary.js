import { SUIT_GLYPH, BASE_MAX_HP, isMonster, isWeapon, isPotion, rankLabel, suitColor } from '../constants'
import { BOONS } from '../boons'
import {
  appendLog,
  activeThemes,
  activeBoons, hasBoon, minMaxHpOverride,
  bonusVsSuitFor,
  sumParts,
} from './helpers'
import { computeCurrentDeck } from './deck'
import { isWeaponUsable, pickBestWeaponFor } from './combat'

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

// Skip the forge for this visit without applying any edit. Marks the
// forge as used so the sequencing in the UI knows the player is done
// with this stage.
export function skipForge(state) {
  if (state.phase !== 'sanctuary' || !state.forgeOpen || state.forgeUsed) return state
  return {
    ...state,
    forgeUsed: true,
    forgeView: null,
    log: [...state.log, 'You step away from the forge.'],
  }
}

// Strike's offering may match the monster's rank or fall up to this many
// ranks below it. A lighter blade can still balance the carving, within
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
  // cross-color carving (too far a reshape for the rite to hold).
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

// Returns the resolved list of active themes for this descent: the parent
// for single-theme nights, or the children of a compound theme like
// The Long Night. UI uses this to display theme expansively.
export function getActiveThemesForState(state) {
  return activeThemes(state)
}

// -- Numeric breakdown helpers (for UI transparency) -------------------
//
// Each describe* returns { value, parts } where parts is an array of
// { label, value, op }. Display layer formats as e.g. "23 (20 + 3 first run)".

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
