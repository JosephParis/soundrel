import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  createRun,
  descend,
  playCard,
  playCardBare,
  fleeRoom,
  pickBoon,
  openForgeAction,
  closeForgeView,
  applyStrike,
  applyTransmute,
  applyHeft,
  getStrikeOptions,
  getTransmuteOptions,
  getHeftOptions,
  HEFT_BONUS,
  STRIKE_OFFERING_RANGE,
  suitColor,
  previewMonsterDamage,
  describeMaxHp,
  describeWeaponStrength,
  getBoon,
  getTheme,
  BOONS,
  THEMES,
  FORGE_SIGILS,
  SUIT_GLYPH,
  HEART, DIAMOND, CLUB, SPADE,
  isMonster, isWeapon, isPotion,
  rankLabel,
} from './logic'

// Format a parts array (from describe* helpers) as a math expression.
// e.g. [{value:8, label:'monster', op:'+'}, {value:3, label:'weapon', op:'-'}]
//   → "8 − 3 weapon"
function formatFormula(parts) {
  if (!parts || parts.length === 0) return ''
  if (parts.length === 1) return `${parts[0].value}`
  return parts.map((p, i) => {
    if (i === 0) return `${p.value}`
    const sign = p.op === '-' ? '−' : '+'
    return ` ${sign} ${p.value} ${p.label}`
  }).join('')
}

function Formula({ parts, className }) {
  if (!parts || parts.length < 2) return null
  return (
    <span className={`text-[10px] text-slate-500 ${className || ''}`}>
      ({formatFormula(parts)})
    </span>
  )
}

// Border color by card type — monsters deep green, weapons cool gray, potions deep purple.
function cardBorderTone(card) {
  if (!card) return 'border-stone-700'
  if (isMonster(card)) return 'border-green-700'
  if (isWeapon(card)) return 'border-gray-500'
  if (isPotion(card)) return 'border-purple-700'
  return 'border-stone-700'
}

// SVG paths from game-icons.net (Lorc, CC-BY 3.0).
// One silhouette per suit so the room reads at a glance.
//   ♠ harry-potter-skull (Lorc) — Dark Mark
//   ♣ animal-skull (Lorc)       — beast
//   ♦ broadsword (Lorc)         — weapon
//   ♥ potion-ball (Lorc)        — potion vial
const SUIT_ICON_PATHS = {
  [SPADE]: 'M256.16 15.822c-74.685 0-124.825 36.292-157.865 90.487C66.36 158.692 51.637 228.053 50.68 294.954c44.44 12.795 73.834 28.683 90.46 50.123 15.804 20.383 18.445 45.188 12.157 71.963 23.635 7.218 62.826 11.32 100.986 10.905 38.28-.416 76.213-5.67 96.373-13.44-4.608-25.936-.182-50.215 16.983-70.07 17.928-20.738 48.197-36.53 93.4-49.488-.972-63.406-15.24-132.688-46.868-185.92-20.367-34.277-47.386-61.936-82.97-77.972-62.555 14.347-113.232 44.996-143.62 84.12 25.38 8.96 46.088 21.593 65.35 34.583l10.742 7.244-10.266 7.906c-26.884 20.705-46.28 43.707-65.26 67.48 28.468 22.27 47.56 52.2 29.02 65.186-33.572 23.518-170.713 1.396-119.002-78.754 6.006-9.31 15.307-13.314 26.2-13.496 14.635-.244 32.144 6.414 48.4 16.37 17.11-21.452 35.198-43.144 59.1-63.32-18.538-11.88-37.98-22.425-61.975-29.265l-12.29-3.503 7.066-10.65c28.184-42.48 75.737-75.727 134.613-94.523-13.362-3.012-27.71-4.612-43.118-4.612h-.002zm126.594 189.502c10.892.182 20.19 4.187 26.197 13.496 51.712 80.15-85.427 102.272-119 78.754-31.496-22.06 45.603-93.04 92.804-92.25zM252.2 309.057c13.922 0 38.53 68.05 30.277 79.51-6.48 8.996-54.935 8.617-60.555 0-7.197-11.034 16.31-79.51 30.277-79.51zM354.71 433.13c-10.557 3.91-23.223 6.832-37.17 8.952l5.94 48.89h53.416l-22.185-57.84zm-207.888 1.57-18.5 56.273h47.092l5.914-48.684c-12.764-1.877-24.484-4.38-34.506-7.59zm152.17 9.667c-13.13 1.28-26.996 1.98-41.078 2.21v44.396h46.74l-5.662-46.606zm-99.107.14-5.647 46.466h44.99V446.6c-13.444-.204-26.714-.894-39.343-2.094z',
  [CLUB]: 'M179.3 38.94C154.7 77.7 142.7 139.7 168.4 185.9l-16.3 9.2c-6.7-11.9-11.2-24.4-13.9-37.2-34.5-6.3-69.42-7.5-104.98-2.1 34.07 10.1 52.77 23.7 76.68 46.7-26.82 9.7-60.25 30.2-92.93 70.2 35.47-8.8 64.83-11.5 89.43-6.3-36.94 22.5-64.06 56.1-88.34 114.1 35.9-17.2 64.89-18.8 102.94-18.8-23.07 32.7-35.27 77.2-36.31 112.8 24.51-26 57.61-60.2 87.21-79 3 29.9 15 58.3 35.9 85.3-.2-43.9 10.3-88.3 31.6-133.4-18.8 9-32.4 18.1-49.9 29.3 6.2-27.9 12.4-55.8 18.7-83.7-23.3 2.4-39 10-60.5 18.5 16.3-33.1 32.7-66.1 49.1-99.2l16.8 8.3-28.4 57.4c18.4-4.4 28.7-4.1 45.7-1.3-4.5 20.4-9 40.7-13.6 61 65.3-36.2 148.3-45.9 226.7-50 7.6-12.9 13.8-24.2 18.8-34.8l-6.3-24.4-24.4 30.8-7.8-27.5-22.5 29.2-7.5-26.1-23.9 31.5-7.7-28.2-23.8 31.4 1.2-41.1 22.6-42.7 7.6 28.3 23.9-31.5 7.6 28.2 23.5-30 6.5 26.9 24.5-30.8 7.8 27.5 24.6-32c2.3-10.8 4.6-22.4 7.4-35.7-55.5-3.7-106.3 4.8-154 9.8-38-20.8-80.8-26.8-121.9-18.5-13.6-29.69-27.2-59.38-40.9-89.06zM325.5 158.3c-4.5 14.2-13 18.3-24.7 20.6-16.1-4.4-28.3-15.5-34.4-30.2 20.4-3.8 42.4 3.4 59.1 9.6z',
  [DIAMOND]: 'm491.844 22.533-83.42 14.865L196.572 249.25c3.262 4.815 5.37 10.72 5.37 16.932 0 5.863-1.71 11.35-4.643 15.996a52.936 52.936 0 0 0-16.027-2.477c-15.724 0-29.904 6.89-39.69 17.796l-9.112-9.113 17.237-17.237a545.915 545.915 0 0 1-13.19-17.6l-19.443 19.44-13.215-13.215 21.828-21.827a548.134 548.134 0 0 1-12.792-20.068L72.093 258.68l58.314 58.314a52.94 52.94 0 0 0-2.49 16.063 52.86 52.86 0 0 0 4.592 21.564l-72.14 72.14-14.56-14.56L21.013 437l14.558 14.56-8.607 8.608 27.246 27.246 8.606-8.61 14.56 14.56 24.798-24.8-14.557-14.556 72.158-72.16a52.885 52.885 0 0 0 21.498 4.562 52.94 52.94 0 0 0 16.063-2.49l58.363 58.363L296.5 401.48a548.745 548.745 0 0 1-20.068-12.793l-21.83 21.83L241.39 397.3l19.442-19.44a550.258 550.258 0 0 1-17.603-13.194l-17.238 17.238-9.16-9.16c10.905-9.785 17.795-23.965 17.795-39.69 0-5.346-.806-10.51-2.285-15.39 4.703-3.04 10.288-4.817 16.265-4.816 6.21 0 11.776 1.77 16.52 4.955L476.98 105.95l14.864-83.417zm-66.227 53.012 13.215 13.215-191.684 191.68-13.214-13.213L425.617 75.545zM181.273 298.39c19.257 0 34.665 15.41 34.665 34.665 0 19.256-15.408 34.666-34.665 34.666-19.256 0-34.666-15.41-34.666-34.665s15.41-34.666 34.666-34.666z',
  [HEART]: 'M94.055 21.9 18.998 96.96l42.727 23.6-26.98 26.952L142.35 212.39c-40.443 70.148-30.72 161.07 29.2 220.958 71.605 71.606 187.737 71.587 259.356 0 71.62-71.587 71.642-187.654.037-259.22-59.915-59.878-150.896-69.57-221.084-29.177L144.95 37.415l-8.44 8.432-18.588 18.57L94.055 21.9zm47.224 45.598 62.337 103.275 8.098-5.248c44.21-28.663 99.014-34.044 147.166-16.078-1.16-.026-2.328-.04-3.503-.04-38.988 0-70.594 14.807-70.594 33.073 0 18.27 31.606 33.075 70.594 33.075 31.53 0 58.225-9.684 67.287-23.05 15.942 17.34 27.492 37.224 34.65 58.253-7.76-3.387-18.28-6.706-30.902-9.563-31.383-7.1-75.547-11.615-124.305-11.615-48.757 0-92.92 4.514-124.304 11.615-13.71 3.102-24.997 6.75-32.893 10.438a163.85 163.85 0 0 1 18.018-37.383l5.263-8.104-103.33-62.3 13.894-13.88 46.937 25.923 27.914-27.915-26.18-46.635 13.855-13.842zm-1.087 201.287c.482.28.982.56 1.506.84 7.89 4.22 20.41 8.487 36.103 12.037 31.383 7.1 75.547 11.615 124.304 11.615 48.758 0 92.922-4.514 124.305-11.615 15.687-3.55 28.203-7.813 36.094-12.033a164.248 164.248 0 0 1 2.746 17.643c-9.432 4.277-21.204 7.893-35.074 11.032-33.205 7.513-78.27 12.037-128.07 12.037-49.802 0-94.866-4.524-128.07-12.037-14.67-3.32-27-7.17-36.69-11.776a164.503 164.503 0 0 1 2.845-17.745z',
}

