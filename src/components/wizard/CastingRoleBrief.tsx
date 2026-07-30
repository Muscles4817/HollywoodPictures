import { roleDemandProfile, describeCharacterDemands } from '../../engine/scriptPresentation';
import { castingAgeBandLabel } from '../../engine/casting';
import { qualitativeMagnitude } from '../../engine/talentCardPresentation';
import { CHARACTER_ARCHETYPE_LABELS } from '../../data/scriptTagLabels';
import { CHARACTER_ARCHETYPE_PROFILES } from '../../data/characterArchetypes';
import type { CharacterAgeBand, CastingGender, ScriptCharacter } from '../../types';

// The "who am I casting for" side of the casting drawer - the role's own brief,
// pinned on the left so what the part actually needs stays in view while you
// scan candidates on the right (desktop two-pane; it collapses to a stacked
// card on narrow screens - see .casting-layout / .casting-brief in index.css).
// Everything here is derived from the ScriptCharacter; nothing is stored.

const AGE_ADJECTIVE: Record<Exclude<CharacterAgeBand, 'Any'>, string> = {
  Child: 'child',
  Teen: 'teenage',
  YoungAdult: 'young-adult',
  Adult: 'adult',
  MiddleAged: 'middle-aged',
  Senior: 'senior',
};
const GENDER_NOUN: Record<Exclude<CastingGender, 'Any'>, string> = { Male: 'man', Female: 'woman' };

/** "Written for a young-adult woman." - the role's cast requirements as a single grammatical line, or an open-casting note when neither is constrained. */
function describeWrittenFor(character: ScriptCharacter): string {
  const ageBand = character.castingAgeBand;
  const gender = character.castingGender;
  const ageWord = ageBand && ageBand !== 'Any' ? AGE_ADJECTIVE[ageBand] : null;
  const genderNoun = gender && gender !== 'Any' ? GENDER_NOUN[gender] : null;
  if (!ageWord && !genderNoun) return 'Open casting — written for any age or gender.';
  const phrase = [ageWord, genderNoun ?? 'lead'].filter(Boolean).join(' ');
  const article = /^[aeiou]/i.test(phrase) ? 'an' : 'a';
  return `Written for ${article} ${phrase}.`;
}

export function CastingRoleBrief({ character }: { character: ScriptCharacter }) {
  const demands = roleDemandProfile(character);
  const archetypeDescription = CHARACTER_ARCHETYPE_PROFILES[character.archetype]?.description;
  const ageBandLabel = character.castingAgeBand && character.castingAgeBand !== 'Any' ? castingAgeBandLabel(character.castingAgeBand) : null;

  return (
    <aside className="casting-brief">
      <div className="card stack casting-brief__card">
        <span className="casting-brief__eyebrow">The role</span>
        <div className="card-title">{character.name}</div>
        <p className="casting-brief__meta">
          {character.prominence} &middot; {CHARACTER_ARCHETYPE_LABELS[character.archetype]}
        </p>
        {archetypeDescription && <p className="casting-brief__desc">{archetypeDescription}</p>}
        <p className="casting-brief__writtenfor">
          {describeWrittenFor(character)}
          {ageBandLabel && <span className="casting-brief__agehint"> An actor a little outside the band is a castable stretch.</span>}
        </p>

        <div className="casting-brief__demands">
          <div className="casting-brief__heading">What the part needs</div>
          {demands.map((d) => (
            <div key={d.label} className="talent-bar-row">
              <span className="talent-bar-label">{d.label}</span>
              <span className="talent-bar-track">
                <span className="talent-bar-fill" style={{ width: `${Math.max(0, Math.min(100, d.value))}%` }} />
              </span>
              <span className="talent-bar-value">{qualitativeMagnitude(d.value)}</span>
            </div>
          ))}
          <p className="casting-brief__note">{describeCharacterDemands(character)} Match a candidate's revealed strengths against these.</p>
        </div>
      </div>
    </aside>
  );
}
