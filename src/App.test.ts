// QoL pass (docs/DESIGN.md): regression coverage for the background-tick
// pause bug - opening the Production screen to check on a backgrounded
// production froze its day count for as long as the player stayed there,
// because 'production' was unconditionally excluded from the background
// tick (it normally has its own dedicated tick, but not while merely
// *viewing* someone else's/a background shoot). computeTicking/
// isViewingBackgroundProduction are pure functions extracted specifically
// so this can be verified directly, without mounting the whole app and
// juggling fake timers.
import { describe, it, expect } from 'vitest';
import { computeTicking, isViewingBackgroundProduction } from './App';

describe('isViewingBackgroundProduction', () => {
  it('is true only on the production screen with a viewingProductionId set', () => {
    expect(isViewingBackgroundProduction('production', 'prod-1')).toBe(true);
  });

  it('is false on the production screen while running the live draft (no viewingProductionId)', () => {
    expect(isViewingBackgroundProduction('production', null)).toBe(false);
  });

  it('is false on any other screen, even with a stray viewingProductionId', () => {
    expect(isViewingBackgroundProduction('dashboard', 'prod-1')).toBe(false);
    expect(isViewingBackgroundProduction('post-production', 'prod-1')).toBe(false);
  });
});

describe('computeTicking - the background ADVANCE_DAY tick', () => {
  it('regression: keeps ticking while viewing a backgrounded production, even though "production" is normally a paused planning screen', () => {
    expect(computeTicking('production', 'prod-1', false, false)).toBe(true);
  });

  it('stays paused on the production screen while running the live draft - it has its own dedicated tick instead', () => {
    expect(computeTicking('production', null, false, false)).toBe(false);
  });

  it('stays paused on every other planning screen regardless of viewingProductionId', () => {
    for (const screen of ['develop', 'talent', 'production-planning', 'post-production', 'marketing'] as const) {
      expect(computeTicking(screen, null, false, false)).toBe(false);
      expect(computeTicking(screen, 'prod-1', false, false)).toBe(false);
    }
  });

  it('ticks on the dashboard and other non-planning screens', () => {
    expect(computeTicking('dashboard', null, false, false)).toBe(true);
    expect(computeTicking('results', null, false, false)).toBe(true);
  });

  it('a manual pause always wins, including while viewing a backgrounded production', () => {
    expect(computeTicking('production', 'prod-1', true, false)).toBe(false);
    expect(computeTicking('dashboard', null, true, false)).toBe(false);
  });

  it('the Inbox being open always wins, including while viewing a backgrounded production', () => {
    expect(computeTicking('production', 'prod-1', false, true)).toBe(false);
    expect(computeTicking('dashboard', null, false, true)).toBe(false);
  });
});
