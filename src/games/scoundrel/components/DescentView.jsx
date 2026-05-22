import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  playCard, playCardBare, fleeRoom,
  getTheme,
  isMonster, isWeapon, isPotion,
  previewMonsterDamage,
  tutorialAllLessonsDone,
} from '../logic'
import { PhaseRail, LogPanel } from './atoms'
import { CardSlot, HpBar, WeaponPanel, ConditionsPanel, ForesightPanel } from './cards'

export function DescentView({ game, setGame }) {
  // When the player commits to a face-down card (Oath), flip it visibly first,
  // then resolve. revealing holds the room index of the card mid-reveal.
  const [revealing, setRevealing] = useState(null)
  // Theme intro: shown once when the descent mounts. Auto-dismisses, but the
  // player can tap to skip ahead.
  const [introOpen, setIntroOpen] = useState(true)
  useEffect(() => {
    if (!introOpen) return
    const t = setTimeout(() => setIntroOpen(false), 4200)
    return () => clearTimeout(t)
  }, [introOpen])
  useEffect(() => {
    if (!introOpen) return
    const onKey = (e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') setIntroOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [introOpen])

  const onCard = useCallback((i) => {
    if (revealing != null) return
    const card = game.room[i]
    if (card?.faceDown) {
      setRevealing(i)
      return
    }
    setGame(g => playCard(g, i))
  }, [game.room, revealing, setGame])
  const onCardBare = useCallback((i) => {
    if (revealing != null) return
    setGame(g => playCardBare(g, i))
  }, [revealing, setGame])
  const onFlee = useCallback(() => {
    if (revealing != null) return
    setGame(g => fleeRoom(g))
  }, [revealing, setGame])

  useEffect(() => {
    if (revealing == null) return
    const t = setTimeout(() => {
      setGame(g => playCard(g, revealing))
      setRevealing(null)
    }, 1400)
    return () => clearTimeout(t)
  }, [revealing, setGame])

  const theme = getTheme(game.theme)

  const themeIronBones = (game.themeChildren
    ? game.themeChildren.map(id => getTheme(id))
    : [theme]
  ).some(t => t && t.ironBones)

  const childNames = (game.themeChildren || [])
    .map(id => getTheme(id)?.name)
    .filter(Boolean)

  // Tutorial cue: recommends one card per turn based on game state.
  // Recomputes whenever the room or weapon binding changes. Stops
  // recommending (and hides hover tips) once the player has done
  // every action the walkthrough exists to teach.
  const tutorialActive = game.tutorial && !tutorialAllLessonsDone(game)
  const tutorialCue = useMemo(
    () => (tutorialActive ? computeTutorialCue(game) : null),
    [tutorialActive, game]
  )
  // Inline lesson notes that show up in the tutorial banner when the
  // relevant game state is live (weapon bound + something in room
  // would be locked; a potion already drunk this room while another
  // sits in the room). Persistent rather than one-shot so the player
  // can't miss them.
  const tutorialContextHints = useMemo(() => {
    if (!tutorialActive) return []
    const hints = []
    if (game.weapon?.lastSlain) {
      const bound = game.weapon.lastSlain.rank
      hints.push(
        `Weapon binding: your blade is bound at ${bound}. It can only be used to swing at rank ${bound} or lower.`
      )
    }
    if (game.potionsUsedThisRoom > 0) {
      const morePotions = game.room.some(c => c && isPotion(c))
      hints.push(
        morePotions
          ? `Potion limit: you've already healed this room. The other potion here will pass through wasted.`
          : `Potion limit: only the first potion drunk in a room heals. Any extras are wasted.`
      )
    }
    return hints
  }, [tutorialActive, game.weapon, game.room, game.potionsUsedThisRoom])

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] gap-6 animate-fade-in items-start">
      {introOpen && (
        <ThemeIntroOverlay
          theme={theme}
          themeChildren={game.themeChildren}
          onDismiss={() => setIntroOpen(false)}
        />
      )}

      <PhaseRail
        title={theme?.name || 'Descent'}
        subtitle={childNames.length > 0 ? childNames.join(' + ') : null}
      >
        <HpBar hp={game.hp} maxHp={game.maxHp} />
        <WeaponPanel game={game} />
        <ConditionsPanel game={game} theme={theme} />
        <LogPanel lines={game.log} collapsible />
      </PhaseRail>

      <div className="space-y-5 min-w-0">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-slate-500">The room</h2>
            <div className="text-[11px] text-slate-500">
              Deck <span className="font-mono text-slate-300">{game.deck.length}</span> remain
            </div>
          </div>
          {game.tutorial && (
            tutorialActive ? (
              <div className="mb-3 panel panel-warm p-4 text-[14px] text-slate-300 leading-relaxed space-y-2">
                <div>
                  <span className="text-rune font-semibold uppercase text-[11px] tracking-[0.2em] mr-2">Tutorial</span>
                  The glowing card is the recommended next move. Hover any card for an explanation.
                </div>
                <div className="text-slate-400 text-[13px]">
                  If a room looks unwinnable, <span className="text-rune">Flee the room</span> below sends all 4 cards to the bottom of the deck and deals 4 fresh. You can't flee twice in a row.
                </div>
                {tutorialContextHints.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-amber-900/30 space-y-1.5">
                    {tutorialContextHints.map((hint, i) => (
                      <div key={i} className="text-[13px] text-amber-200/90 leading-relaxed">{hint}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-3 panel p-4 text-[14px] text-slate-400 leading-relaxed">
                <span className="text-rune font-semibold uppercase text-[11px] tracking-[0.2em] mr-2">Tutorial</span>
                Lessons complete. Finish the walk on your own; the next descent is The Quiet.
              </div>
            )
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
            {game.room.map((c, i) => {
              let weaponDamage = null
              let bareDamage = null
              if (c && isMonster(c)) {
                // During the Oath reveal animation, peek the damage of the
                // card that's flipping so the player can see what they're in for.
                const previewCard = (revealing === i && c.faceDown) ? { ...c, faceDown: false } : c
                const preview = previewMonsterDamage(game, previewCard)
                weaponDamage = preview.weapon
                bareDamage = preview.bare
              }
              // The player has already committed once the reveal starts, so
              // suppress the bare-hands alternate to avoid implying a choice.
              const showBare = weaponDamage !== null && !themeIronBones && revealing !== i
              const isRecommended = tutorialActive && tutorialCue && c?.id === tutorialCue.recommendedId && revealing !== i
              const tip = tutorialActive && c ? tutorialTipFor(game, c) : null
              return (
                <CardSlot
                  key={i}
                  card={c}
                  reveal={revealing === i}
                  onClick={() => c && onCard(i)}
                  onBareHands={showBare ? () => onCardBare(i) : null}
                  weaponDamage={weaponDamage}
                  bareDamage={bareDamage}
                  recommended={isRecommended}
                  tutorialTip={tip}
                />
              )
            })}
          </div>

          <div className="mt-4 flex justify-center">
            <div className="group relative">
              {tutorialCue?.recommendFlee && (
                <div
                  className="absolute -top-7 left-1/2 -translate-x-1/2 z-20 text-rune text-2xl animate-bounce pointer-events-none drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
                  aria-hidden="true"
                >
                  ▼
                </div>
              )}
              <button
                onClick={onFlee}
                disabled={!game.canFlee}
                className={`px-6 py-2.5 rounded-md bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium border border-stone-700 transition ${tutorialCue?.recommendFlee ? 'tutorial-recommended' : ''}`}
              >
                Flee the room
              </button>
              {tutorialActive && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-30 w-80 panel p-3 text-[13px] leading-relaxed text-slate-200 text-left opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-150 shadow-2xl border border-rune/40"
                  role="tooltip"
                >
                  {game.canFlee
                    ? 'Sends all 4 cards to the bottom of the deck and deals a fresh 4 from the top. No damage. Cooldown after: you must clear a fresh room first.'
                    : "Disabled. You just fled — clear a fresh room before fleeing again."}
                </div>
              )}
            </div>
          </div>
        </section>

        <ForesightPanel game={game} />
      </div>
    </div>
  )
}

// -- Theme intro overlay -----------------------------------------------

function ThemeIntroOverlay({ theme, themeChildren, onDismiss }) {
  const childThemes = (themeChildren || []).map(id => getTheme(id)).filter(Boolean)
  if (!theme) return null
  return (
    <div
      onClick={onDismiss}
      role="button"
      tabIndex={-1}
      aria-label="Dismiss theme intro"
      className="fixed inset-0 z-40 flex items-center justify-center px-6 bg-dungeon/90 backdrop-blur-md cursor-pointer animate-fade-in"
    >
      <div className="max-w-lg text-center">
        <div className="animate-theme-intro-title">
          <h2 className="font-display text-rune text-4xl sm:text-5xl rune-pulse inline-block px-6 py-3 rounded-lg">
            {theme.name}
          </h2>
        </div>
        <p className="mt-6 text-[15px] sm:text-base text-slate-300 leading-relaxed animate-theme-intro-body">
          {theme.description}
        </p>
        {childThemes.length > 0 && (
          <ul className="mt-5 pt-4 border-t border-stone-800/80 space-y-2 text-left animate-theme-intro-children">
            {childThemes.map(c => (
              <li key={c.id} className="text-[13px] leading-snug">
                <span className="text-rune font-semibold">{c.name}</span>
                <span className="text-slate-400">: {c.description}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8 text-[11px] uppercase tracking-[0.3em] text-slate-500 animate-theme-intro-children">
          Tap anywhere to begin
        </div>
      </div>
    </div>
  )
}

// -- Tutorial cue + tooltip helpers ------------------------------------

// Tutorial: which card in the current room should the player consider
// next? Priority is intentionally simple so the suggestion is
// predictable: pick up a weapon if you don't have one, swing at the
// smallest usable monster, take a new weapon when locked, sip a
// potion if hurt, otherwise just play whatever's left.
//
// If the room is genuinely stuck (locked monsters present, no new
// weapon to take, no useful potion) and the player can flee, the cue
// returns `recommendFlee: true` instead of a card id. The Flee button
// gets the highlight in that case.
function computeTutorialCue(game) {
  const room = game.room.filter(Boolean)
  if (room.length === 0) return { recommendedId: null, recommendFlee: false }

  const weapon = game.weapon
  const weaponInRoom = room.find(c => isWeapon(c))
  const monsters = room.filter(c => isMonster(c))
  const potions = room.filter(c => isPotion(c))

  const usableMonsters = monsters.filter(m => {
    if (!weapon) return false
    if (!weapon.lastSlain) return true
    return m.rank <= weapon.lastSlain.rank
  })

  const lockedMonsters = weapon && weapon.lastSlain
    ? monsters.filter(m => m.rank > weapon.lastSlain.rank)
    : []
  const potionUseful = potions.length > 0
    && game.hp < game.maxHp
    && game.potionsUsedThisRoom === 0

  // Flee scenario: the room has monsters above the current binding,
  // there's no new weapon in the room to reset the binding, and a
  // potion wouldn't change the situation. Killing a small usable
  // monster here would only drop the binding further. Send the room
  // back into the deck and try fresh cards.
  if (
    weapon
    && lockedMonsters.length > 0
    && !weaponInRoom
    && !potionUseful
    && game.canFlee
  ) {
    return { recommendedId: null, recommendFlee: true }
  }

  let recommendedId = null
  if (!weapon && weaponInRoom) {
    recommendedId = weaponInRoom.id
  } else if (usableMonsters.length > 0) {
    const ordered = [...usableMonsters].sort((a, b) => a.rank - b.rank)
    recommendedId = ordered[0].id
  } else if (monsters.length > 0 && weaponInRoom) {
    // Locked weapon, take a new one
    recommendedId = weaponInRoom.id
  } else if (potions.length > 0 && game.hp < game.maxHp && game.potionsUsedThisRoom === 0) {
    recommendedId = potions[0].id
  } else if (monsters.length > 0) {
    const ordered = [...monsters].sort((a, b) => a.rank - b.rank)
    recommendedId = ordered[0].id
  } else if (room.length > 0) {
    recommendedId = room[0].id
  }
  return { recommendedId, recommendFlee: false }
}

// Per-card hover tip for the tutorial. Reads current game state so
// the explanation reflects what will actually happen if the player
// clicks (e.g. "locked, take a new weapon" vs "swing, binds at 4").
function tutorialTipFor(game, card) {
  if (isWeapon(card)) {
    if (!game.weapon) return 'Pick up the weapon. You equip it and can swing at monsters.'
    return 'Replaces your current weapon. The new one is fresh, swings at anything until its first kill.'
  }
  if (isPotion(card)) {
    if (game.potionsUsedThisRoom > 0) {
      return `Wasted this room. Only the first potion per room heals.`
    }
    return `Heals ${card.rank} HP (capped at ${game.maxHp}).`
  }
  if (isMonster(card)) {
    if (!game.weapon) {
      return `Bare hands: take the full ${card.rank} damage to HP.`
    }
    const bound = game.weapon.lastSlain?.rank
    if (bound !== undefined && card.rank > bound) {
      return `Your weapon is bound at ${bound}, ineffective against ${card.rank}. Must Bare hands (take full damage) to fight.`
    }
    const damage = Math.max(0, card.rank - game.weapon.rank)
    return `Swing for ${damage} damage. After the kill, the weapon binds at ${card.rank}. Weapon can only swing at monsters of that rank or lower.`
  }
  return null
}