function SuitIcon({ suit, className }) {
  const d = SUIT_ICON_PATHS[suit]
  if (!d) return null
  // Hearts (potion-ball) mirrored so the flask reads better next to the rank.
  const flip = suit === HEART ? '-scale-x-100' : ''
  return (
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={`${className} ${flip}`} aria-hidden="true">
      <path fill="currentColor" d={d} />
    </svg>
  )
}

// Colored tint per category — kept saturated since the icon is the
// centerpiece, not a watermark.
function suitIconTone(card) {
  if (isMonster(card)) return 'text-green-800'
  if (isWeapon(card)) return 'text-stone-700'
  if (isPotion(card)) return 'text-purple-800'
  return 'text-stone-700'
}


// ============================================================
// Root
// ============================================================

export default function Scoundrel() {
  const [game, setGame] = useState(() => createRun())
  const [rulesOpen, setRulesOpen] = useState(false)

  useEffect(() => {
    if (!rulesOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setRulesOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rulesOpen])

  return (
    <div className="min-h-screen text-parchment flex flex-col items-center">
      <TopBar game={game} onOpenRules={() => setRulesOpen(true)} />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <main className="flex-1 w-full max-w-4xl px-4 sm:px-6 pt-20 sm:pt-24 pb-16">
        {game.phase === 'sanctuary' && <SanctuaryView game={game} setGame={setGame} />}
        {game.phase === 'descent' && <DescentView game={game} setGame={setGame} />}
        {(game.phase === 'gameover' || game.phase === 'victory') && (
          <OutcomeView game={game} setGame={setGame} />
        )}
      </main>
    </div>
  )
}

// ============================================================
// Top bar — persistent across phases
// ============================================================

function TopBar({ game, onOpenRules }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b border-stone-800/80 bg-dungeon/85 backdrop-blur-md flex justify-center">
      <div className="w-full max-w-4xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <span className="font-display text-rune text-sm sm:text-base tracking-[0.25em]">
            SCOUNDREL
          </span>
          <span className="hidden sm:block text-stone-700">|</span>
          <SigilTracker count={game.sigilsEarned} target={game.sigilTarget} />
        </div>
        <button
          onClick={onOpenRules}
          className="shrink-0 px-3 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-xs sm:text-sm font-medium transition"
        >
          How to play
        </button>
      </div>
    </header>
  )
}

