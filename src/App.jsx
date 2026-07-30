import { useEffect } from 'react'
import { GameProvider, useGame } from './state/GameContext'
import { installAudioUnlock, setSoundEnabled } from './audio/sfx'
import MenuScreen from './components/MenuScreen'
import ModeSelect from './components/ModeSelect'
import GameScreen from './components/GameScreen'
import ResultScreen from './components/ResultScreen'
import TrophyScreen from './components/TrophyScreen'
import RosterScreen from './components/RosterScreen'
import MasteryMap from './components/MasteryMap'
import SeasonScreen from './components/SeasonScreen'
import ParentView from './components/ParentView'
import UnlockToast from './components/UnlockToast'

const SCREENS = {
  menu:   MenuScreen,
  mode:   ModeSelect,
  game:   GameScreen,
  result: ResultScreen,
  trophy: TrophyScreen,
  roster: RosterScreen,
  map:    MasteryMap,
  season: SeasonScreen,
}

/* Reached only by URL, so it isn't part of the child's navigation */
const PARENT_MODE = new URLSearchParams(window.location.search).has('parent')

function Shell() {
  const { state, dispatch } = useGame()
  const Screen = PARENT_MODE ? ParentView : (SCREENS[state.screen] ?? MenuScreen)

  useEffect(installAudioUnlock, [])
  useEffect(() => { setSoundEnabled(state.settings.sound) }, [state.settings.sound])

  /* Hold an unlock until the child is between rounds. Good news landing over a
     live question is still an interruption, and an assertive live region cuts
     across a screen reader mid-problem. */
  const showToast = state.toast && state.screen !== 'game'

  useEffect(() => {
    if (!showToast) return
    const id = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3400)
    return () => clearTimeout(id)
  }, [showToast, dispatch])

  return (
    <>
      <Screen />
      <UnlockToast message={showToast ? state.toast : null} />
    </>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  )
}
