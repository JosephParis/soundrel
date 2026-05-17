import { useState, useCallback, useMemo } from 'react'
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

export default function Scoundrel() {
  const [game, setGame] = useState(() => createRun())

  return (
    <div className="min-h-screen bg-dungeon text-parchment p-4 sm:p-6 flex items-start justify-center">
      <div className="w-full max-w-4xl">
        {game.phase === 'sanctuary' && <SanctuaryView game={game} setGame={setGame} />}
        {game.phase === 'descent' && <DescentView game={game} setGame={setGame} />}
        {(game.phase === 'gameover' || game.phase === 'victory') && (
          <OutcomeView game={game} setGame={setGame} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// Sanctuary
// ============================================================

function SanctuaryView({ game, setGame }) {
  const theme = getTheme(game.nextTheme)
  const canDescend = game.boonChosen
  const isOpeningVisit = game.sigilsEarned === 0

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-rune">The Great Hall</h1>
          <p className="text-xs text-slate-400">
            {isOpeningVisit
              ? 'The rune-chains hum. The dark below is quiet — for now.'
              : 'The carving-stones are silent. The dungeon shifts beyond the threshold.'}
          </p>
        </div>
        <SigilTracker count={game.sigilsEarned} target={game.sigilTarget} />
      </header>

      <NextThemePanel theme={theme} firstRun={game.firstRunSoftener && isOpeningVisit} />

      {!isOpeningVisit && !game.boonChosen && game.boonOffers.length > 0 && (
        <BoonOfferPanel
          offers={game.boonOffers}
          onPick={(id) => setGame(g => pickBoon(g, id))}
        />
      )}

      {game.forgeOpen && !game.forgeUsed && !game.forgeView && (
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

      <RunStatePanel game={game} />

      <div className="flex justify-end gap-2">
        <button
          onClick={() => setGame(g => descend(g))}
          disabled={!canDescend || game.forgeView !== null}
          className="px-4 py-2 rounded bg-blood hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold"
        >
          Descend
        </button>
      </div>

      <LogPanel lines={game.log} />
    </div>
  )
}

function SigilTracker({ count, target }) {
  return (
    <div className="text-right text-sm">
      <div className="text-xs uppercase tracking-widest text-slate-400">Sigils set</div>
      <div className="font-mono text-rune text-lg">{count} / {target}</div>
    </div>
  )
}

function NextThemePanel({ theme, firstRun }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Tonight's air</div>
      {theme ? (
        <div>
          <div className="text-rune font-semibold">{theme.name}</div>
          <div className="text-[12px] text-slate-300 mt-0.5">{theme.description}</div>
        </div>
      ) : (
        <div>
          <div className="text-rune font-semibold">Quiet</div>
          <div className="text-[12px] text-slate-300 mt-0.5">
            {firstRun
              ? 'The first descent finds the deep dream still asleep. The dungeon shifts nothing.'
              : 'No theme tonight.'}
          </div>
        </div>
      )}
    </div>
  )
}

function BoonOfferPanel({ offers, onPick }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">
        Take a memory — pick one Boon
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {offers.map(id => {
          const boon = getBoon(id)
          return (
            <button
              key={id}
              onClick={() => onPick(id)}
              className="text-left rounded border border-stone-600 bg-stone-800/80 p-3 hover:border-rune hover:bg-stone-800 transition"
            >
              <div className="font-semibold text-rune">{boon.name}</div>
              <div className="text-[12px] text-slate-300 mt-1">{boon.description}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ForgePromptPanel({ onStrike, onTransmute }) {
  return (
    <div className="rounded-lg border border-amber-700 bg-amber-950/40 p-3">
      <div className="text-xs uppercase tracking-widest text-amber-200 mb-1">The Forge is open</div>
      <p className="text-[12px] text-slate-300 mb-3">
        The threshold is quiet enough to carve. You may strike a name from the rolls
        (with a matched offering) or transmute a card's suit. One action only.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onStrike}
          className="px-3 py-2 rounded bg-stone-700 hover:bg-stone-600 text-sm"
        >
          Strike a name
        </button>
        <button
          onClick={onTransmute}
          className="px-3 py-2 rounded bg-stone-700 hover:bg-stone-600 text-sm"
        >
          Transmute a card
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Strike UI
// ============================================================

function StrikeView({ game, onConfirm, onCancel }) {
  const { monsters, byRank } = useMemo(() => getStrikeOptions(game), [game])
  const [pickedMonster, setPickedMonster] = useState(null)
  const offerings = pickedMonster ? (byRank[pickedMonster.rank] || []) : []

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/80 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Strike a name</div>
      <p className="text-[12px] text-slate-400 mb-3">
        Pick a monster to bind. Then pick a weapon or potion of the <em>same rank</em> as a matched offering.
        Face-card dead (J/Q/K/A) are too weighty for the threshold to accept.
      </p>

      <div className="mb-3">
        <div className="text-[11px] uppercase text-slate-400 mb-1">1. Name to bind</div>
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
        <div className="mb-3">
          <div className="text-[11px] uppercase text-slate-400 mb-1">
            2. Matched offering (rank {rankLabel(pickedMonster.rank)})
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

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded bg-stone-800 hover:bg-stone-700 text-sm"
        >
          Step away from the threshold
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Transmute UI
// ============================================================

function TransmuteView({ game, onConfirm, onCancel }) {
  const cards = useMemo(() => getTransmuteOptions(game), [game])
  const [picked, setPicked] = useState(null)

  const suits = [HEART, DIAMOND, CLUB, SPADE]

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/80 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Transmute a card</div>
      <p className="text-[12px] text-slate-400 mb-3">
        Change a card's suit. Its rank stays the same. Useful for turning a heavy
        spade into a heart or a diamond.
      </p>

      <div className="mb-3">
        <div className="text-[11px] uppercase text-slate-400 mb-1">1. Card to transmute</div>
        <CardPickerGrid
          cards={cards}
          selected={picked?.id}
          onPick={(c) => setPicked(c)}
        />
      </div>

      {picked && (
        <div className="mb-3">
          <div className="text-[11px] uppercase text-slate-400 mb-1">
            2. New suit for {rankLabel(picked.rank)}{SUIT_GLYPH[picked.suit]}
          </div>
          <div className="flex gap-2 flex-wrap">
            {suits.filter(s => s !== picked.suit).map(s => (
              <button
                key={s}
                onClick={() => onConfirm(picked.id, s)}
                className="px-4 py-2 rounded bg-stone-700 hover:bg-stone-600 text-sm"
              >
                {SUIT_GLYPH[s]} — {rankLabel(picked.rank)} as a {suitName(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded bg-stone-800 hover:bg-stone-700 text-sm"
        >
          Step away
        </button>
      </div>
    </div>
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
    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
      {cards.map(c => {
        const red = c.suit === HEART || c.suit === DIAMOND
        const isSelected = selected === c.id
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            className={`aspect-[2/3] rounded border p-1 flex flex-col justify-between text-left transition ${
              isSelected
                ? 'border-rune bg-stone-700'
                : 'border-stone-600 bg-stone-800 hover:bg-stone-700'
            }`}
          >
            <div className={`text-sm font-bold leading-none ${red ? 'text-blood' : 'text-parchment'}`}>
              {rankLabel(c.rank)}{SUIT_GLYPH[c.suit]}
            </div>
            {c.transmuted && (
              <div className="text-[8px] text-amber-300 uppercase">tm</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================
// Run state panel (shows accumulated Boons, deck edits)
// ============================================================

function RunStatePanel({ game }) {
  if (game.boons.length === 0 && game.strikes.length === 0 && Object.keys(game.transmutes).length === 0 && !game.carriedWeapon) {
    return null
  }
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/40 p-3 text-[12px] space-y-1">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">What you carry</div>
      {game.carriedWeapon && (
        <div className="text-slate-300">
          Carried weapon: <span className="text-rune">{rankLabel(game.carriedWeapon.rank)}♦</span> (rests this visit)
        </div>
      )}
      {game.boons.length > 0 && (
        <div className="text-slate-300">
          Boons: {game.boons.map(id => (
            <span key={id} className="text-rune">{BOONS[id]?.name}</span>
          )).reduce((acc, el, i) => (
            i === 0 ? [el] : [...acc, <span key={`s${i}`} className="text-slate-500">, </span>, el]
          ), [])}
        </div>
      )}
      {game.strikes.length > 0 && (
        <div className="text-slate-300">
          Names carved: <span className="text-rune">{game.strikes.length / 2}</span>
        </div>
      )}
      {Object.keys(game.transmutes).length > 0 && (
        <div className="text-slate-300">
          Transmutations: <span className="text-rune">{Object.keys(game.transmutes).length}</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Descent (the actual Scoundrel game)
// ============================================================

function DescentView({ game, setGame }) {
  const onCard = useCallback((i) => setGame(g => playCard(g, i)), [setGame])
  const onCardBare = useCallback((i) => setGame(g => playCardBare(g, i)), [setGame])
  const onFlee = useCallback(() => setGame(g => fleeRoom(g)), [setGame])

  const theme = getTheme(game.theme)

  return (
    <div className="space-y-3">
      <DescentHeader game={game} theme={theme} />

      <section>
        <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2">Room</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-items-start">
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

        <div className="mt-4 flex gap-2 justify-center sm:justify-start">
          <button
            onClick={onFlee}
            disabled={!game.canFlee}
            className="px-3 py-2 rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            Flee the room
          </button>
        </div>
      </section>

      <aside className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-3">
          <ConditionsPanel game={game} theme={theme} />
          <WeaponPanel game={game} />
        </div>
        <LogPanel lines={game.log} />
      </aside>
    </div>
  )
}

function ConditionsPanel({ game, theme }) {
  const hpDesc = describeMaxHp(game)
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3 space-y-2.5">
      <div className="text-xs uppercase tracking-widest text-slate-400">Conditions</div>

      <div className="text-[12px]">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">Tonight</div>
        <div className="text-rune font-semibold">{theme ? theme.name : 'Quiet'}</div>
        {theme && <div className="text-slate-400 text-[11px] mt-0.5">{theme.description}</div>}
        {!theme && <div className="text-slate-400 text-[11px] mt-0.5">No theme. The dungeon shifts nothing.</div>}
      </div>

      <div className="text-[12px]">
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">Max HP</div>
        <div className="text-parchment font-mono">
          {hpDesc.value} <Formula parts={hpDesc.parts} />
        </div>
      </div>

      {game.boons.length > 0 && (
        <div className="text-[12px]">
          <div className="text-slate-400 text-[10px] uppercase tracking-wider">Boons</div>
          <ul className="space-y-1 mt-1">
            {game.boons.map(id => {
              const b = BOONS[id]
              return (
                <li key={id} className="text-[11px]">
                  <span className="text-rune font-semibold">{b.name}</span>
                  <span className="text-slate-400"> — {b.description}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {game.firstRunSoftener && (
        <div className="text-[11px] border-t border-stone-800 pt-2">
          <span className="text-amber-300">First-run softener:</span>
          <span className="text-slate-400"> +3 max HP, no theme on descent 1.</span>
        </div>
      )}
    </div>
  )
}

function DescentHeader({ game, theme }) {
  const hpDesc = describeMaxHp(game)
  return (
    <header className="flex items-end justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-rune">The dungeon</h1>
        <p className="text-xs text-slate-400">
          {theme ? <>Tonight: <span className="text-parchment">{theme.name}</span></> : 'A quiet night.'}
        </p>
      </div>
      <div className="text-right text-xs space-y-0.5">
        <div>
          HP <span className="font-mono text-base text-parchment">{game.hp}/{game.maxHp}</span>
          <div><Formula parts={hpDesc.parts} /></div>
        </div>
        <div className="text-slate-400">Deck <span className="font-mono">{game.deck.length}</span></div>
        <div className="text-slate-400">Sigils <span className="font-mono">{game.sigilsEarned}/{game.sigilTarget}</span></div>
      </div>
    </header>
  )
}

function CardSlot({ card, onClick, onBareHands, weaponDamage, bareDamage }) {
  if (!card) {
    return <div className="aspect-[2/3] w-full max-w-[160px] rounded-lg border border-dashed border-stone-700 bg-stone-900/40" />
  }
  const red = card.suit === HEART || card.suit === DIAMOND
  const kind = isMonster(card) ? 'Monster' : isWeapon(card) ? 'Weapon' : isPotion(card) ? 'Potion' : ''
  const monster = isMonster(card)
  const willUseWeapon = monster && weaponDamage !== null
  const previewDesc = !monster
    ? null
    : willUseWeapon ? weaponDamage : bareDamage
  const previewIcon = willUseWeapon ? '⚔' : '✊'

  return (
    <div className="w-full max-w-[160px] flex flex-col">
      <button
        onClick={onClick}
        className="aspect-[2/3] rounded-lg border border-stone-700 bg-parchment text-stone-900 p-3 flex flex-col justify-between text-left transition-transform hover:-translate-y-0.5"
      >
        <div className={`text-3xl font-bold leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
        </div>
        <div className="text-xs uppercase tracking-widest text-stone-600 text-center flex flex-col items-center gap-0.5">
          <span>{kind}</span>
          {previewDesc && (
            <>
              <span className="text-[10px] normal-case tracking-normal text-stone-700">
                {previewIcon} take {previewDesc.value}
              </span>
              {previewDesc.parts.length > 1 && (
                <span className="text-[9px] normal-case tracking-normal text-stone-500 leading-tight">
                  ({formatFormula(previewDesc.parts)})
                </span>
              )}
            </>
          )}
        </div>
        <div className={`text-5xl text-right leading-none ${red ? 'text-blood' : 'text-stone-900'}`}>
          {SUIT_GLYPH[card.suit]}
        </div>
      </button>
      {onBareHands && (
        <button
          onClick={onBareHands}
          className="mt-1 w-full py-1 px-1.5 rounded bg-stone-700 hover:bg-stone-600 text-parchment flex flex-col items-center"
        >
          <span className="text-[11px]">✊ Bare hands · take {bareDamage.value}</span>
          {bareDamage.parts.length > 1 && (
            <span className="text-[9px] text-stone-300 leading-tight">
              ({formatFormula(bareDamage.parts)})
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function WeaponPanel({ game }) {
  const { weapon, lastSlain } = game
  const strength = weapon ? describeWeaponStrength(game) : null
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Weapon</div>
      {weapon ? (
        <div className="text-sm space-y-0.5">
          <div className="font-mono text-rune">{rankLabel(weapon.rank)}♦</div>
          <div className="text-[11px] text-slate-300">
            Strikes as <span className="text-parchment font-mono">{strength.value}</span>{' '}
            <Formula parts={strength.parts} />
          </div>
          <div className="text-[11px] text-slate-400">
            {lastSlain
              ? `Bound to rank ${rankLabel(lastSlain.rank)} or lower.`
              : 'Ready — will swing for any foe.'}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">Bare-handed.</div>
      )}
    </div>
  )
}

// ============================================================
// Outcome
// ============================================================

function OutcomeView({ game, setGame }) {
  const won = game.phase === 'victory'
  return (
    <div className="mt-6 rounded-lg border border-stone-700 bg-stone-900/80 p-6 text-center space-y-3">
      <div className={`text-2xl font-bold ${won ? 'text-rune' : 'text-blood'}`}>
        {won ? 'The high gate opens.' : 'You fall in the dark.'}
      </div>
      <div className="text-sm text-slate-300">
        {won
          ? `Seven sigils set. The eagles come at dawn.`
          : 'The threshold fades. The next who wakes here will walk into the same dungeon you did.'}
      </div>
      <div className="text-xs text-slate-500">
        Sigils set: {game.sigilsEarned} / {game.sigilTarget}
      </div>
      <button
        onClick={() => setGame(createRun())}
        className="mt-2 px-4 py-2 rounded bg-blood hover:bg-red-600 text-sm font-semibold"
      >
        Begin again
      </button>
      <div className="pt-3 border-t border-stone-800">
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
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3 max-h-48 overflow-y-auto">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Log</div>
      <ul className="text-[12px] space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-slate-300">{l}</li>
        ))}
      </ul>
    </div>
  )
}
