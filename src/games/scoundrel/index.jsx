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
  getStrikeOptions,
  getTransmuteOptions,
  previewMonsterDamage,
  describeMaxHp,
  describeWeaponStrength,
  getBoon,
  getTheme,
  BOONS,
  THEMES,
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

// Skull — single closed outline path for the cranium, cheekbones, and three-tooth
// jaw. Eyes and nose are stroke-only too (no fill="currentColor"), so every part
// of the icon paints at the same uniform opacity. Previously, mixing fill and
// stroke on tiny shapes (eyes, nose) caused them to render visibly darker than
// the outline — fill + stroke compounded the color at the overlap.
function SkullIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a9 9 0 0 0-9 9v4a2 2 0 0 0 2 2v3h3v-2h2v2h4v-2h2v2h3v-3a2 2 0 0 0 2-2v-4a9 9 0 0 0-9-9z" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <path d="M12 15l-1.2 2.2h2.4z" />
    </svg>
  )
}

function SwordIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" x2="19" y1="19" y2="13" />
      <line x1="16" x2="20" y1="16" y2="20" />
      <line x1="19" x2="21" y1="21" y2="19" />
    </svg>
  )
}

function PotionIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" />
      <path d="M6.453 15h11.094" />
      <path d="M8.5 2h7" />
    </svg>
  )
}

