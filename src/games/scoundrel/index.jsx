import { useState, useCallback } from 'react'
import {
  createGame,
  playCard,
  fleeRoom,
  isMonster,
  isWeapon,
  isPotion,
  rankLabel,
  SUIT_GLYPH,
  HEART,
  DIAMOND,
} from './logic'

export default function Scoundrel() {
  const [game, setGame] = useState(() => createGame())

  const onCard = useCallback((i) => setGame(g => playCard(g, i)), [])
  const onFlee = useCallback(() => setGame(g => fleeRoom(g)), [])
  const onReset = useCallback(() => setGame(createGame()), [])

  return (
    <div className="min-h-screen bg-dungeon text-parchment p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <Header hp={game.hp} maxHp={game.maxHp} deckCount={game.deck.length} />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
          <section>
            <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-2">Room</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {game.room.map((c, i) => (
                <CardSlot key={i} card={c} onClick={() => c && onCard(i)} disabled={game.over} />
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onFlee}
                disabled={!game.canFlee || game.over}
                className="px-3 py-2 rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
              >
                Flee room
              </button>
              <button
                onClick={onReset}
                className="px-3 py-2 rounded bg-blood hover:bg-red-600 text-sm"
              >
                New run
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <WeaponPanel weapon={game.weapon} lastSlain={game.lastSlain} />
            <LogPanel lines={game.log} />
          </aside>
        </div>

        {game.over && <Outcome won={game.won} hp={game.hp} onReset={onReset} />}
      </div>
    </div>
  )
}

function Header({ hp, maxHp, deckCount }) {
  return (
    <header className="flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-rune">Scoundrel</h1>
        <p className="text-xs text-slate-400">A 44-card dungeon for one.</p>
      </div>
      <div className="text-right text-sm">
        <div>HP <span className="font-mono">{hp}/{maxHp}</span></div>
        <div className="text-slate-400">Deck <span className="font-mono">{deckCount}</span></div>
      </div>
    </header>
  )
}

function CardSlot({ card, onClick, disabled }) {
  if (!card) {
    return <div className="aspect-[2/3] rounded-lg border border-dashed border-stone-700 bg-stone-900/40" />
  }
  const red = card.suit === HEART || card.suit === DIAMOND
  const kind = isMonster(card) ? 'Monster' : isWeapon(card) ? 'Weapon' : isPotion(card) ? 'Potion' : ''
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`aspect-[2/3] rounded-lg border border-stone-700 bg-parchment text-stone-900 p-2 flex flex-col justify-between text-left transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in ${red ? '' : ''}`}
    >
      <div className={`text-lg font-bold ${red ? 'text-blood' : 'text-stone-900'}`}>
        {rankLabel(card.rank)}{SUIT_GLYPH[card.suit]}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-stone-600">{kind}</div>
      <div className={`text-2xl text-right ${red ? 'text-blood' : 'text-stone-900'}`}>
        {SUIT_GLYPH[card.suit]}
      </div>
    </button>
  )
}

function WeaponPanel({ weapon, lastSlain }) {
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-900/60 p-3">
      <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Weapon</div>
      {weapon ? (
        <div className="text-sm">
          <div className="font-mono text-rune">{rankLabel(weapon.rank)}♦</div>
          <div className="text-[11px] text-slate-400">
            {lastSlain
              ? `Bound. Next foe must be lower than ${rankLabel(lastSlain.rank)}.`
              : 'Ready.'}
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500">Unarmed.</div>
      )}
    </div>
  )
}

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

function Outcome({ won, hp, onReset }) {
  return (
    <div className="mt-6 rounded-lg border border-stone-700 bg-stone-900/80 p-5 text-center animate-fade-in">
      <div className={`text-xl font-bold ${won ? 'text-rune' : 'text-blood'}`}>
        {won ? 'You escaped.' : 'You died.'}
      </div>
      <div className="text-sm text-slate-400 mt-1">
        {won ? `Final HP: ${hp}` : 'The dungeon claims another.'}
      </div>
      <button onClick={onReset} className="mt-3 px-4 py-2 rounded bg-blood hover:bg-red-600 text-sm">
        New run
      </button>
    </div>
  )
}
