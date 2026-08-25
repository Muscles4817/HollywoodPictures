import { useEffect } from 'react';
import { useStudio } from '../../state/StudioContext';
import { deriveFocusedDraft } from '../../state/selectors';
import { describePitch, type PitchPosture } from '../../engine/directorPitch';
import { playerRelationshipWith } from '../../engine/relationships';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { formatMoney } from '../common/Money';
import type { DirectorPitch, Person } from '../../types';

const POSTURE_LABEL: Record<PitchPosture, string> = {
  faithful: 'Faithful take',
  balanced: 'Balanced take',
  bold: 'Bold take',
};

interface DirectorPitchPanelProps {
  /** The advertised fee for the round - the Director role's planned allocation, computed by the drawer. */
  advertisedFee: number;
}

/**
 * The director bake-off surface (Phase B2). Lives inside RoleHiringDrawer's
 * "Seek pitches" mode: open a round at the advertised fee, watch pitches land
 * over the next few weeks, then compare them and pick one (or pass). A pitch is
 * a creative bet the player chooses between - the cards read qualitatively
 * (take, approach, what they'll want control of), never as a score.
 */
export function DirectorPitchPanel({ advertisedFee }: DirectorPitchPanelProps) {
  const { state, dispatch } = useStudio();
  const draft = deriveFocusedDraft(state);
  // This panel being on screen IS the player reading whatever has landed, so
  // the Inbox's "the pitches are in" beat clears here - the same read-state
  // contract screen tests and casting applicants use, so a round that's been
  // looked at stops lighting the badge without being decided.
  const unreadPitches = (draft?.directorPitches?.submitted ?? []).some((pitch) => !pitch.acknowledged);
  useEffect(() => {
    if (unreadPitches) dispatch({ type: 'ACKNOWLEDGE_DIRECTOR_PITCHES' });
  }, [unreadPitches, dispatch]);
  if (!draft || !draft.script) return null;

  const process = draft.directorPitches;
  const directorPool = state.talentPool.Director;
  const directorById = (id: string): Person | undefined => directorPool.find((d) => d.id === id);

  if (!process) {
    return (
      <div className="stack">
        <Card>
          <p style={{ margin: 0 }}>
            Rather than approach a name, put the job out to <strong>pitches</strong>. Interested directors will
            develop a take on <em>{draft.title}</em> and present how they'd make it — you compare their visions and
            pick one, or pass. Working directors are keen to pitch; the biggest names expect to be offered.
          </p>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
            Advertised fee: <strong>{formatMoney(advertisedFee)}</strong> (the Director allocation from your Cast &amp; Crew budget).
            Pitches take a few weeks to come in.
          </p>
          <Button variant="primary" style={{ marginTop: 10 }} onClick={() => dispatch({ type: 'OPEN_DIRECTOR_PITCHES', advertisedFee })}>
            Invite pitches
          </Button>
        </Card>
      </div>
    );
  }

  const pendingCount = process.pending.length;
  const daysOut = pendingCount > 0 ? Math.max(1, Math.max(...process.pending.map((p) => p.dueDay)) - state.totalDays) : 0;

  return (
    <div className="stack">
      <div className="row-between">
        <span style={{ color: 'var(--text-muted)' }}>
          Bake-off open · advertised fee <strong>{formatMoney(process.advertisedFee)}</strong>
        </span>
        <Button variant="secondary" className="btn-sm" onClick={() => dispatch({ type: 'PASS_ON_PITCHES' })}>
          Pass on all
        </Button>
      </div>

      {pendingCount > 0 && (
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          {pendingCount} director{pendingCount === 1 ? '' : 's'} still preparing a pitch — the last should land within about {daysOut} day{daysOut === 1 ? '' : 's'}. Keep time running to receive them.
        </p>
      )}

      {process.submitted.length === 0 && pendingCount === 0 && (
        <Card>
          <p style={{ margin: 0 }}>
            No directors are interested in pitching at this fee. Pass and raise the Director allocation, or switch to approaching a name directly.
          </p>
        </Card>
      )}

      {process.submitted.length > 0 && (
        <div className="grid grid-wide">
          {process.submitted.map((pitch) => {
            const director = directorById(pitch.directorId);
            if (!director) return null;
            return (
              <PitchCard
                key={pitch.directorId}
                pitch={pitch}
                director={director}
                relationshipCollaborations={state.collaborations ?? []}
                onChoose={() => dispatch({ type: 'SELECT_DIRECTOR_PITCH', directorId: pitch.directorId })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface PitchCardProps {
  pitch: DirectorPitch;
  director: Person;
  relationshipCollaborations: Parameters<typeof playerRelationshipWith>[0];
  onChoose: () => void;
}

function PitchCard({ pitch, director, relationshipCollaborations, onChoose }: PitchCardProps) {
  const read = describePitch(pitch, director, playerRelationshipWith(relationshipCollaborations, director));
  return (
    <Card>
      <div className="row-between">
        <div className="card-title">{director.identity.name}</div>
        <span className="badge">{POSTURE_LABEL[read.posture]}</span>
      </div>
      <p style={{ margin: '6px 0 0' }}>{read.take}</p>
      <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{read.approach}</p>
      {read.demands.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {read.demands.map((line, i) => (
            <li key={i} style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>{line}</li>
          ))}
        </ul>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.85em' }}>{read.postureSummary}</p>
      <Button variant="primary" className="btn-sm" style={{ marginTop: 10 }} onClick={onChoose}>
        Choose {director.identity.name}
      </Button>
    </Card>
  );
}