// Faded type-glyph behind the card face. Color matches the border (green for
// monsters, silver for weapons, purple for potions) at low opacity.
function CardWatermark({ card }) {
  if (!card) return null
  let Icon, colorClass
  if (isMonster(card)) {
    Icon = SkullIcon
    colorClass = 'text-green-700/30'
  } else if (isWeapon(card)) {
    Icon = SwordIcon
    colorClass = 'text-gray-500/40'
  } else if (isPotion(card)) {
    Icon = PotionIcon
    colorClass = 'text-purple-700/30'
  } else {
    return null
  }
  return (
    <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${colorClass}`}>
      <Icon className="w-3/5 h-3/5" />
    </div>
  )
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {theme && <NextThemePanel theme={theme} />}
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
    </div>
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

function NextThemePanel({ theme }) {
  return (
    <div className="panel p-4">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Tonight's air</div>
      <div className="font-display text-rune text-lg mb-1">{theme.name}</div>
      <div className="text-[13px] text-slate-300 leading-snug">{theme.description}</div>
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

function ForgePromptPanel({ onStrike, onTransmute }) {
  return (
    <section className="panel panel-warm p-5">
      <div className="text-center mb-4">
        <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">The Forge is open</div>
        <h2 className="font-display text-rune text-lg mt-1">Carve once into the threshold</h2>
        <p className="text-[12px] text-slate-400 mt-1 max-w-md mx-auto">
          You may strike a name from the rolls (with a matched offering) or transmute a card's suit.
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
  const offerings = pickedMonster ? (byRank[pickedMonster.rank] || []) : []

  return (
    <ForgeViewShell
      kindLabel="Strike"
      title="Carve a name from the rolls"
      blurb="Pick a monster, then pick a weapon or potion of the same rank as a matched offering. Face-card dead (J/Q/K/A) are too weighty for the threshold."
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
          <div className="text-[12px] text-slate-500 italic">No lesser dead remain to bind.</div>
        )}
      </div>

      {pickedMonster && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
            2. Matched offering · rank {rankLabel(pickedMonster.rank)}
          </div>
          {offerings.length > 0 ? (
            <CardPickerGrid
              cards={offerings}
              onPick={(o) => onConfirm(pickedMonster.id, o.id)}
            />
          ) : (
            <div className="text-[12px] text-slate-500 italic">
              No weapon or potion of rank {rankLabel(pickedMonster.rank)} remains. Pick another name.
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

  return (
    <ForgeViewShell
      kindLabel="Transmute"
      title="Change a card's suit"
      blurb="The rank stays the same. Useful for turning a heavy spade into a heart or a diamond."
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
            {suits.filter(s => s !== picked.suit).map(s => (
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

function suitName(suit) {
  if (suit === HEART) return 'potion'
  if (suit === DIAMOND) return 'weapon'
  if (suit === CLUB) return 'beast'
  return 'wraith'
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
            className={`relative overflow-hidden aspect-[2/3] rounded border-2 p-1 flex flex-col justify-between text-left transition ${
              isSelected
                ? 'border-rune bg-stone-700'
                : `${cardBorderTone(c)} bg-stone-900 hover:bg-stone-800`
            }`}
          >
            <CardWatermark card={c} />
            <div className={`relative text-sm font-bold leading-none ${red ? 'text-blood' : 'text-parchment'}`}>
              {rankLabel(c.rank)}{SUIT_GLYPH[c.suit]}
            </div>
            {c.transmuted && (
              <div className="relative text-[8px] text-rune uppercase tracking-wider">tm</div>
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
  const onCard = useCallback((i) => setGame(g => playCard(g, i)), [setGame])
  const onCardBare = useCallback((i) => setGame(g => playCardBare(g, i)), [setGame])
  const onFlee = useCallback(() => setGame(g => fleeRoom(g)), [setGame])

  const theme = getTheme(game.theme)

  return (
    <div className="space-y-5 animate-fade-in">
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
              const preview = previewMonsterDamage(game, c)
              weaponDamage = preview.weapon
              bareDamage = preview.bare
            }
            const showBare = weaponDamage !== null
            return (
              <CardSlot
                key={i}
                card={c}
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
          <ConditionsPanel game={game} theme={theme} />
          <WeaponPanel game={game} />
        </div>
        <LogPanel lines={game.log} />
      </aside>
    </div>
  )
}

function DescentHeader({ game, theme }) {
  return (
    <header className="text-center space-y-3 pb-2">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-rune">The dungeon</h1>
        {theme && (
          <p className="text-[13px] text-slate-400 mt-1">
            Tonight: <span className="text-parchment">{theme.name}</span>
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
              return (
                <li key={id} className="text-[11px] leading-snug">
                  <span className="text-rune font-semibold">{b.name}</span>
                  <span className="text-slate-400"> — {b.description}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function CardSlot({ card, onClick, onBareHands, weaponDamage, bareDamage }) {
  if (!card) {
    return (
      <div className="aspect-[2/3] w-full max-w-[200px] rounded-lg border border-dashed border-stone-800 bg-stone-900/30" />
    )
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
        onClick={onClick}
        className={`relative overflow-hidden aspect-[2/3] rounded-lg border-2 ${cardBorderTone(card)} bg-gradient-to-b from-parchment to-[#e8d5b3] text-stone-900 p-4 flex flex-col justify-between text-left transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] shadow-md`}
      >
        <CardWatermark card={card} />
        <div className={`relative text-4xl font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
        </div>
        <div className="relative text-xs uppercase tracking-[0.2em] text-stone-600 text-center flex flex-col items-center gap-0.5">
          <span>{kind}</span>
          {previewDesc && (
            <>
              <span className="text-[12px] normal-case tracking-normal text-stone-800 font-medium mt-1">
                {previewIcon} take {previewDesc.value}
              </span>
              {previewDesc.parts.length > 1 && (
                <span className="text-[10px] normal-case tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(previewDesc.parts)})
                </span>
              )}
            </>
          )}
        </div>
        <div className={`relative text-6xl text-right leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {SUIT_GLYPH[card.suit]}
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

function WeaponBlock({ game, weapon, label }) {
  const strength = describeWeaponStrength(game, weapon)
  const lastSlain = weapon.lastSlain
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm space-y-0.5 flex-1 min-w-0">
        {label && (
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        )}
        <div className="font-mono text-rune text-base">{rankLabel(weapon.rank)}♦</div>
        <div className="text-[11px] text-slate-400">
          Strikes as <span className="text-parchment font-mono">{strength.value}</span>{' '}
          <Formula parts={strength.parts} />
        </div>
        <div className="text-[11px] text-slate-500">
          {lastSlain
            ? `Bound to rank ${rankLabel(lastSlain.rank)} or lower.`
            : 'Ready — will swing for any foe.'}
        </div>
      </div>
      <div
        className={`font-mono font-bold leading-none shrink-0 text-center text-4xl w-12 ${
          lastSlain ? 'text-parchment' : 'text-stone-700'
        }`}
        aria-label={lastSlain ? `Bound to ${rankLabel(lastSlain.rank)}` : 'No binding'}
      >
        {lastSlain ? rankLabel(lastSlain.rank) : '—'}
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
    <div className={`relative overflow-hidden aspect-[2/3] w-11 rounded-sm border-2 ${cardBorderTone(card)} bg-parchment text-stone-900 px-1 py-0.5 flex flex-col justify-between shadow`}>
      <CardWatermark card={card} />
      <div className={`relative text-[11px] font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
        {rankLabel(card.rank)}
      </div>
      <div className={`relative text-sm leading-none text-right ${red ? 'text-blood' : 'text-stone-900'}`}>
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
        <RuleRow term="♣ ♠ Monster"><span className="text-slate-500">Fight it.</span> Click the card to swing your weapon (when usable); the "Bare hands" button below forces an unarmed fight.</RuleRow>
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
          (down to one card) before the Flee button re-arms. Flee early, before a room mauls you — once it's wounded you, the damage is already paid.
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
            Take up a <span className="font-mono text-parchment">7♦</span>. Fresh blade — swings at anything.
          </div>
          <div className="text-slate-300">
            Fight a <span className="font-mono text-parchment">9♠</span>. You swing — take <span className="font-mono">9 − 7 = 2</span> damage. The blade binds: rank <span className="font-mono">9</span> or lower from now on.
          </div>
          <div className="text-slate-300">
            Next room: a <span className="font-mono text-parchment">10♣</span>. Card-click is locked. Your options: Bare hands (eat 10), or take up a new weapon, or flee.
          </div>
          <div className="text-slate-300">
            You grab an <span className="font-mono text-parchment">8♦</span>. Binding resets — fresh blade again, swings at anything until its first kill.
          </div>
        </div>

        <p className="text-slate-400 text-[12px] mt-2">
          Sometimes "Bare hands" is the right call even when you could swing — eat a mid-rank
          monster to keep the blade's edge clean for the king you can see waiting in the room.
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