function SigilTracker({ count, target }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-slate-500 mr-1 hidden sm:inline">
        Sigils
      </span>
      <div className="flex items-center gap-1">
        {Array.from({ length: target }).map((_, i) => {
          const set = i < count
          return (
            <span
              key={i}
              className={
                set
                  ? 'w-2.5 h-2.5 rotate-45 bg-rune shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                  : 'w-2.5 h-2.5 rotate-45 border border-stone-600'
              }
              aria-label={set ? 'sigil set' : 'sigil empty'}
            />
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// Sanctuary
// ============================================================

function SanctuaryView({ game, setGame }) {
  const theme = getTheme(game.nextTheme)
  const canDescend = game.boonChosen && game.forgeView === null
  const isOpeningVisit = game.sigilsEarned === 0
  const needsBoon = !isOpeningVisit && !game.boonChosen && game.boonOffers.length > 0
  const forgeAvailable = game.forgeOpen && !game.forgeUsed && !game.forgeView
  const [creditsOpen, setCreditsOpen] = useState(false)

  useEffect(() => {
    if (!creditsOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setCreditsOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [creditsOpen])

  return (
    <div className="space-y-6 animate-fade-in">
      <SanctuaryHero isOpeningVisit={isOpeningVisit} />

      {isOpeningVisit && <RulesInlinePanel />}

      {needsBoon && (
        <BoonOfferPanel
          offers={game.boonOffers}
          onPick={(id) => setGame(g => pickBoon(g, id))}
        />
      )}

      {forgeAvailable && (
        <ForgePromptPanel
          onStrike={() => setGame(g => openForgeAction(g, 'strike'))}
          onTransmute={() => setGame(g => openForgeAction(g, 'transmute'))}
          onHeft={() => setGame(g => openForgeAction(g, 'heft'))}
        />
      )}

      {game.forgeView === 'strike' && (
        <StrikeView
          game={game}
          onConfirm={(mid, oid) => setGame(g => applyStrike(g, mid, oid))}
          onCancel={() => setGame(g => closeForgeView(g))}
        />
      )}

      {game.forgeView === 'transmute' && (
        <TransmuteView
          game={game}
          onConfirm={(cid, suit) => setGame(g => applyTransmute(g, cid, suit))}
          onCancel={() => setGame(g => closeForgeView(g))}
        />
      )}

      {game.forgeView === 'heft' && (
        <HeftView
          game={game}
          onConfirm={(cid) => setGame(g => applyHeft(g, cid))}
          onCancel={() => setGame(g => closeForgeView(g))}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {theme && <NextThemePanel theme={theme} childThemeIds={game.nextThemeChildren} />}
        <RunStatePanel game={game} />
      </div>

      <DescendAction
        onDescend={() => setGame(g => descend(g))}
        disabled={!canDescend}
        reason={
          !game.boonChosen
            ? 'Pick a Boon first.'
            : game.forgeView !== null
              ? 'Close the Forge first.'
              : null
        }
      />

      <LogPanel lines={game.log} />

      <div className="text-center pt-2">
        <button
          onClick={() => setCreditsOpen(true)}
          className="text-[10px] uppercase tracking-widest text-stone-600 hover:text-rune transition"
        >
          ✦ Credits
        </button>
      </div>

      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />

      <DevPanel game={game} setGame={setGame} />
    </div>
  )
}

function CreditsModal({ open, onClose }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close credits"
        >
          ×
        </button>
        <h2 className="font-display text-rune text-2xl mb-1">Credits</h2>
        <p className="text-[12px] text-slate-500 mb-5">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>
        <section>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-3">
            Design & playtesting
          </div>
          <ul className="space-y-1.5 text-[15px] text-parchment font-display">
            <li>Alexander Beck</li>
            <li>Bronislaw Andrus</li>
            <li>Joshua Rolfe</li>
          </ul>
          <p className="mt-5 text-[12px] text-slate-400 italic leading-snug">
            Thanks for the runs, feedback, and ideas that shaped this wonderful game.
          </p>
        </section>
        <section className="mt-6 pt-4 border-t border-stone-800">
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 mb-2">
            Art
          </div>
          <p className="text-[11px] text-slate-500 leading-snug">
            Card icons by Lorc via{' '}
            <span className="text-slate-300">game-icons.net</span>, CC-BY 3.0.
          </p>
        </section>
      </div>
    </div>
  )
}

function DevPanel({ game, setGame }) {
  const [open, setOpen] = useState(false)
  const [sigils, setSigils] = useState(game.sigilsEarned)
  const [themeId, setThemeId] = useState(game.nextTheme || 'the_quiet')
  const tier2Ids = useMemo(
    () => Object.values(THEMES).filter(t => t.tier === 2).map(t => t.id),
    []
  )
  const [child1, setChild1] = useState(() => game.nextThemeChildren?.[0] || tier2Ids[0] || '')
  const [child2, setChild2] = useState(() => game.nextThemeChildren?.[1] || tier2Ids[1] || '')
  const [selectedBoons, setSelectedBoons] = useState(() => new Set(game.boons))

  const themeObj = getTheme(themeId)
  const isCompound = !!themeObj?.compound
  const maxSigils = game.sigilTarget - 1

  const toggleBoon = (id) => {
    setSelectedBoons(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const apply = () => {
    setGame(g => ({
      ...g,
      sigilsEarned: sigils,
      nextTheme: themeId,
      nextThemeChildren: isCompound
        ? [child1, child2].filter(Boolean)
        : null,
      boons: Array.from(selectedBoons),
      boonChosen: true,
      boonOffers: [],
      forgeOpen: FORGE_SIGILS.has(sigils),
      forgeUsed: false,
      forgeView: null,
      mutedBoon: null,
      log: [...g.log, `[dev] overrides applied — sigils ${sigils}, theme "${themeObj?.name || themeId}".`],
    }))
  }

  if (!open) {
    return (
      <div className="text-center pt-4">
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-widest text-stone-600 hover:text-amber-300/80 transition"
        >
          ⚙ Dev
        </button>
      </div>
    )
  }

  return (
    <section className="panel p-4 border border-amber-900/40 space-y-3 text-[12px]">
      <div className="flex justify-between items-baseline">
        <div className="text-[10px] uppercase tracking-widest text-amber-200/70">Dev overrides</div>
        <button
          onClick={() => setOpen(false)}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-parchment"
        >
          Close
        </button>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Sigils earned</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={maxSigils}
            value={sigils}
            onChange={(e) => {
              const n = Number(e.target.value)
              setSigils(Math.max(0, Math.min(maxSigils, Number.isFinite(n) ? n : 0)))
            }}
            className="w-16 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment font-mono"
          />
          <span className="text-slate-500">/ {game.sigilTarget}</span>
          {FORGE_SIGILS.has(sigils) && (
            <span className="text-amber-300/70 text-[10px] uppercase tracking-wider">Forge opens</span>
          )}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Next theme</div>
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value)}
          className="block w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment"
        >
          {Object.values(THEMES).map(t => {
            const tier = t.tier ? `T${t.tier}` : 'intro'
            return <option key={t.id} value={t.id}>{t.name} ({tier})</option>
          })}
        </select>
      </div>

      {isCompound && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Child A', value: child1, set: setChild1 },
            { label: 'Child B', value: child2, set: setChild2 },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label} (T2)</div>
              <select
                value={value}
                onChange={(e) => set(e.target.value)}
                className="block w-full bg-stone-900 border border-stone-700 rounded px-2 py-1 text-parchment"
              >
                {tier2Ids.map(id => (
                  <option key={id} value={id}>{THEMES[id].name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Boons</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.values(BOONS).map(b => (
            <label key={b.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:text-parchment">
              <input
                type="checkbox"
                checked={selectedBoons.has(b.id)}
                onChange={() => toggleBoon(b.id)}
                className="accent-amber-500"
              />
              <span>{b.name}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={apply}
        className="w-full px-3 py-2 rounded-md bg-amber-900/40 hover:bg-amber-900/60 text-amber-100 text-[11px] uppercase tracking-widest border border-amber-700/50 transition"
      >
        Apply overrides
      </button>
    </section>
  )
}

function SanctuaryHero({ isOpeningVisit }) {
  return (
    <header className="text-center pt-2 pb-4">
      <h1 className="font-display text-3xl sm:text-4xl text-rune">The Great Hall</h1>
      <div className="rune-divider mt-3 mb-2 mx-auto max-w-xs text-rune/40 text-[10px]">
        <span>✦</span>
      </div>
      <p className="text-sm text-slate-400 max-w-xl mx-auto">
        {isOpeningVisit
          ? 'The rune-chains hum. The dark below is quiet — for now.'
          : 'The carving-stones are silent. The dungeon shifts beyond the threshold.'}
      </p>
    </header>
  )
}

function NextThemePanel({ theme, childThemeIds }) {
  const childThemes = (childThemeIds || []).map(id => getTheme(id)).filter(Boolean)
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Tonight's air</div>
      <div className="font-display text-rune text-lg mb-1">{theme.name}</div>
      <div className="text-[13px] text-slate-300 leading-snug">{theme.description}</div>
      {childThemes.length > 0 && (
        <ul className="mt-2 pt-2 border-t border-stone-800 space-y-1">
          {childThemes.map(c => (
            <li key={c.id} className="text-[12px] leading-snug">
              <span className="text-rune font-semibold">{c.name}</span>
              <span className="text-slate-400"> — {c.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const BOON_TAG_LABEL = {
  combat: 'Combat',
  survival: 'Survival',
  economy: 'Economy',
  build: 'Build',
}

function BoonOfferPanel({ offers, onPick }) {
  return (
    <section className="panel p-6">
      <div className="text-center mb-5">
        <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">A memory carved</div>
        <h2 className="font-display text-rune text-xl mt-1">Pick one Boon</h2>
        <p className="text-[12px] text-slate-500 mt-1">Permanent for the rest of the run.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 justify-items-center">
        {offers.map(id => {
          const boon = getBoon(id)
          return <BoonCard key={id} boon={boon} onPick={() => onPick(id)} />
        })}
      </div>
    </section>
  )
}

function BoonCard({ boon, onPick }) {
  const tag = BOON_TAG_LABEL[boon.tag] || ''
  return (
    <button
      onClick={onPick}
      className="group aspect-[2/3] w-full max-w-[230px] text-left rounded-lg border border-stone-700 bg-gradient-to-b from-stone-900 to-stone-950 p-5 hover:border-rune hover:from-stone-800 hover:to-stone-900 hover:-translate-y-1 transition-all duration-200 shadow-md hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.5)] flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rune/20 to-transparent" />
      <div className="font-display text-rune text-lg leading-tight">{boon.name}</div>
      <div className="h-px bg-stone-700 my-3" />
      <div className="text-[13px] text-slate-200 leading-snug">{boon.description}</div>
      {boon.example && (
        <div className="mt-3 text-[11.5px] text-slate-400 italic leading-snug border-l-2 border-rune/30 pl-2.5">
          {boon.example}
        </div>
      )}
      <div className="flex-1" />
      {tag && (
        <div className="mt-3 pt-3 border-t border-stone-800 text-[10px] uppercase tracking-[0.2em] text-slate-500 group-hover:text-rune/70 transition">
          {tag}
        </div>
      )}
    </button>
  )
}

function ForgePromptPanel({ onStrike, onTransmute, onHeft }) {
  return (
    <section className="panel panel-warm p-5">
      <div className="text-center mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">The Forge is open</div>
        <h2 className="font-display text-rune text-lg mt-1">Carve once into the threshold</h2>
        <p className="text-[12px] text-slate-400 mt-1 max-w-md mx-auto">
          Strike a name (with a matched offering), transmute a card's suit, or heft a weapon or potion to a heavier rank.
        </p>
      </div>
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          onClick={onStrike}
          className="px-5 py-2.5 rounded-md bg-stone-800 hover:bg-stone-700 text-parchment text-sm font-medium border border-stone-700 transition"
        >
          Strike a name
        </button>
        <button
          onClick={onTransmute}
          className="px-5 py-2.5 rounded-md bg-stone-800 hover:bg-stone-700 text-parchment text-sm font-medium border border-stone-700 transition"
        >
          Transmute a card
        </button>
        <button
          onClick={onHeft}
          className="px-5 py-2.5 rounded-md bg-stone-800 hover:bg-stone-700 text-parchment text-sm font-medium border border-stone-700 transition"
        >
          Heft a card
        </button>
      </div>
    </section>
  )
}

// ============================================================
// Forge views
// ============================================================

function ForgeViewShell({ kindLabel, title, blurb, children, onCancel, cancelLabel }) {
  return (
    <section className="panel panel-warm p-5">
      <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70 mb-1">{kindLabel}</div>
      <h2 className="font-display text-rune text-lg mb-1">{title}</h2>
      <p className="text-[12px] text-slate-400 mb-4">{blurb}</p>
      {children}
      <div className="flex justify-center mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 text-slate-300 text-sm border border-stone-700"
        >
          {cancelLabel}
        </button>
      </div>
    </section>
  )
}

function StrikeView({ game, onConfirm, onCancel }) {
  const { monsters, byRank } = useMemo(() => getStrikeOptions(game), [game])
  const [pickedMonster, setPickedMonster] = useState(null)
  const offerings = pickedMonster
    ? Array.from({ length: STRIKE_OFFERING_RANGE + 1 }, (_, i) => byRank[pickedMonster.rank - i] || [])
        .flat()
    : []

  const lowest = pickedMonster ? Math.max(2, pickedMonster.rank - STRIKE_OFFERING_RANGE) : null

  return (
    <ForgeViewShell
      kindLabel="Strike"
      title="Carve a name from the rolls"
      blurb={`Pick a monster, then pick a weapon or potion at its rank or up to ${STRIKE_OFFERING_RANGE} below. The strongest dead (K, A) remain too weighty for any offering this hold can muster.`}
      onCancel={onCancel}
      cancelLabel="Step away from the threshold"
    >
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">1. Name to bind</div>
        <CardPickerGrid
          cards={monsters}
          selected={pickedMonster?.id}
          onPick={(c) => setPickedMonster(c)}
        />
        {monsters.length === 0 && (
          <div className="text-[12px] text-slate-500 italic">No dead remain to bind.</div>
        )}
      </div>

      {pickedMonster && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            2. Matched offering · rank {rankLabel(lowest)}–{rankLabel(pickedMonster.rank)}
          </div>
          {offerings.length > 0 ? (
            <CardPickerGrid
              cards={offerings}
              onPick={(o) => onConfirm(pickedMonster.id, o.id)}
            />
          ) : (
            <div className="text-[12px] text-slate-500 italic">
              No weapon or potion of rank {rankLabel(lowest)}–{rankLabel(pickedMonster.rank)} remains. Pick another name.
            </div>
          )}
        </div>
      )}
    </ForgeViewShell>
  )
}

function TransmuteView({ game, onConfirm, onCancel }) {
  const cards = useMemo(() => getTransmuteOptions(game), [game])
  const [picked, setPicked] = useState(null)
  const suits = [HEART, DIAMOND, CLUB, SPADE]
  const allowedSuits = picked
    ? suits.filter(s => s !== picked.suit && suitColor(s) === suitColor(picked.suit))
    : []

  return (
    <ForgeViewShell
      kindLabel="Transmute"
      title="Change a card's suit"
      blurb="The rank stays the same. Color is locked — hearts swap with diamonds, clubs swap with spades. A spade can become a club; a potion can become a weapon."
      onCancel={onCancel}
      cancelLabel="Step away"
    >
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">1. Card to transmute</div>
        <CardPickerGrid
          cards={cards}
          selected={picked?.id}
          onPick={(c) => setPicked(c)}
        />
      </div>

      {picked && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            2. New suit for {rankLabel(picked.rank)}{SUIT_GLYPH[picked.suit]}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {allowedSuits.map(s => (
              <button
                key={s}
                onClick={() => onConfirm(picked.id, s)}
                className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 text-sm border border-stone-700"
              >
                {SUIT_GLYPH[s]} — {rankLabel(picked.rank)} as a {suitName(s)}
              </button>
            ))}
          </div>
        </div>
      )}
    </ForgeViewShell>
  )
}

function HeftView({ game, onConfirm, onCancel }) {
  const cards = useMemo(() => getHeftOptions(game), [game])

  return (
    <ForgeViewShell
      kindLabel="Heft"
      title="Add weight to a weapon or potion"
      blurb={`Pick a weapon or potion. Its rank rises by ${HEFT_BONUS}. Capped at rank 10 — no king-grade gear in this hold.`}
      onCancel={onCancel}
      cancelLabel="Step away"
    >
      <div>
        <CardPickerGrid
          cards={cards}
          onPick={(c) => onConfirm(c.id)}
        />
        {cards.length === 0 && (
          <div className="text-[12px] text-slate-500 italic">
            No weapons or potions remain low enough to heft.
          </div>
        )}
      </div>
    </ForgeViewShell>
  )
}

function suitName(suit) {
  if (suit === HEART) return 'potion'
  if (suit === DIAMOND) return 'weapon'
  if (suit === CLUB) return 'club monster'
  return 'spade monster'
}

function CardPickerGrid({ cards, selected, onPick }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
      {cards.map(c => {
        const red = c.suit === HEART || c.suit === DIAMOND
        const isSelected = selected === c.id
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className={`aspect-[2/3] rounded border-2 p-1 flex flex-col justify-between text-left transition ${
              isSelected
                ? 'border-rune bg-stone-700'
                : `${cardBorderTone(c)} bg-stone-900 hover:bg-stone-800`
            }`}
          >
            <div className={`text-sm font-bold leading-none ${red ? 'text-blood' : 'text-parchment'}`}>
              {rankLabel(c.rank)}{SUIT_GLYPH[c.suit]}
            </div>
            {c.transmuted && (
              <div className="text-[8px] text-rune uppercase tracking-wider">tm</div>
            )}
            {c.hefted && (
              <div className="text-[8px] text-rune uppercase tracking-wider">+{c.heftBonus}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Run state
// ============================================================

function RunStatePanel({ game }) {
  const empty =
    game.boons.length === 0 &&
    game.strikes.length === 0 &&
    Object.keys(game.transmutes).length === 0 &&
    Object.keys(game.hefts || {}).length === 0 &&
    !game.carriedWeapon &&
    !game.carriedSpareWeapon

  if (empty) {
    return (
      <div className="panel p-4">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">What you carry</div>
        <div className="text-[13px] text-slate-500 italic">Nothing yet. Survive a descent to earn your first memory.</div>
      </div>
    )
  }

  return (
    <div className="panel p-4 space-y-2 text-[13px]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">What you carry</div>

      {game.carriedWeapon && (
        <div className="text-slate-300">
          <span className="text-slate-500">Weapon:</span>{' '}
          <span className="text-rune font-mono">{rankLabel(game.carriedWeapon.rank)}♦</span>
          <span className="text-slate-500"> (rests this visit)</span>
        </div>
      )}
      {game.carriedSpareWeapon && (
        <div className="text-slate-300">
          <span className="text-slate-500">Spare:</span>{' '}
          <span className="text-rune font-mono">{rankLabel(game.carriedSpareWeapon.rank)}♦</span>
        </div>
      )}
      {game.boons.length > 0 && (
        <div className="text-slate-300">
          <span className="text-slate-500">Boons:</span>{' '}
          {game.boons.map((id, i) => (
            <span key={id}>
              {i > 0 && <span className="text-slate-600">, </span>}
              <span className="text-rune">{BOONS[id]?.name}</span>
            </span>
          ))}
        </div>
      )}
      {game.strikes.length > 0 && (
        <div className="text-slate-300">
          <span className="text-slate-500">Names carved:</span>{' '}
          <span className="text-rune">{game.strikes.length / 2}</span>
        </div>
      )}
      {Object.keys(game.transmutes).length > 0 && (
        <div className="text-slate-300">
          <span className="text-slate-500">Transmutations:</span>{' '}
          <span className="text-rune">{Object.keys(game.transmutes).length}</span>
        </div>
      )}
      {Object.keys(game.hefts || {}).length > 0 && (
        <div className="text-slate-300">
          <span className="text-slate-500">Hefts:</span>{' '}
          <span className="text-rune">{Object.keys(game.hefts).length}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Descend hero button
// ============================================================

function DescendAction({ onDescend, disabled, reason }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <button
        onClick={onDescend}
        disabled={disabled}
        className={`px-16 sm:px-24 py-5 sm:py-6 rounded-md font-display text-2xl sm:text-3xl tracking-[0.2em] transition
          ${disabled
            ? 'bg-stone-800 text-stone-600 border border-stone-700 cursor-not-allowed'
            : 'bg-gradient-to-b from-red-700 to-red-900 text-parchment border border-red-800/80 hover:from-red-600 hover:to-red-800 rune-pulse'
          }`}
      >
        DESCEND
      </button>
      {disabled && reason && (
        <div className="text-[11px] text-slate-500 italic">{reason}</div>
      )}
    </div>
  )
}

// ============================================================
// Descent
// ============================================================

function DescentView({ game, setGame }) {
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

  return (
    <div className="space-y-5 animate-fade-in">
      {introOpen && (
        <ThemeIntroOverlay
          theme={theme}
          themeChildren={game.themeChildren}
          onDismiss={() => setIntroOpen(false)}
        />
      )}
      <DescentHeader game={game} theme={theme} />

      <section>
        <div className="text-center mb-3 space-y-0.5">
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-slate-500">The room</h2>
          <div className="text-[11px] text-slate-500">
            Deck <span className="font-mono text-slate-300">{game.deck.length}</span> remain
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center">
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
            // The player has already committed once the reveal starts —
            // suppress the bare-hands alternate to avoid implying a choice.
            const showBare = weaponDamage !== null && !themeIronBones && revealing !== i
            return (
              <CardSlot
                key={i}
                card={c}
                reveal={revealing === i}
                onClick={() => c && onCard(i)}
                onBareHands={showBare ? () => onCardBare(i) : null}
                weaponDamage={weaponDamage}
                bareDamage={bareDamage}
              />
            )
          })}
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={onFlee}
            disabled={!game.canFlee}
            className="px-6 py-3 rounded-md bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium border border-stone-700 transition"
          >
            Flee the room
          </button>
        </div>
      </section>

      <ForesightPanel game={game} />

      <aside className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <WeaponPanel game={game} />
          <ConditionsPanel game={game} theme={theme} />
        </div>
        <LogPanel lines={game.log} />
      </aside>
    </div>
  )
}

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
          <div className="text-[11px] uppercase tracking-[0.4em] text-slate-500 mb-3">Tonight's air</div>
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
                <span className="text-slate-400"> — {c.description}</span>
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

function DescentHeader({ game, theme }) {
  const childNames = (game.themeChildren || [])
    .map(id => getTheme(id)?.name)
    .filter(Boolean)
  return (
    <header className="text-center space-y-3 pb-2">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-rune">The dungeon</h1>
        {theme && (
          <p className="text-[13px] text-slate-400 mt-1">
            Tonight: <span className="text-parchment">{theme.name}</span>
            {childNames.length > 0 && (
              <span className="text-slate-500"> — {childNames.join(' + ')}</span>
            )}
          </p>
        )}
      </div>
      <div className="flex justify-center">
        <HpBar hp={game.hp} maxHp={game.maxHp} />
      </div>
    </header>
  )
}

function HpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const critical = hp <= maxHp * 0.25
  return (
    <div className="w-full sm:w-72">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Lifeblood</span>
        <span className="font-mono text-parchment text-lg">
          {hp}<span className="text-slate-500 text-sm">/{maxHp}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-stone-900 border border-stone-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            critical
              ? 'bg-gradient-to-r from-red-900 to-red-600 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              : 'bg-gradient-to-r from-red-700 to-red-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ConditionsPanel({ game, theme }) {
  const hpDesc = describeMaxHp(game)
  const charges = []
  if (game.boons.includes('second_wind')) {
    charges.push({ name: 'Second Wind', ready: !game.secondWindUsed })
  }
  if (game.boons.includes('scoundrels_cloak')) {
    charges.push({ name: "Scoundrel's Cloak", ready: !game.cloakUsed })
  }
  if (game.boons.includes('twin_souls')) {
    charges.push({ name: 'Twin Souls', ready: !game.twinSoulsUsed })
  }
  return (
    <div className="panel p-4 space-y-3 text-[12px]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">Conditions</div>

      {theme && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Theme</div>
          <div className="text-rune font-semibold">{theme.name}</div>
          <div className="text-slate-400 text-[11px] mt-0.5 leading-snug">{theme.description}</div>
          {game.themeChildren && (
            <ul className="mt-1.5 space-y-0.5 pt-1.5 border-t border-stone-800">
              {game.themeChildren.map(id => {
                const c = getTheme(id)
                return c && (
                  <li key={id} className="text-[11px] text-slate-400 leading-snug">
                    <span className="text-rune">{c.name}</span> — {c.description}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Max HP</div>
        <div className="text-parchment font-mono">
          {hpDesc.value} <Formula parts={hpDesc.parts} />
        </div>
      </div>

      {game.riposteCharge > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Riposte banked</div>
          <div className="text-rune font-mono">−{game.riposteCharge} to the next monster</div>
        </div>
      )}

      {charges.length > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Once-per-descent</div>
          <ul className="space-y-0.5">
            {charges.map(c => (
              <li key={c.name} className="text-[11px]">
                <span className={c.ready ? 'text-rune' : 'text-slate-600 line-through'}>{c.name}</span>
                <span className="text-slate-500"> — {c.ready ? 'ready' : 'spent'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {game.boons.length > 0 && (
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Boons</div>
          <ul className="space-y-1">
            {game.boons.map(id => {
              const b = BOONS[id]
              const muted = game.mutedBoon === id
              return (
                <li key={id} className="text-[11px] leading-snug">
                  <span className={muted ? 'text-slate-600 line-through font-semibold' : 'text-rune font-semibold'}>
                    {b.name}
                  </span>
                  <span className={muted ? 'text-slate-600' : 'text-slate-400'}> — {b.description}</span>
                  {muted && <span className="text-slate-500 italic"> (muted by Wormwood)</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function CardSlot({ card, onClick, onBareHands, weaponDamage, bareDamage, reveal }) {
  if (!card) {
    return (
      <div className="aspect-[2/3] w-full max-w-[200px] rounded-lg border border-dashed border-stone-800 bg-stone-900/30" />
    )
  }
  if (card.faceDown && !reveal) {
    return <FaceDownCardSlot onClick={onClick} />
  }
  const red = card.suit === HEART || card.suit === DIAMOND
  const kind = isMonster(card) ? 'Monster' : isWeapon(card) ? 'Weapon' : isPotion(card) ? 'Potion' : ''
  const monster = isMonster(card)
  const willUseWeapon = monster && weaponDamage !== null
  const previewDesc = !monster ? null : willUseWeapon ? weaponDamage : bareDamage
  const previewIcon = willUseWeapon ? '⚔' : '✊'

  return (
    <div className="w-full max-w-[200px] flex flex-col">
      <button
        onClick={reveal ? undefined : onClick}
        disabled={reveal}
        className={`aspect-[2/3] rounded-lg border-2 ${cardBorderTone(card)} bg-gradient-to-b from-parchment to-[#e8d5b3] text-stone-900 p-3 flex flex-col text-left transition-all shadow-md ${reveal ? 'animate-card-reveal cursor-default ring-2 ring-rune/60' : 'hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)]'}`}
      >
        <div className={`text-2xl font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          <SuitIcon suit={card.suit} className={`w-[62%] h-auto ${suitIconTone(card)}`} />
        </div>
        <div className="text-center flex flex-col items-center gap-0.5 min-h-[34px] justify-center">
          {previewDesc ? (
            <>
              <span className="text-[12px] tracking-normal text-stone-800 font-medium">
                {previewIcon} take {previewDesc.value}
              </span>
              {previewDesc.parts.length > 1 && (
                <span className="text-[10px] tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(previewDesc.parts)})
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{kind}</span>
          )}
        </div>
      </button>
      {onBareHands && (
        <button
          onClick={onBareHands}
          className="mt-2 w-full py-2.5 px-3 rounded-md bg-stone-800 hover:bg-stone-700 text-parchment text-sm font-medium border border-stone-700 transition flex flex-col items-center"
        >
          <span>✊ Bare hands · take {bareDamage.value}</span>
          {bareDamage.parts.length > 1 && (
            <span className="text-[10px] text-stone-400 leading-tight">
              ({formatFormula(bareDamage.parts)})
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function FaceDownCardSlot({ onClick }) {
  return (
    <div className="w-full max-w-[200px] flex flex-col">
      <button
        onClick={onClick}
        className="aspect-[2/3] rounded-lg border-2 border-stone-700 bg-gradient-to-br from-stone-900 via-stone-950 to-black p-4 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] hover:border-rune/50 shadow-md text-rune/60"
      >
        <div className="text-4xl leading-none font-display">?</div>
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 text-center">
          Face-down
        </div>
        <div className="text-5xl leading-none text-right text-rune/30">✦</div>
      </button>
      <div className="mt-2 text-[10px] text-slate-500 italic text-center leading-snug">
        Played sight-unseen.
      </div>
    </div>
  )
}

function WeaponBlock({ game, weapon, label }) {
  const strength = describeWeaponStrength(game, weapon)
  const lastSlain = weapon.lastSlain
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {label && (
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
        )}
        <div className="text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Strikes as</div>
        <div className="font-mono font-bold text-parchment text-5xl leading-none">
          {strength.value}
        </div>
      </div>
      <div className="shrink-0 text-center">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 whitespace-nowrap">Bound to</div>
        <div
          className={`font-mono font-bold leading-none text-5xl ${
            lastSlain ? 'text-parchment' : 'text-stone-700'
          }`}
          aria-label={lastSlain ? `Bound to ${rankLabel(lastSlain.rank)}` : 'No binding'}
        >
          {lastSlain ? rankLabel(lastSlain.rank) : '—'}
        </div>
      </div>
    </div>
  )
}

function WeaponPanel({ game }) {
  const { weapon, spareWeapon } = game
  const hasQuartermaster = game.boons.includes('quartermaster')
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        {hasQuartermaster ? 'Weapons' : 'Weapon'}
      </div>
      {weapon ? (
        <div className="space-y-3">
          <WeaponBlock game={game} weapon={weapon} label={hasQuartermaster ? 'Drawn' : null} />
          {spareWeapon && (
            <div className="border-t border-stone-800 pt-3">
              <WeaponBlock game={game} weapon={spareWeapon} label="Spare" />
            </div>
          )}
          {hasQuartermaster && !spareWeapon && (
            <div className="text-[11px] text-slate-500 italic border-t border-stone-800 pt-3">
              Spare slot empty — next weapon taken slings to your back.
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500 italic">Bare-handed.</div>
      )}
    </div>
  )
}

function MiniCard({ card }) {
  const red = card.suit === HEART || card.suit === DIAMOND
  return (
    <div className={`aspect-[2/3] w-11 rounded-sm border-2 ${cardBorderTone(card)} bg-parchment text-stone-900 px-1 py-0.5 flex flex-col justify-between shadow`}>
      <div className={`text-[11px] font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
        {rankLabel(card.rank)}
      </div>
      <div className={`text-sm leading-none text-right ${red ? 'text-blood' : 'text-stone-900'}`}>
        {SUIT_GLYPH[card.suit]}
      </div>
    </div>
  )
}

function ForesightPanel({ game }) {
  const hasCartographer = game.boons.includes('cartographer')
  const hasSoothsayer = game.boons.includes('soothsayer')
  if (!hasCartographer && !hasSoothsayer) return null
  if (game.deck.length === 0) return null

  const upcoming = hasCartographer ? game.deck : game.deck.slice(0, 1)
  const label = hasCartographer
    ? `Cartographer's chart — ${game.deck.length} card${game.deck.length === 1 ? '' : 's'} remain`
    : 'Soothsayer — next card waiting'

  return (
    <section className="panel panel-warm p-3">
      <div className="text-[10px] uppercase tracking-widest text-amber-200/70 mb-2">{label}</div>
      <div className="flex gap-1.5 flex-wrap">
        {upcoming.map((c, i) => (
          <MiniCard key={`${c.id}-${i}`} card={c} />
        ))}
      </div>
    </section>
  )
}

// ============================================================
// Outcome
// ============================================================

function OutcomeView({ game, setGame }) {
  const won = game.phase === 'victory'
  return (
    <div className="text-center space-y-6 pt-6 animate-fade-in">
      <div className="space-y-3">
        <div className={`font-display text-4xl sm:text-5xl ${won ? 'text-rune' : 'text-blood'}`}>
          {won ? 'The high gate opens.' : 'You fall in the dark.'}
        </div>
        <div className="rune-divider mx-auto max-w-xs text-[10px]">
          <span>✦</span>
        </div>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          {won
            ? 'Seven sigils set. The eagles come at dawn.'
            : 'The threshold fades. The next who wakes here will walk into the same dungeon you did.'}
        </p>
        <div className="text-[11px] text-slate-500 uppercase tracking-widest">
          {game.sigilsEarned} of {game.sigilTarget} sigils set
        </div>
      </div>

      <button
        onClick={() => setGame(createRun())}
        className="px-10 py-4 rounded-md bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-parchment font-display text-lg tracking-[0.2em] border border-red-800/80"
      >
        BEGIN AGAIN
      </button>

      <div className="pt-4 border-t border-stone-800 max-w-2xl mx-auto">
        <LogPanel lines={game.log} />
      </div>
    </div>
  )
}

// ============================================================
// Log
// ============================================================

function LogPanel({ lines }) {
  return (
    <div className="panel p-4 max-h-48 overflow-y-auto">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Log</div>
      <ul className="text-[12px] space-y-1 text-left">
        {lines.map((l, i) => (
          <li key={i} className="text-slate-400 leading-snug">{l}</li>
        ))}
      </ul>
    </div>
  )
}

// ============================================================
// Rules — comprehensive how-to-play, shown inline on the opening
// visit and via a persistent "How to play" button
// ============================================================

function RuleRow({ term, children }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 text-[13px]">
      <div className="text-rune font-semibold">{term}</div>
      <div className="text-slate-300">{children}</div>
    </div>
  )
}

function RuleSection({ title, children }) {
  return (
    <section>
      <h3 className="text-rune text-[11px] font-semibold uppercase tracking-[0.2em] mb-2">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  )
}

function RulesContent() {
  return (
    <div className="space-y-5 text-[13px] leading-snug">
      <p className="text-slate-300">
        Earn <span className="text-rune font-semibold">7 sigils</span> — one per successful
        descent — to escape the hold. Die in the dungeon and the run ends.
      </p>

      <RuleSection title="The deck">
        <RuleRow term="Size">44 cards. The red face cards (J/Q/K of ♥ and ♦) are removed — no king-weapons, no queen-potions in this hold.</RuleRow>
        <RuleRow term="Ranks">2–10 as printed. J = 11, Q = 12, K = 13, A = 14.</RuleRow>
      </RuleSection>

      <RuleSection title="The cards">
        <RuleRow term="♥ Potion"><span className="text-slate-500">Heals HP = rank.</span> Only the first potion per room heals; extras are wasted.</RuleRow>
        <RuleRow term="♦ Weapon"><span className="text-slate-500">Equips it.</span> Replaces your current weapon — the old one is gone.</RuleRow>
        <RuleRow term="♣ ♠ Monster"><span className="text-slate-500">Fight it.</span> Click the card to swing your weapon (when usable); the "Bare hands" button below forces a bare-handed fight.</RuleRow>
      </RuleSection>

      <RuleSection title="How the room flows — three of four">
        <p className="text-slate-300">
          A room is 4 cards. You play <span className="text-parchment font-semibold">three of them</span> (any order, any kind), then the room refills.
        </p>
        <p className="text-slate-400 text-[12px] mt-2">
          The fourth card — the one you didn't play — <span className="text-parchment">stays for the next room</span>. Every room you see is one card you've already met plus three fresh draws. That carry-over is your only handle on dungeon order: leave the easy fight for later, leave the heavy spade for your next weapon, leave the potion to soak a bad room with.
        </p>
      </RuleSection>

      <RuleSection title="Fleeing">
        <p className="text-slate-300">
          The <span className="text-rune">Flee the room</span> button sends all 4 cards to the
          bottom of the deck and deals a fresh four from the top. You take no damage — but
          you'll see those cards again later, hopefully when you're better equipped.
        </p>
        <p className="text-slate-400 text-[12px] mt-2">
          Catch: you can't flee twice in a row. After a flee, you have to clear a fresh room
          (down to one card) before the Flee button re-arms. Flee early, before a room damages you — once it has, the damage is already paid.
        </p>
      </RuleSection>

      <RuleSection title="Damage">
        <RuleRow term="With weapon"><span className="font-mono text-slate-300">max(0, monster rank − weapon rank)</span></RuleRow>
        <RuleRow term="Bare hands">Full monster rank, straight to your HP.</RuleRow>
      </RuleSection>

      <RuleSection title="Weapon binding">
        <p className="text-slate-300">
          A fresh weapon swings at any monster. After a kill, the weapon
          <span className="text-parchment"> binds</span> — it'll only swing at monsters of equal
          or lower rank afterwards. Above the binding, the card-click is locked: your only
          option is <span className="text-rune">"Bare hands"</span>, taking the full rank.
          Taking up a new weapon resets the binding.
        </p>

        <div className="mt-3 panel p-3 text-[12px] space-y-2">
          <div className="text-rune text-[10px] uppercase tracking-[0.2em]">Worked example</div>
          <div className="text-slate-300">
            Take up a <span className="font-mono text-parchment">7♦</span>. Fresh weapon — swings at any monster.
          </div>
          <div className="text-slate-300">
            Fight a <span className="font-mono text-parchment">9♠</span>. You swing — take <span className="font-mono">9 − 7 = 2</span> damage. The weapon binds: rank <span className="font-mono">9</span> or lower from now on.
          </div>
          <div className="text-slate-300">
            Next room: a <span className="font-mono text-parchment">10♣</span>. Card-click is locked. Your options: Bare hands (eat 10), or take up a new weapon, or flee.
          </div>
          <div className="text-slate-300">
            You take up an <span className="font-mono text-parchment">8♦</span>. Binding resets — fresh weapon again, swings at any monster until its first kill.
          </div>
        </div>

        <p className="text-slate-400 text-[12px] mt-2">
          Sometimes "Bare hands" is the right call even when you could swing — eat a mid-rank
          monster to keep the weapon's binding clean for the king you can see waiting in the room.
        </p>
      </RuleSection>

      <RuleSection title="Win / lose">
        <RuleRow term="Win">Empty the deck → +1 sigil → back to the Sanctuary.</RuleRow>
        <RuleRow term="Lose">HP hits 0 → the run ends. Boons, Forge edits, and sigils all reset.</RuleRow>
      </RuleSection>

      <RuleSection title="Between descents — the Sanctuary">
        <RuleRow term="HP">Refills to full.</RuleRow>
        <RuleRow term="Boon">Pick 1 of 3. Permanent for the run.</RuleRow>
        <RuleRow term="Theme">Next descent's rules previewed before you commit.</RuleRow>
        <RuleRow term="Forge">At sigils 2, 4, and 6 — Strike or Transmute a card. Permanent.</RuleRow>
        <RuleRow term="Weapon">Carries over, arrives rested (binding cleared).</RuleRow>
      </RuleSection>
    </div>
  )
}

function RulesInlinePanel() {
  return (
    <section className="panel panel-warm p-5">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h2 className="font-display text-rune text-xl">How to play</h2>
        <span className="text-[11px] text-slate-500">
          The button up top brings this back any time.
        </span>
      </div>
      <RulesContent />
    </section>
  )
}

const RULES_TABS = [
  { id: 'rules', label: 'How to play' },
  { id: 'boons', label: 'Boons' },
  { id: 'themes', label: 'Themes' },
]

function RulesTabBar({ tab, setTab }) {
  return (
    <div className="flex gap-1 mb-5 border-b border-stone-800 overflow-x-auto">
      {RULES_TABS.map(t => {
        const active = tab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              active
                ? 'border-rune text-rune'
                : 'border-transparent text-slate-500 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

function RulesModal({ open, onClose }) {
  const [tab, setTab] = useState('rules')
  if (!open) return null
  const title = RULES_TABS.find(t => t.id === tab)?.label || 'How to play'
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 text-parchment text-xl leading-none flex items-center justify-center border border-stone-700"
          aria-label="Close rules"
        >
          ×
        </button>
        <h2 className="font-display text-rune text-2xl mb-1">{title}</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Scoundrel — the 44-card roguelike. Press <span className="font-mono text-slate-300">Esc</span> or click outside to close.
        </p>
        <RulesTabBar tab={tab} setTab={setTab} />
        {tab === 'rules' && <RulesContent />}
        {tab === 'boons' && <BoonsGlossary />}
        {tab === 'themes' && <ThemesGlossary />}
      </div>
    </div>
  )
}

const BOON_TAG_META = {
  combat: { label: 'Combat', blurb: 'Deal more, take less.' },
  survival: { label: 'Survival', blurb: 'HP and safety nets.' },
  economy: { label: 'Economy', blurb: 'Potions, fleeing, deck efficiency.' },
  build: { label: 'Build-defining', blurb: 'Big rule-bending effects.' },
}
const BOON_TAG_ORDER = ['combat', 'survival', 'economy', 'build']

function BoonsGlossary() {
  const byTag = {}
  for (const id of Object.keys(BOONS)) {
    const b = BOONS[id]
    if (b.disabled) continue
    const tag = b.tag || 'misc'
    if (!byTag[tag]) byTag[tag] = []
    byTag[tag].push(b)
  }
  return (
    <div className="space-y-5 text-[13px] leading-snug">
      <p className="text-slate-400">
        Pick 1 of 3 each sanctuary visit. Permanent for the run. Draw biases toward
        tags you've taken less.
      </p>
      {BOON_TAG_ORDER.map(tag => byTag[tag] && (
        <section key={tag}>
          <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-stone-800 flex-wrap">
            <h3 className="text-rune text-[11px] font-semibold uppercase tracking-[0.2em]">
              {BOON_TAG_META[tag].label}
            </h3>
            <span className="text-[11px] text-slate-500">{BOON_TAG_META[tag].blurb}</span>
          </div>
          <div className="space-y-2.5">
            {byTag[tag].map(b => (
              <div key={b.id} className="grid grid-cols-[8.5rem_1fr] gap-x-3">
                <div className="text-rune font-semibold">{b.name}</div>
                <div>
                  <div className="text-slate-300">{b.description}</div>
                  {b.example && (
                    <div className="text-slate-500 text-[12px] italic leading-snug mt-0.5">
                      {b.example}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const TIER_META = {
  opening: { label: 'Descent 1 — always', blurb: 'Friendly warm-up; first descent of every run.' },
  1: { label: 'Tier 1 — Light', blurb: 'Single deck bias, no rule changes.' },
  2: { label: 'Tier 2 — Heavy', blurb: 'Rule changes, harder bias.' },
  3: { label: 'Tier 3 — Spire', blurb: 'Paired effects, weirder rules.' },
}

function ThemesGlossary() {
  const all = Object.values(THEMES)
  const opening = all.filter(t => !t.tier)
  const tier1 = all.filter(t => t.tier === 1)
  const tier2 = all.filter(t => t.tier === 2)
  const tier3 = all.filter(t => t.tier === 3)
  return (
    <div className="space-y-5 text-[13px] leading-snug">
      <p className="text-slate-400">
        One Theme per descent — a deck or rule mutation just for that descent.
        You see it before you descend, so spend your Boon as counterplay.
      </p>

      <ThemeSection meta={TIER_META.opening} themes={opening} />
      {tier1.length > 0 && <ThemeSection meta={TIER_META[1]} themes={tier1} />}
      {tier2.length > 0 && <ThemeSection meta={TIER_META[2]} themes={tier2} />}
      {tier3.length > 0 && <ThemeSection meta={TIER_META[3]} themes={tier3} />}

      {tier2.length === 0 && tier3.length === 0 && (
        <p className="text-[11px] text-slate-500 italic">
          Heavier tiers (Heavy, Spire) will arrive as the dungeon deepens.
        </p>
      )}
    </div>
  )
}

function ThemeSection({ meta, themes }) {
  if (!themes || themes.length === 0) return null
  return (
    <section>
      <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-stone-800 flex-wrap">
        <h3 className="text-rune text-[11px] font-semibold uppercase tracking-[0.2em]">{meta.label}</h3>
        <span className="text-[11px] text-slate-500">{meta.blurb}</span>
      </div>
      <div className="space-y-1.5">
        {themes.map(t => (
          <div key={t.id} className="grid grid-cols-[8.5rem_1fr] gap-x-3">
            <div className="text-rune font-semibold">{t.name}</div>
            <div className="text-slate-300">{t.description}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
