import { Button } from './Button';
import './GameGuide.css';

interface FaqItem {
  q: string;
  a: string[];
}

interface FaqCategory {
  id: string;
  title: string;
  items: FaqItem[];
}

// A plain-language FAQ for players (not a rendering of docs/DESIGN.md, which
// is for maintainers). Written to answer the questions a confused player
// actually asks - "what is Buzz?", "why didn't my hit make money?", "what do
// Producers do?" - in simple terms. Kept in sync with the mechanics by hand.
const FAQ: FaqCategory[] = [
  {
    id: 'basics',
    title: 'Getting started',
    items: [
      {
        q: 'What am I actually trying to do?',
        a: [
          "You run a film studio. You make films one at a time; each one earns or loses money and nudges your studio's reputation. There's no single win condition - the goal is to grow your cash and reputation over a career, however you choose to.",
        ],
      },
      {
        q: 'How does making a film work, step by step?',
        a: [
          'Acquire a script from the Opportunity Market, then open it as a project. Inside the project you hire a director, cast and crew, plan the production, then shoot it, finish it in post, and market and release it - after which you see the results. Before you greenlight, you can jump freely between the project sections (Overview, Cast & Crew, Production, Producers, Finance).',
        ],
      },
      {
        q: 'What carries over between films?',
        a: [
          "Your studio's cash, Brand Recognition, Prestige, any Producers you've hired, and the world's shared talent roster all persist. Each individual film's choices start fresh.",
        ],
      },
    ],
  },
  {
    id: 'scripts',
    title: 'Scripts, Assets & the Opportunity Market',
    items: [
      {
        q: 'Where do scripts come from?',
        a: [
          'The Opportunity Market - a rotating list of scripts and IP you can acquire. When you acquire one you pay its cost once, and it becomes an Asset you own forever. You start a project from an owned Asset, never from nothing.',
        ],
      },
      {
        q: 'What is bidding, and why can’t I just buy some scripts?',
        a: [
          'Some opportunities are contested - you and rival studios place bids that are resolved once a week. The highest bid wins and only the winner pays. Uncontested opportunities you can simply buy outright.',
        ],
      },
      {
        q: 'What’s the Asset Library?',
        a: [
          "Everything you own but haven't made yet. Acquired scripts wait there until you start a project from one.",
        ],
      },
    ],
  },
  {
    id: 'casting',
    title: 'Casting & crew',
    items: [
      {
        q: 'How do I pick the right director or actor?',
        a: [
          "Match them to the script's tone, not just its genre label. A director has a six-axis tone profile (Action, Comedy, Romance, Suspense, Drama, Spectacle); the “Compatibility” figure measures how well it overlaps this specific script. Actors instead have five performance strengths - Character Transformation, Emotional Performance, Charisma, Comedy, Physical Performance - so the best actor depends entirely on the role, not on who has the highest numbers.",
        ],
      },
      {
        q: 'What do Reliability, Ego and Fame do?',
        a: [
          'An unreliable, high-ego cast and crew raise the odds of a costly incident once filming starts. Fame boosts audience appeal and helps drive pre-release Buzz.',
        ],
      },
      {
        q: 'What’s a casting call?',
        a: [
          "Rather than instantly browsing every actor, you can open a casting call for a role and applicants arrive over time. You can also directly approach a specific person - who may accept or decline, depending on the part, the pay, and your studio's standing.",
        ],
      },
    ],
  },
  {
    id: 'production',
    title: 'Making the film',
    items: [
      {
        q: 'What’s the production plan and the contingency reserve?',
        a: [
          'Sliders for set quality, practical effects, VFX, and runtime, plus a contingency reserve. Contingency is spent as a daily burn while you shoot - wrapping early spends less, running long spends more - and it also cushions on-set risk.',
        ],
      },
      {
        q: 'What are on-set events?',
        a: [
          'Random incidents during shooting that can nudge cost, quality, or schedule. A skilled, reliable crew (and a Fixer producer - see below) weathers them better.',
        ],
      },
      {
        q: 'What happens in post-production?',
        a: [
          'After shooting you pick an edit style and music focus, and can run a test screening to catch problems before release (for a cost). These feed your final quality and critic reception.',
        ],
      },
    ],
  },
  {
    id: 'producers',
    title: 'The Production Office & Producers',
    items: [
      {
        q: 'What is the Production Office?',
        a: [
          "A studio facility you unlock once you've released 3 films or reached Brand Recognition 40. It gives you a bench of Producers - specialists you hire and keep on staff between films.",
        ],
      },
      {
        q: 'What do Producers actually do?',
        a: [
          "You attach hired Producers to a film from that film's Producers tab, and each one gives a real boost. There are four kinds: a Line Producer trims production spend, a Creative Producer lifts post-production quality, an Executive Producer boosts marketing buzz, and a Fixer softens on-set disasters. The stronger the producer's skill, the bigger the effect.",
        ],
      },
      {
        q: 'How much do Producers cost?',
        a: [
          'Two fees: a one-time hiring fee when you sign a producer to your bench, and a per-film fee each time you attach one to a film. The per-film fee is charged at release, alongside marketing. Upgrading the office to a higher tier costs cash and gives you more bench slots.',
        ],
      },
      {
        q: 'What does the ♦ genre affinity mean, and should I stack producers?',
        a: [
          'Each producer favours one or two genres. Attach one to a film in a favoured genre and its boost is amplified (shown with a ♦); off-genre it still helps, just less - never a penalty. You can stack several producers on one film, but two of the same type give diminishing returns, so a varied bench of specialists beats hoarding duplicates.',
        ],
      },
    ],
  },
  {
    id: 'release',
    title: 'Marketing & release',
    items: [
      {
        q: 'What is Buzz?',
        a: [
          "Pure pre-release hype - it has nothing to do with whether the film is any good, only how much anticipation exists before anyone's seen it. It's built from how famous your director and leads are, how well known your studio is (Brand Recognition), and how much you spend on marketing.",
          'Buzz sets your Opening Weekend - and only the opening. A heavily hyped film with a famous cast can open huge even if it turns out to be bad.',
        ],
      },
      {
        q: 'What do release types and windows change?',
        a: [
          'A Wide release front-loads most of its money into the opening weekend; a Limited or Festival release earns less upfront but can expand for months if people love it. The release window you pick - and how crowded that slot is with rival films - affects your turnout.',
        ],
      },
    ],
  },
  {
    id: 'results',
    title: 'Results & money',
    items: [
      {
        q: 'What’s the Quality Score?',
        a: [
          'A blend of six departments - Screenplay, Direction, Acting, Production, Post-Production, and On-Set Events - weighted by genre (a Drama leans on Screenplay and Acting; an Action film leans on Production). The Results screen breaks it down so you can see what carried or sank a film.',
        ],
      },
      {
        q: 'Why do Critic Score and Audience Score differ?',
        a: [
          'They’re two opinions of the same film. Critics reward craft (quality, originality, direction, editing); audiences reward entertainment (genre fit, star power, pacing, polish). An artful, difficult film might thrill critics and bore a mass audience, or the reverse.',
        ],
      },
      {
        q: 'What are “legs”?',
        a: [
          'How long a film keeps selling tickets after opening, driven mostly by Audience Score. Total Box Office is roughly your Opening Weekend multiplied by that legs factor - so strong word of mouth can rescue a modest opening, and a hyped disappointment can collapse after week one.',
        ],
      },
      {
        q: 'My film had a huge box office but barely any profit - why?',
        a: [
          'You only keep a cut of the gross; theatres and distributors take the majority, exactly like the real industry. Profit is your share minus every cost, so the flashy headline total is always bigger than what you actually bank - a film needs a genuinely strong run to be worth what it cost.',
        ],
      },
    ],
  },
  {
    id: 'studio',
    title: 'Your studio over time',
    items: [
      {
        q: 'What’s the difference between Brand and Prestige?',
        a: [
          'Brand Recognition is how commercially bankable you are with general audiences - it moves with profit relative to cost and feeds back into Buzz on your next film, so commercial success compounds. Prestige is how respected you are by critics - it moves with critical reception alone, independent of money. A beloved flop builds Prestige; a profitable but panned film builds Brand. They’re free to diverge, and neither is strictly better.',
        ],
      },
      {
        q: 'What do the Outcome labels mean?',
        a: [
          'Flop, Cult Hit, Modest Success, Hit, Blockbuster, or Masterpiece - based mainly on profit relative to total cost, with quality and critic bonuses unlocking the top labels even without blockbuster box office (a beloved, critically adored film can be a Masterpiece without making a fortune).',
        ],
      },
      {
        q: 'What are Rival Studios?',
        a: [
          'AI competitors that make their own films, bid against you for scripts, and book talent you might have wanted. Their releases share the calendar with yours, so a crowded slot means stiffer competition for opening-weekend attention.',
        ],
      },
    ],
  },
];

export function GameGuide({ onBack }: { onBack: () => void }) {
  return (
    <div className="stack game-guide">
      <div className="row-between">
        <h1 style={{ margin: 0 }}>How It Works</h1>
        <Button onClick={onBack}>Back to Dashboard</Button>
      </div>
      <p className="choice-description">
        A plain-language FAQ - what everything means and why your films do what they do. Pick a topic, or scroll
        through and open any question.
      </p>

      <nav className="faq-chips" aria-label="Jump to a topic">
        {FAQ.map((category) => (
          <a key={category.id} className="faq-chip" href={`#faq-${category.id}`}>
            {category.title}
          </a>
        ))}
      </nav>

      {FAQ.map((category) => (
        <section id={`faq-${category.id}`} className="card stack faq-category" key={category.id}>
          <h2 style={{ margin: 0 }}>{category.title}</h2>
          {category.items.map((item) => (
            <details className="faq-item" key={item.q}>
              <summary>{item.q}</summary>
              {item.a.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </details>
          ))}
        </section>
      ))}

      <div className="row-between">
        <span />
        <Button variant="primary" onClick={onBack}>Back to Dashboard</Button>
      </div>
    </div>
  );
}
