import { useEffect, useRef, useState } from 'react'
import { createRun, retireRun } from './logic'
import { TopBar, RetireModal, TutorialReplayModal } from './components/TopBar'
import { CreditsModal, DevModal } from './components/modals'
import { RulesModal } from './components/rules'
import { SanctuaryView } from './components/SanctuaryView'
import { DescentView } from './components/DescentView'
import { OutcomeView } from './components/OutcomeView'

// -- Save / load -------------------------------------------------------
// Bump SAVE_VERSION whenever the shape of game state in logic.js changes
// in a way that would break older saves. Old data is discarded silently.
const SAVE_KEY = 'scoundrel:save'
const SAVE_VERSION = 1
const TUTORIAL_KEY = 'scoundrel:tutorialCompleted'

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.state) return null
    return { ...parsed.state, rng: Math.random }
  } catch {
    return null
  }
}

function saveGame(state) {
  try {
    const { rng: _rng, ...serializable } = state
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: serializable }))
  } catch {
    // Quota exceeded or storage disabled. Silently skip.
  }
}

// Tutorial completion is tracked separately from save state so it
// persists across "begin again" presses and survives a save wipe.
function tutorialAlreadyCompleted() {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'true'
  } catch {
    return false
  }
}

function markTutorialCompleted() {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'true')
  } catch {
    // ignore
  }
}

// Wraps createRun so the tutorial flag is decided once, based on
// whether the player has finished it before.
function freshRun() {
  return createRun(Math.random, { tutorial: !tutorialAlreadyCompleted() })
}

// -- Root --------------------------------------------------------------

export default function Scoundrel() {
  const [game, setGame] = useState(() => loadSavedGame() || freshRun())
  const [rulesOpen, setRulesOpen] = useState(false)
  const [retireOpen, setRetireOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [devOpen, setDevOpen] = useState(false)
  const [tutorialReplayOpen, setTutorialReplayOpen] = useState(false)

  useEffect(() => {
    saveGame(game)
  }, [game])

  // Mark the tutorial as completed when the player finishes the
  // curated descent (tutorial flag flips off via endDescentVictory and
  // they land in sanctuary). Death during tutorial leaves the flag on
  // and phase=gameover, so it won't fire there.
  const wasTutorialRef = useRef(game.tutorial)
  useEffect(() => {
    if (wasTutorialRef.current && !game.tutorial && game.phase === 'sanctuary') {
      markTutorialCompleted()
    }
    wasTutorialRef.current = game.tutorial
  }, [game.tutorial, game.phase])

  useEffect(() => {
    const anyOpen = rulesOpen || retireOpen || creditsOpen || devOpen || tutorialReplayOpen
    if (!anyOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (devOpen) setDevOpen(false)
      else if (creditsOpen) setCreditsOpen(false)
      else if (retireOpen) setRetireOpen(false)
      else if (tutorialReplayOpen) setTutorialReplayOpen(false)
      else if (rulesOpen) setRulesOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rulesOpen, retireOpen, creditsOpen, devOpen, tutorialReplayOpen])

  const confirmReplayTutorial = () => {
    setGame(createRun(Math.random, { tutorial: true }))
    setTutorialReplayOpen(false)
  }

  const confirmRetire = () => {
    setGame(g => retireRun(g))
    setRetireOpen(false)
  }

  return (
    <div className="min-h-screen text-parchment flex flex-col items-center">
      <TopBar
        game={game}
        onOpenRules={() => setRulesOpen(true)}
        onRetire={() => setRetireOpen(true)}
        onOpenCredits={() => setCreditsOpen(true)}
        onOpenDev={() => setDevOpen(true)}
        onReplayTutorial={() => setTutorialReplayOpen(true)}
      />
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <RetireModal
        open={retireOpen}
        sigilsEarned={game.sigilsEarned}
        sigilTarget={game.sigilTarget}
        onConfirm={confirmRetire}
        onCancel={() => setRetireOpen(false)}
      />
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      <DevModal open={devOpen} onClose={() => setDevOpen(false)} game={game} setGame={setGame} />
      <TutorialReplayModal
        open={tutorialReplayOpen}
        onConfirm={confirmReplayTutorial}
        onCancel={() => setTutorialReplayOpen(false)}
      />
      <main className="flex-1 w-full max-w-7xl px-4 sm:px-6 pt-16 sm:pt-20 pb-8">
        {game.phase === 'sanctuary' && <SanctuaryView game={game} setGame={setGame} />}
        {game.phase === 'descent' && <DescentView game={game} setGame={setGame} />}
        {(game.phase === 'gameover' || game.phase === 'victory') && (
          <OutcomeView game={game} onBeginAgain={() => setGame(freshRun())} />
        )}
      </main>
    </div>
  )
}
