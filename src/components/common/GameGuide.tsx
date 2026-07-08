import { Button } from './Button';

interface Section {
  title: string;
  paragraphs: string[];
}

// Plain-language explanations of how the simulation works, written for a
// player rather than a developer - deliberately not a rendering of
// docs/DESIGN.md, which is written for whoever's maintaining the code
// (raw formulas, file paths, historical postmortems) rather than someone
// trying to understand why their last film did what it did. Kept in sync
// with the same underlying mechanics by hand, not pulled automatically.
const SECTIONS: Section[] = [
  {
    title: 'The Loop',
    paragraphs: [
      'Each film goes through the same seven steps: pick a genre and buy a script, hire your director and cast, plan the production, shoot it, finish it in post, market and release it, then see the results. Your studio\'s cash and reputation carry over between films - everything else (cast pool aside) starts fresh each time.',
    ],
  },
  {
    title: 'Genre & Tone',
    paragraphs: [
      'Every script has a "tone profile" - six numbers (Action, Comedy, Romance, Suspense, Drama, Spectacle) describing what kind of story it actually is, not just its genre label. A script starts near its genre\'s typical vibe (Horror leans Suspense, Comedy leans Comedy, and so on) but usually picks up one or two extra flavors on top - so a batch of Action scripts will include some straightforward action, some action-comedies, some action-dramas. There\'s no separate "sub-genre" picker; it happens naturally in generation.',
      'This tone profile is what casting compatibility is actually measured against later, not the genre label itself.',
    ],
  },
  {
    title: 'Casting & Compatibility',
    paragraphs: [
      'Your Director has their own tone profile, the same six numbers as a script - a director strong in Suspense and Drama is a great match for a tense character piece, a poor one for a broad comedy. "Compatibility" on a director\'s card measures exactly that overlap, weighted toward whichever tones the script leans on hardest.',
      'Actors work differently: instead of a tone profile, they have five performance strengths - Character Transformation, Emotional Performance, Charisma, Comedy, Physical Performance. There\'s no single "acting skill" number. Someone brilliant at broad comedy might be a weak fit for a heavy drama, and that\'s deliberate - the best hire depends on the specific script, not on who has the highest stats.',
      'Reliability and Ego apply to everyone you hire: an unreliable, high-ego crew raises the odds of a costly incident once filming starts. Fame boosts audience appeal and - along with your studio\'s reputation and how much you spend on marketing - drives pre-release Buzz (more on that below).',
    ],
  },
  {
    title: 'Quality Score',
    paragraphs: [
      'Six departments blend into one Quality Score: Screenplay, Direction, Acting, Production, Post-Production, and On-Set Events. How much each one counts shifts by genre - a Drama leans hard on Screenplay and Acting and barely cares about Production; an Action film is closer to the reverse. The Results screen breaks this down department-by-department so you can see exactly what carried (or sank) a film, not just one final number.',
    ],
  },
  {
    title: 'Critic Score vs. Audience Score',
    paragraphs: [
      'These are two different opinions about the same film. Critic Score leans on craft - Quality Score, originality, direction, how you edited it, and a bonus if you released via the festival circuit. Audience Score leans on entertainment value - genre fit, star power, pacing, and production polish. A film can score very differently with each: an artful, difficult film might thrill critics and bore a mass audience, or vice versa.',
    ],
  },
  {
    title: 'Buzz & Opening Weekend',
    paragraphs: [
      'Buzz is pure pre-release hype - it has nothing to do with whether the film is actually any good, only with how much anticipation exists before anyone\'s seen it. It\'s built mainly from three things: how famous your director and leads are, how reputable your studio already is, and how much you spend on marketing. Only one of those three is something money can buy directly - fame and reputation have to be earned through who you cast and how your past films did.',
      'Buzz determines your Opening Weekend - and only the opening. A heavily-hyped film with a famous cast and a big marketing spend can open huge even if it turns out to be bad.',
    ],
  },
  {
    title: 'Reviews & "Legs"',
    paragraphs: [
      'Once people have actually seen the film, Critic and Audience Score take over - Audience Score matters more here. Together they determine the film\'s "legs": whether it keeps selling tickets for weeks (a beloved film) or dies almost immediately after opening (a hyped-but-disappointing one). Total Box Office is your Opening Weekend multiplied by that legs factor - so a small film with modest hype but great word of mouth can end up earning close to what a heavily-marketed disappointment does, just by a completely different route.',
      'Different release types change how much legs can stretch a film: a Wide release front-loads most of its money into the opening weekend by nature, while a Limited or Festival release earns comparatively little upfront but can expand for months if people love it.',
    ],
  },
  {
    title: "The Studio's Share",
    paragraphs: [
      'Total Box Office is the big headline number - the one that gets reported - but your studio doesn\'t keep all of it. Theaters and international distributors keep the majority, the same way they do in the real film industry. Profit is calculated from your actual cut of the gross (a bit under half), not the flashy total, so a film needs a genuinely strong box office run to be worth what it cost to make and market, not just a total bigger than its budget.',
    ],
  },
  {
    title: 'Outcome & Reputation',
    paragraphs: [
      'Your film\'s headline outcome - Flop, Cult Hit, Modest Success, Hit, Blockbuster, or Masterpiece - is based mainly on profit relative to total cost, with quality and critic bonuses unlocking the more prestigious labels regardless of profit (a beloved, critically adored film can be a "Masterpiece" even without blockbuster box office). Reputation shifts after every release based on that outcome and your critic reception, and a stronger reputation feeds directly into more Buzz on your next film - success compounds, but so does a string of flops.',
    ],
  },
];

export function GameGuide({ onBack }: { onBack: () => void }) {
  return (
    <div className="stack">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>How It Works</h1>
        <Button onClick={onBack}>Back to Dashboard</Button>
      </div>
      <p className="choice-description">
        A plain-language walkthrough of what's actually happening behind the numbers - not every last detail, just
        enough to understand why a film did what it did.
      </p>
      {SECTIONS.map((section) => (
        <div className="card stack" key={section.title}>
          <h2 style={{ margin: 0 }}>{section.title}</h2>
          {section.paragraphs.map((paragraph, i) => (
            <p key={i} style={{ margin: 0 }}>{paragraph}</p>
          ))}
        </div>
      ))}
      <div className="row-between">
        <span />
        <Button variant="primary" onClick={onBack}>Back to Dashboard</Button>
      </div>
    </div>
  );
}
