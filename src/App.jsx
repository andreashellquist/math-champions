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
import UnlockToast from './components/UnlockToast'

const SCREENS = {
  menu:   MenuScreen,
  mode:   ModeSelect,
  game:   GameScreen,
  result: ResultScreen,
  trophy: TrophyScreen,
  roster: RosterScreen,
  map:    MasteryMap,
}

function Shell() {
  const { state, dispatch } = useGame()
  const Screen = SCREENS[state.screen] ?? MenuScreen

  useEffect(installAudioUnlock, [])
  useEffect(() => { setSoundEnabled(state.settings.sound) }, [state.settings.sound])

  useEffect(() => {
    if (!state.toast) return
    const id = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3400)
    return () => clearTimeout(id)
  }, [state.toast, dispatch])

  return (
    <>
      <Screen />
      <UnlockToast message={state.toast} />
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
