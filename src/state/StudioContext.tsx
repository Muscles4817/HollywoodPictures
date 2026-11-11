import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import type { GameAction, GameState } from './gameState';
import { studioReducer } from './studioReducer';
import { loadState, saveState } from './persistence';

interface StudioContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, undefined, loadState);

  // Hands the latest state to the save layer, which keeps it in memory and
  // writes it to the database behind the scenes - throttled, and only the
  // records that changed (state/persistence.ts, state/saveDatabase.ts).
  useEffect(() => {
    saveState(state);
  }, [state]);

  return <StudioContext.Provider value={{ state, dispatch }}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within a StudioProvider');
  return ctx;
}
