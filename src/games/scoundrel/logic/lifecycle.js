import { SUIT_GLYPH, SIGIL_TARGET, FORGE_SIGILS, isMonster, isWeapon, isPotion, rankLabel } from '../constants'
import { getTheme, pickThemeId, resolveThemeChildren } from '../themes'
import { BOONS, pickBoonOffers } from '../boons'
import {
  appendLog,
  themesFor, themeFlagAny, getRoomSize,
  computeMaxHp,
  hasBoon,
  markTutorialLesson,
} from './helpers'
import { buildDescentDeck, buildTutorialDeck } from './deck'
import { applyRoomEntryEffects } from './combat'

// -- Run lifecycle ------------------------------------------------------

export function createRun(rng = Math.random, options = {}) {
  // On the very first sanctuary visit (before descent 1) there is no Boon
  // offer and no Forge. Descent 1 of every run runs under "The Quiet", a
  // friendly warm-up theme that gives +10 max HP. Tier-1 themes start at
  // descent 2.
  //
  // When `tutorial` is requested, the player walks a curated
  // descent first. Tutorial completion: no sigil, no boon, then The
  // Quiet starts as normal.
  const { tutorial = false } = options
  const nextTheme = tutorial ? 'tutorial' : 'the_quiet'

  return {
    phase: 'sanctuary',
    sigilsEarned: 0,
    sigilTarget: SIGIL_TARGET,
    tutorial,
    // Set of tutorial lessons the player has completed. Used by the
    // UI to decide when to stop recommending actions and showing
    // hover tips. Possible values: 'equip', 'fight', 'potion',
    // 'replace', 'barehands', 'flee'.
    tutorialLessons: [],
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
    themeDeckChanges: [],
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

  // Tutorial uses a hand-curated, unshuffled deck. Everything else
  // (theme effects, shuffle, etc) is skipped so the lesson hits each
  // card in the intended order.
  let deck, themeLog, themeDeckChanges
  if (state.tutorial) {
    deck = buildTutorialDeck()
    themeLog = []
    themeDeckChanges = []
  } else {
    const built = buildDescentDeck(state, themeId, themeChildren, state.rng)
    deck = built.deck.slice()
    themeLog = built.log
    themeDeckChanges = built.changes || []
  }
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

  // Carried weapons arrive rested (lastSlain cleared). DESIGN.md §2.
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
        ? `You descend. ${baseTheme.name.toLowerCase()} is upon the halls: ${themes.map(t => t.name).join(' and ')}.`
        : `You descend. ${baseTheme.name.toLowerCase()} is upon the halls.`)

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
    themeDeckChanges,
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
      `Wormwood: ${BOONS[mutedBoon]?.name} falls silent this descent.`)
  }

  // Apply first-room entry effects with slot 0 as the "first new card".
  const entry = applyRoomEntryEffects(descentState, descentState.room, 0)
  if (entry.dead) return entry.state
  return { ...entry.state, room: entry.room }
}

// -- Run end states -----------------------------------------------------

export function endDescentDeath(state) {
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

export function endDescentVictory(state) {
  const carriedWeapon = state.weapon ? { rank: state.weapon.rank, originalRank: state.weapon.originalRank } : null
  const carriedSpareWeapon = state.spareWeapon ? { rank: state.spareWeapon.rank, originalRank: state.spareWeapon.originalRank } : null

  // Tutorial completion: no sigil earned, no boon offer, no forge,
  // and the tutorial weapon does not carry into The Quiet. The
  // player starts that descent bare-handed, same as a real opening
  // run. Drop the tutorial flag, queue The Quiet, return to sanctuary
  // as an opening-style visit (boonChosen=true since no boon to pick).
  if (state.tutorial) {
    return appendLog(
      {
        ...state,
        tutorial: false,
        phase: 'sanctuary',
        carriedWeapon: null,
        carriedSpareWeapon: null,
        nextTheme: 'the_quiet',
        nextThemeChildren: null,
        boonOffers: [],
        boonChosen: true,
        forgeOpen: false,
        forgeUsed: false,
        forgeView: null,
        deck: [],
        room: [],
        theme: null,
        themeChildren: null,
        themeDeckChanges: [],
      },
      'The walk is done. The Quiet waits below.'
    )
  }

  const newSigils = state.sigilsEarned + 1

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
      themeDeckChanges: [],
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

// Oath marks the "first new card" of a room face-down. When a flee sends the
// room back to the bottom of the deck, that flag has to come off, or the card
// stays face-down on its next redraw and stacks with the new room's Oath card.
function stripFaceDown(card) {
  if (!card || !card.faceDown) return card
  const { faceDown, ...rest } = card
  return rest
}

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
  const themes = themesFor(state.theme, state.themeChildren)
  if (themeFlagAny(themes, 'cannotFlee')) return state

  const usingCloak = hasBoon(state, 'scoundrels_cloak') && !state.cloakUsed
  const targetSize = getRoomSize(themes)
  // Coward's Reward: each flee banks +1 on your next opening swing (cap 3).
  const cowardsCharge = hasBoon(state, 'cowards_reward')
    ? Math.min(3, (state.cowardsRewardCharge || 0) + 1)
    : (state.cowardsRewardCharge || 0)

  if (hasBoon(state, 'pickpocket')) {
    const filled = state.room.filter(Boolean)
    const kept = pickPocketTarget(filled)
    const keptIndex = kept ? state.room.findIndex(c => c && c.id === kept.id) : -1
    const others = kept ? filled.filter(c => c.id !== kept.id) : filled
    const deck = state.deck.concat(others.map(stripFaceDown))

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
      ? `You retreat, palmed ${rankLabel(kept.rank)}${SUIT_GLYPH[kept.suit]} on the way out.`
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
      usingCloak ? `${note} (Scoundrel's Cloak: you can flee again.)` : note
    )
    if (hasBoon(next, 'cowards_reward')) {
      next = appendLog(next, `Coward's Reward: opening swing banked at +${cowardsCharge}.`)
    }

    const entry = applyRoomEntryEffects(next, next.room, firstNewIdx)
    if (entry.dead) return entry.state
    return { ...entry.state, room: entry.room }
  }

  const carry = state.room.filter(Boolean).map(stripFaceDown)
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
      ? 'You retreat. The room scatters back into the dark. (Scoundrel\'s Cloak: you can flee again.)'
      : 'You retreat. The room scatters back into the dark.'
  )
  if (hasBoon(next, 'cowards_reward')) {
    next = appendLog(next, `Coward's Reward: opening swing banked at +${cowardsCharge}.`)
  }
  next = markTutorialLesson(next, 'flee')

  const entry = applyRoomEntryEffects(next, next.room, 0)
  if (entry.dead) return entry.state
  return { ...entry.state, room: entry.room }
}
