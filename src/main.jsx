import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted rather than fetched from Google Fonts: a cross-origin webfont
// is a hard network dependency, so offline the app would silently fall back
// to a generic sans — which defeats the point of shipping it as a PWA.
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/900.css'
import './App.css'
import './styles/player.css'

// Both are lazy so the dev-only contact sheet is code-split out of the
// production bundle rather than shipped to a child's tablet.
const App = lazy(() => import('./App'))
const CharacterSheet = lazy(() => import('./dev/CharacterSheet'))

const showSheet = new URLSearchParams(window.location.search).has('sheet')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      {showSheet ? <CharacterSheet /> : <App />}
    </Suspense>
  </React.StrictMode>,
)
