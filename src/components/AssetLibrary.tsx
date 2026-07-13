import { useStudio } from '../state/StudioContext';
import { formatGameDate } from '../engine/calendar';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { ScriptDetails } from './common/ScriptDetails';
import { deriveAssetStatus } from '../engine/project';

/**
 * Every owned Asset (development-pipeline doc) - acquired from the
 * Opportunity Market and permanently the studio's, whether or not it's ever
 * become a Project. Status is derived purely from GameState.projects
 * (engine/project.ts:deriveAssetStatus), never stored on the Asset itself -
 * "derive, don't duplicate," same discipline the rest of this codebase
 * already uses.
 */
export function AssetLibrary() {
  const { state, dispatch } = useStudio();
  const assets = [...state.studio.assets].sort((a, b) => b.acquiredOnDay - a.acquiredOnDay);
  const somethingElseFocused = state.focusedProjectId !== null;

  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>Asset Library</h1>
        <Button onClick={() => dispatch({ type: 'RETURN_TO_DASHBOARD' })}>Home</Button>
      </div>
      <p className="choice-description" style={{ margin: 0 }}>
        Everything you've acquired from the Opportunity Market. An Asset can sit here indefinitely with no active
        Project - start developing it whenever you're ready, and if a Project against it is ever abandoned before
        Greenlight, the Asset comes right back here, unaffected.
      </p>

      {assets.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Nothing owned yet - acquire something from the Opportunity Market first.</p>
        </div>
      ) : (
        <div className="grid grid-wide">
          {assets.map((asset) => {
            const status = deriveAssetStatus(asset, state.projects);
            return (
              <Card key={asset.id}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <span className="badge">{asset.source}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    Owned since {formatGameDate(asset.acquiredOnDay)}
                  </span>
                </div>
                <div className="card-title">{asset.script.title}</div>
                <ScriptDetails script={asset.script} />

                {status.status === 'available' && <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>No active Project</p>}
                {status.status === 'in-development' && <p style={{ color: 'var(--green)', marginTop: 6 }}>Being developed</p>}
                {status.status === 'used' && (
                  <p style={{ color: 'var(--text-muted)', marginTop: 6 }}>
                    Previously used - {status.projectIds.length} film{status.projectIds.length === 1 ? '' : 's'} released
                  </p>
                )}

                {status.status === 'in-development' ? (
                  <Button
                    variant="primary"
                    style={{ marginTop: 8, width: '100%' }}
                    disabled={somethingElseFocused}
                    onClick={() => dispatch({ type: 'RESUME_PROJECT', projectId: status.projectId })}
                  >
                    Open Project
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    style={{ marginTop: 8, width: '100%' }}
                    onClick={() => dispatch({ type: 'CREATE_PROJECT_FROM_ASSET', assetId: asset.id })}
                  >
                    Start Developing
                  </Button>
                )}
                {status.status === 'in-development' && somethingElseFocused && (
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                    Finish or leave what you're currently working on before opening this one.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
