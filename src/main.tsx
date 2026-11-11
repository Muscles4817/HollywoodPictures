import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { hydrateSave, importSave } from './state/persistence'
import type { GameState } from './state/gameState'

if (import.meta.env.DEV) {
  // Dev only: load a populated fixture dump (see CLAUDE.md) from the console -
  //   await hollywoodPictures.importSave(await (await fetch('/pop.json')).json())
  ;(window as unknown as { hollywoodPictures: unknown }).hollywoodPictures = {
    importSave: async (state: GameState) => {
      await importSave(state)
      window.location.reload()
    },
  }
}

// The save lives in IndexedDB, which is asynchronous; the app reads its state
// synchronously at mount. So the stored studio is loaded into memory first and
// the app renders once it is there (state/persistence.ts).
void hydrateSave().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
