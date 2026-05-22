export function TopBar({ game, onOpenRules, onRetire, onOpenCredits, onOpenDev, onReplayTutorial }) {
  const runActive = game.phase === 'sanctuary' || game.phase === 'descent'
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
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {runActive && (
            <button
              onClick={onRetire}
              className="px-3 py-1.5 rounded-md border border-stone-700 hover:border-blood/60 text-slate-400 hover:text-blood text-xs sm:text-sm font-medium transition"
            >
              Retire
            </button>
          )}
          <button
            onClick={onOpenRules}
            className="px-3 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-xs sm:text-sm font-medium transition"
          >
            How to play
          </button>
          <button
            onClick={onReplayTutorial}
            className="px-3 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-xs sm:text-sm font-medium transition"
          >
            Tutorial
          </button>
          <button
            onClick={onOpenCredits}
            aria-label="Credits"
            title="Credits"
            className="px-2.5 py-1.5 rounded-md border border-stone-700 hover:border-rune/60 text-slate-400 hover:text-rune text-xs sm:text-sm font-medium transition"
          >
            ✦
          </button>
          <button
            onClick={onOpenDev}
            aria-label="Dev overrides"
            title="Dev overrides"
            className="px-2.5 py-1.5 rounded-md border border-stone-700 hover:border-amber-600/60 text-stone-500 hover:text-amber-300/80 text-xs sm:text-sm font-medium transition"
          >
            ⚙
          </button>
        </div>
      </div>
    </header>
  )
}

export function RetireModal({ open, sigilsEarned, sigilTarget, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-blood text-2xl mb-1">Retire run?</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to cancel.
        </p>
        <p className="text-sm text-slate-300 leading-snug mb-2">
          You will end this run with {sigilsEarned} of {sigilTarget} sigils set. All
          boons, weapons, and progress will be lost.
        </p>
        <p className="text-[12px] text-slate-500 italic leading-snug mb-6">
          The next who wakes here will walk into a different dungeon.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-gradient-to-b from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-parchment text-sm font-medium border border-red-800/80"
          >
            Retire
          </button>
        </div>
      </div>
    </div>
  )
}

// Destructive: starting the tutorial wipes the current run. Confirm
// before nuking progress.
export function TutorialReplayModal({ open, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="panel max-w-md w-full p-6 sm:p-8 my-4 sm:my-auto relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-display text-rune text-2xl mb-1">Replay the tutorial?</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Press <span className="font-mono text-slate-300">Esc</span> or click outside to cancel.
        </p>
        <p className="text-sm text-slate-300 leading-snug mb-2">
          A new run will start with the walkthrough. Your current run, including
          sigils, boons, and forge edits, will be lost.
        </p>
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-stone-700 hover:border-rune/60 text-slate-300 hover:text-parchment text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-950 text-sm font-medium border border-amber-700/80"
          >
            Start tutorial
          </button>
        </div>
      </div>
    </div>
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
