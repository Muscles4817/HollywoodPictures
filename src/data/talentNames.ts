// First/last name word banks for procedurally generated talent. Flavor only -
// no gameplay effect.
//
// WHY THESE ARE GROUPED BY ORIGIN
// -------------------------------
// These used to be two flat lists, drawn independently:
//
//     `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
//
// which is combinatorially generous and culturally incoherent. Measured across
// the old banks, roughly 80% of generated names paired a first name and a
// surname from unrelated origins, producing people called "Priyanka Flanagan",
// "Duke Suzuki", "Karim Chen" and "Yuki Okonkwo". Those do not read as foreign -
// they read as GENERATED, which is the immersion break. Real names correlate:
// first name and surname usually share an origin, and the exceptions read as
// exceptions precisely because the rule holds.
//
// So a name is now drawn as a coherent PAIR from one origin bank, with the
// origin itself chosen by weight (see NAME_ORIGIN_WEIGHTS_BY_ROLE below). That
// keeps - and is meant to keep - the international spread the flat banks were
// reaching for, because the real film industry genuinely has one: the
// handcrafted roster's own cinematographers and composers (Hoyte van Hoytema,
// Emmanuel Lubezki, Linus Sandgren, Ludwig Göransson, Hildur Guðnadóttir,
// Ramin Djawadi) are unfamiliar-sounding and completely authentic, because each
// name is internally coherent. The fix is coherence, not anglicisation.
//
// Every first-name bank is deliberately UNISEX, exactly as the single flat pool
// was: gender is drawn independently of the name
// (engine/talentGenerator.ts:generateGender) and no name here is meant to imply
// one.
import type { TalentProfession } from '../types';

/**
 * How a generated name READS - a naming tradition, not a claim about anybody's
 * heritage or nationality. Split finely enough that mixing within a group still
 * reads right: 'japanese'/'chinese'/'korean' are separate because "Yuki Chen" is
 * as incoherent as anything the flat banks produced.
 */
export type NameOrigin =
  | 'anglo-american'
  | 'british-irish'
  | 'french'
  | 'germanic'
  | 'nordic'
  | 'italian'
  | 'hispanic'
  | 'slavic'
  | 'japanese'
  | 'chinese'
  | 'korean'
  | 'south-asian'
  | 'west-african'
  | 'middle-eastern';

export interface NameBank {
  /** Unisex by design - see the file header. Pooled across the whole origin family. */
  first: string[];
  /**
   * Surnames keyed by the nationality they READ as, so a generated person's
   * nationality is their own surname's rather than a second independent draw
   * from the family - which reproduced the exact bug this file exists to fix,
   * one level down ("Ivo Wojcik, Russian"; "Elina Persson, Finnish"). First
   * names stay pooled across the family: a Pole called Ivo or a Swede called
   * Elina reads fine, where the surname mismatch did not.
   */
  last: Record<string, string[]>;
}

export const NAME_BANKS: Record<NameOrigin, NameBank> = {
  'anglo-american': {
    first: [
      'Marcus', 'Grace', 'Cole', 'Harriet', 'Duke', 'Ivy', 'Reggie', 'Nova', 'Otis', 'Willa',
      'Marla', 'Theo', 'Clara', 'Ezra', 'Josephine', 'Cora', 'Devon', 'Naomi', 'Julian', 'Delia',
      'Wes', 'Hattie', 'Brandon', 'Marnie', 'Curtis', 'Ruby', 'Wyatt', 'Eleanor', 'Grady', 'June',
      'Miles', 'Sadie', 'Preston', 'Lena', 'Dashiell', 'Maude', 'Vernon', 'Etta', 'Roscoe', 'Peyton',
      'Kendrick', 'Simone', 'Elias', 'Tamsin', 'Hollis', 'Georgia', 'Beau', 'Adele', 'Sterling', 'Winnie',
      'Jonah', 'Rae', 'Chet', 'Sylvie', 'Bo',
    ],
    last: {
      'American': ['Bright', 'Frost', 'Bennett', 'Pierce', 'Marsh', 'Stone', 'Blackwood', 'Whitfield', 'Hendricks', 'Barrett', 'Holt', 'Yates', 'Farr', 'Reeves', 'Wren', 'Ashe', 'Miles', 'Grant', 'Frank', 'Vance', 'Prescott', 'Whitaker', 'Marlowe', 'Ashford', 'Lockhart', 'Radford', 'Sterling', 'Winslow', 'Braddock', 'Hargrove', 'Merritt', 'Thorne', 'Crane', 'Everly', 'Fairbanks', 'Hale', 'Langford', 'Mercer', 'Norwood', 'Salter'],
      'Canadian': ['Beaumont', 'Sheridan', 'Calder', 'Dunmore', 'Garrick', 'Ives', 'Rowan'],
      'Australian': ['Hollis', 'Rourke', 'Ridley', 'Ellery', 'Kingsley', 'Ainsley', 'Pemberton', 'Talbot'],
    },
  },
  'british-irish': {
    first: [
      'Callum', 'Fiona', 'Ronan', 'Freya', 'Benji', 'Esme', 'Neve', 'Freddie', 'Saoirse', 'Tegan',
      'Niamh', 'Rory', 'Bronwen', 'Alfie', 'Maeve', 'Gethin', 'Orla', 'Duncan', 'Imogen', 'Fergus',
      'Sian', 'Lachlan', 'Cerys', 'Eamon', 'Rhiannon', 'Angus', 'Bridie', 'Torin', 'Nula', 'Padraig',
      'Elspeth', 'Gareth', 'Ffion', 'Declan', 'Isla', 'Cormac', 'Morwenna', 'Struan', 'Aoife', 'Bryn',
    ],
    last: {
      'British': ['Pritchard', 'Ferguson', 'Hargreaves', 'Whitlock', 'Attwood', 'Fairweather', 'Ogilvy', 'Trevelyan', 'Ellingham', 'Lloyd-Jones', 'Hart-Davies'],
      'Irish': ['Doyle', 'Sullivan', 'Kelly', 'Walsh', 'Byrne', 'Donovan', 'Flanagan', 'Callahan', 'Quinn', 'Gallagher', 'Brennan', 'Kavanagh', 'Fitzgerald', 'Hennessy', 'Rafferty', 'Boyle', 'Nolan', 'Cassidy', 'Farrell', 'Mulligan', 'Kerrigan', 'Lonergan', 'Devlin', 'Halloran', 'Sheehan', 'Corrigan', 'Maguire', 'Duggan', "O'Donnell", "O'Hara"],
      'Scottish': ['Sinclair', 'Macleod', 'Cameron', 'McAllister', 'MacGowan'],
      'Welsh': ['Llewellyn'],
    },
  },
  french: {
    first: [
      'Camille', 'Elodie', 'Hugo', 'Colette', 'Anouk', 'Mathieu', 'Solene', 'Gaspard', 'Margaux', 'Thibault',
      'Amelie', 'Laurent', 'Ninon', 'Bastien', 'Coralie', 'Emile', 'Sidonie', 'Aurelien', 'Margot', 'Remi',
      'Clemence', 'Olivier',
    ],
    last: {
      'French': ['Moreau', 'Dubois', 'Fontaine', 'Laurent', 'Delacroix', 'Bonnet', 'Marchand', 'Lefevre', 'Chevalier', 'Girard', 'Renaud', 'Boucher', 'Vallois', 'Rousseau', 'Beauchamp', 'Duval', 'Lambert', 'Mercier', 'Sarrazin', 'Béranger', 'Célestin', 'Léger'],
      'Belgian': ['Thibault', 'Sarrazin'],
      'Canadian': ['Pelletier', 'Cormier', 'Vaillancourt'],
    },
  },
  germanic: {
    first: [
      'Felix', 'Greta', 'Lotte', 'Emil', 'Anouk', 'Jonas', 'Katrin', 'Lukas', 'Annika', 'Stefan',
      'Marlene', 'Bastian', 'Heike', 'Rutger', 'Sanne', 'Wouter', 'Femke', 'Kasper', 'Ilse', 'Matthias',
      'Antje', 'Joost', 'Neele', 'Tobias',
    ],
    last: {
      'German': ['Fischer', 'Schmidt', 'Bauer', 'Haas', 'Kruger', 'Hoffman', 'Weiss', 'Engel', 'Reinhardt', 'Steiner', 'Wagner', 'Falk', 'Brandt', 'Keller', 'Vogel', 'Bergmann', 'Neumann', 'Kaufmann', 'Müller', 'Schröder', 'Löwe'],
      'Austrian': ['von Bracht', 'Steiner', 'Gruber', 'Moser'],
      'Dutch': ['van Dijk', 'de Vries', 'Bakker', 'Visser', 'Hendriks', 'van Leeuwen', 'de Groot'],
    },
  },
  nordic: {
    first: [
      'Ingrid', 'Soren', 'Bjorn', 'Astrid', 'Lars', 'Liv', 'Anders', 'Kirsi', 'Oskar', 'Elina',
      'Nils', 'Signe', 'Mikael', 'Tove', 'Rasmus', 'Solveig', 'Henrik', 'Maren', 'Kasper', 'Ylva',
      'Eero', 'Runa',
    ],
    last: {
      'Swedish': ['Lindqvist', 'Lindgren', 'Andersson', 'Persson', 'Bergstrom', 'Lindberg', 'Sandberg', 'Ahlgren', 'Bergström', 'Söderlund', 'Lindström', 'Eriksson', 'Nilsson'],
      'Danish': ['Larsen', 'Petersen', 'Jensen', 'Sorensen', 'Ostergaard', 'Dahl'],
      'Norwegian': ['Haugen', 'Lund', 'Dahl', 'Bakken', 'Solberg'],
      'Finnish': ['Lindholm', 'Virtanen', 'Nyholm', 'Hakkarainen', 'Häkkinen', 'Koskinen'],
    },
  },
  italian: {
    first: [
      'Enzo', 'Chiara', 'Matteo', 'Lucia', 'Dario', 'Renata', 'Lorenzo', 'Simone', 'Rocco', 'Marta',
      'Bruno', 'Alessia', 'Nicolo', 'Fiorella', 'Gian', 'Elisa', 'Sandro', 'Ornella', 'Paolo', 'Vittoria',
      'Cesare', 'Nella',
    ],
    last: {
      'Italian': ['Rossi', 'Marino', 'Romano', 'Esposito', 'Moretti', 'Conti', 'Bianchi', 'Fabbri', 'Gallo', 'Marchetti', 'Bruni', 'Castellano', 'Ricci', 'Ferrari', 'Greco', 'Lombardi', 'Barbieri', 'Sartori', 'Vitale', 'Pagano', 'Rizzo', 'Colombo'],
    },
  },
  hispanic: {
    first: [
      'Mateo', 'Rosa', 'Diego', 'Beatriz', 'Rafael', 'Marisol', 'Santiago', 'Paloma', 'Javier', 'Lucia',
      'Thiago', 'Renata', 'Pablo', 'Elena', 'Gael', 'Salma', 'Nestor', 'Inmaculada', 'Alejandro', 'Ximena',
      'Joaquin', 'Pilar', 'Emilio', 'Dolores', 'Rodrigo', 'Consuelo', 'Nicolas', 'Valentina', 'Andres', 'Mercedes',
    ],
    last: {
      'Spanish': ['Delgado', 'Vargas', 'Alvarez', 'Ortega', 'Serrano', 'Herrera', 'Guzman', 'Bautista', 'Nunez'],
      'Mexican': ['Rivera', 'Solano', 'Reyes', 'Salazar', 'Castillo', 'Vasquez', 'Mendez', 'Vega', 'Cisneros', 'Cardenas', 'Escobar', 'Villalobos'],
      'Argentine': ['Quintero', 'Ramos', 'Peralta', 'Arroyo'],
      'Colombian': ['Montoya', 'Duarte'],
      'Brazilian': ['Costa', 'Silva', 'Ferreira'],
    },
  },
  slavic: {
    first: [
      'Nikolai', 'Anya', 'Dmitri', 'Petra', 'Viktor', 'Vera', 'Nikita', 'Zoya', 'Ivo', 'Milena',
      'Tomasz', 'Katarzyna', 'Jakub', 'Zofia', 'Andrej', 'Dragana', 'Bojan', 'Ludmila', 'Kazimierz', 'Ivana',
      'Marek', 'Radmila', 'Stanislav', 'Danica',
    ],
    last: {
      'Polish': ['Kowalski', 'Kaminski', 'Zielinski', 'Wojcik', 'Baranowski', 'Kamiński', 'Wójcik', 'Brzeziński'],
      'Russian': ['Petrov', 'Ivanov', 'Sokolov', 'Volkov', 'Popov', 'Lazarev', 'Orlov'],
      'Czech': ['Novak', 'Dvorak', 'Havel', 'Marek'],
      'Serbian': ['Kovac', 'Radic', 'Jovanovic', 'Tomic', 'Stankovic', 'Nedelko'],
      'Hungarian': ['Varga', 'Szabo', 'Jancsó'],
    },
  },
  japanese: {
    first: [
      'Yuki', 'Kenji', 'Hana', 'Aki', 'Sora', 'Haruto', 'Rina', 'Daichi', 'Nao', 'Shun',
      'Mio', 'Takumi', 'Sakura', 'Ren', 'Ayumi', 'Hiroshi', 'Keiko', 'Satoshi',
    ],
    last: {
      'Japanese': ['Tanaka', 'Sato', 'Yamamoto', 'Nakamura', 'Watanabe', 'Suzuki', 'Takahashi', 'Ueda', 'Kobayashi', 'Fujimoto', 'Ishikawa', 'Morita', 'Hasegawa', 'Okada', 'Shimizu', 'Kuroda', 'Nishimura', 'Arai'],
    },
  },
  chinese: {
    first: [
      'Wei', 'Mei', 'Jun', 'Lian', 'Hao', 'Xiu', 'Feng', 'Ling', 'Bo', 'Yan',
      'Chen', 'Ping', 'Jian', 'Hua', 'Qiang', 'Shan', 'Tao', 'Yun',
    ],
    last: {
      'Chinese': ['Chen', 'Xu', 'Zhao', 'Wang', 'Li', 'Zhang', 'Liu', 'Huang', 'Wu', 'Zhou', 'Lin', 'Sun', 'Guo', 'He', 'Gao', 'Tang', 'Feng', 'Song'],
    },
  },
  korean: {
    first: [
      'Jae', 'Soo-ah', 'Min-jun', 'Hyun', 'Ji-woo', 'Seo-yeon', 'Dong-hyun', 'Eun', 'Tae', 'Yoon-seo',
      'Sang', 'Ha-eun', 'Joon', 'Na-rae',
    ],
    last: {
      'South Korean': ['Kim', 'Park', 'Yoon', 'Choi', 'Jung', 'Kang', 'Cho', 'Shin', 'Han', 'Oh', 'Seo', 'Lim', 'Bae', 'Song'],
    },
  },
  'south-asian': {
    first: [
      'Priya', 'Rohan', 'Arjun', 'Indira', 'Ravi', 'Sanjay', 'Priyanka', 'Ishaan', 'Roshan', 'Meera',
      'Aditya', 'Kavita', 'Vikram', 'Ananya', 'Nikhil', 'Shalini', 'Rajiv', 'Devika', 'Karthik', 'Lakshmi',
      'Imran', 'Nadia', 'Farhan', 'Ayesha', 'Zahid', 'Sunita',
    ],
    last: {
      'Indian': ['Anand', 'Kaur', 'Sharma', 'Nair', 'Ghosh', 'Prasad', 'Thakkar', 'Iyer', 'Banerjee', 'Chatterjee', 'Desai', 'Kapoor', 'Menon', 'Reddy', 'Sengupta', 'Bhatt', 'Malhotra', 'Pillai', 'Verma'],
      'Pakistani': ['Qureshi', 'Rehman', 'Khan', 'Siddiqui'],
      'Bangladeshi': ['Choudhury', 'Rahman'],
      'Sri Lankan': ['Fernandes'],
    },
  },
  'west-african': {
    first: [
      'Amara', 'Kwame', 'Emeka', 'Ayana', 'Imani', 'Kojo', 'Onyeka', 'Chidi', 'Nkechi', 'Kofi',
      'Adaeze', 'Yaw', 'Folake', 'Obi', 'Abena', 'Tunde', 'Ifeoma', 'Kwabena', 'Ngozi', 'Sekou',
      'Amara', 'Zuri',
    ],
    last: {
      'Nigerian': ['Okafor', 'Abara', 'Okonkwo', 'Adeyemi', 'Adebayo', 'Achebe', 'Obi', 'Amadi', 'Nwosu', 'Eze', 'Bello', 'Oyelaran'],
      'Ghanaian': ['Osei', 'Mensah', 'Owusu', 'Boateng', 'Asante', 'Agyeman', 'Danquah'],
      'Senegalese': ['Keita', 'Diallo', 'Toure'],
    },
  },
  'middle-eastern': {
    first: [
      'Hassan', 'Aisha', 'Omar', 'Amina', 'Tariq', 'Yasmin', 'Leila', 'Zainab', 'Amir', 'Fatima',
      'Rashid', 'Yusuf', 'Rania', 'Karim', 'Bilal', 'Darius', 'Hamza', 'Noor', 'Selin', 'Cyrus',
      'Nadia', 'Farid',
    ],
    last: {
      'Turkish': ['Aslan', 'Ceylan', 'Ozturk', 'Kaya', 'Demir', 'Yilmaz'],
      'Lebanese': ['Haddad', 'Dagher', 'Khalil', 'Mansour', 'Sabbagh'],
      'Egyptian': ['Mahmoud', 'Ismail', 'Nasser', 'Saleh'],
      'Iranian': ['Ahmadi', 'Nazari', 'Rahimi', 'Karimi', 'Ansari'],
    },
  },
};

/**
 * How likely each naming tradition is for a generated person. Deliberately a
 * single tunable table rather than a shape baked into the banks: rebalancing
 * what the industry looks like is a numbers edit here, with no data churn.
 * Weights are relative, not percentages (engine/random.ts:weightedPick
 * normalises them).
 *
 * ANCHORED TO A SURVEY of 525 name-slots (446 distinct people) across Academy
 * nominees for the 94th-98th ceremonies (films 2021-2025) in every category,
 * plus the worldwide box-office top ~17 for 2023-2025. Measured Anglophone
 * share by band:
 *
 *     on-screen leads   62.7%      directors      56.8%
 *     screenwriters     51.3%      craft (BTL)    44.0%
 *
 * The gradient is monotonic and strong (z = 3.69 on-screen vs below-the-line):
 * THE FURTHER FROM THE CAMERA, THE LESS ANGLO THE NAME READS. The direction of
 * the non-Anglo share differs by band too, which matters more here than the
 * aggregate: below-the-line names are overwhelmingly continental EUROPEAN
 * (42.9% of craft slots), while on-screen non-Anglo names skew HISPANIC and
 * African-diaspora, and DIRECTING is the only band where East Asian names are
 * common (12.3%).
 *
 * TWO DELIBERATE DEPARTURES FROM THE SURVEY:
 *
 *  1. VFX Supervisor does NOT follow the other craft roles. Measured at 52.5%
 *     Anglophone and dominated by British VFX-house names (Corbould, Comley,
 *     Fawkner, Henley, Stubbs) - more Anglo than editing, scoring or
 *     cinematography. It gets its own entry rather than the craft default.
 *  2. The rarest groups keep a small floor rather than tracking the survey to
 *     ~0 (it measured South Asian at 0.2% pooled, African at 1.1%). Two
 *     reasons. The sample is Oscar/ASC-nominee-filtered - an elite,
 *     festival-weighted slice that systematically excludes exactly the
 *     population this generator produces, which is the no-name BUDGET TIER and
 *     the unglamorous departments. And a weight that low means a 100-person
 *     department never contains one at all, which is its own inauthenticity.
 *     The survey anchors the SHAPE (Anglo-dominant, European second, graded by
 *     role); it is not applied as a quota.
 *
 * The survey's own caveat, worth keeping in view before retuning: the
 * below-the-line European share is likely an UPPER bound, since European
 * art-cinema crews are over-represented in nominations.
 */
export type NameOriginWeights = Partial<Record<NameOrigin, number>>;

/** Roughly the pooled survey mix - used by any role without its own entry. */
export const DEFAULT_NAME_ORIGIN_WEIGHTS: NameOriginWeights = {
  'anglo-american': 36, 'british-irish': 18,
  french: 7, nordic: 7, germanic: 6, slavic: 5, italian: 4,
  hispanic: 6,
  japanese: 2, chinese: 1.5, korean: 1.5,
  'middle-eastern': 2, 'west-african': 2, 'south-asian': 2,
};

/**
 * Per-role overrides, following the measured gradient. Only roles the survey
 * actually covered get one; anything else falls back to the pooled default.
 */
export const NAME_ORIGIN_WEIGHTS_BY_ROLE: Partial<Record<TalentProfession, NameOriginWeights>> = {
  // On-screen leads: the most Anglo band, and the one where Hispanic and
  // African-diaspora names appear most.
  Actor: {
    'anglo-american': 40, 'british-irish': 21,
    french: 4, nordic: 4, germanic: 4, slavic: 2, italian: 2,
    hispanic: 9,
    japanese: 1.5, chinese: 1.5, korean: 1,
    'west-african': 4, 'middle-eastern': 1.5, 'south-asian': 2,
  },
  // The only band where East Asian names are common (12.3% measured).
  Director: {
    'anglo-american': 36, 'british-irish': 19,
    french: 6, nordic: 6, germanic: 5, slavic: 4, italian: 3,
    japanese: 4, chinese: 4, korean: 3.5,
    hispanic: 3, 'middle-eastern': 3, 'south-asian': 2, 'west-african': 1.5,
  },
  // Highest continental-European share of any above-the-line role (35.5%).
  Writer: {
    'anglo-american': 33, 'british-irish': 18,
    french: 9, nordic: 9, germanic: 8, slavic: 6, italian: 4,
    japanese: 3, chinese: 2, korean: 2,
    'middle-eastern': 3.5, hispanic: 2, 'south-asian': 1.5, 'west-african': 1,
  },
  // The least Anglo role measured (28% - though on n=25, the survey's single
  // most fragile figure, so this is pulled back toward the craft mean rather
  // than tracking it exactly).
  Cinematographer: {
    'anglo-american': 24, 'british-irish': 15,
    french: 12, nordic: 11, germanic: 10, slavic: 8, italian: 5,
    hispanic: 6, 'middle-eastern': 3,
    japanese: 1.5, chinese: 1, korean: 1, 'south-asian': 1.5, 'west-african': 1,
  },
  Editor: {
    'anglo-american': 27, 'british-irish': 15,
    french: 11, nordic: 11, germanic: 10, slavic: 8, italian: 6,
    hispanic: 4, 'middle-eastern': 2,
    japanese: 1.5, chinese: 1, korean: 1, 'south-asian': 1.5, 'west-african': 1,
  },
  Composer: {
    'anglo-american': 24, 'british-irish': 14,
    french: 11, germanic: 11, nordic: 10, italian: 6, slavic: 6,
    hispanic: 5, 'middle-eastern': 3.5,
    japanese: 2, chinese: 1.5, korean: 1, 'south-asian': 2, 'west-african': 1,
  },
  // The most Anglo of the craft roles (52.8%), and notably English among set
  // decorators specifically.
  'Production Designer': {
    'anglo-american': 33, 'british-irish': 20,
    french: 8, nordic: 7, germanic: 7, slavic: 6, italian: 5,
    hispanic: 5, 'middle-eastern': 2,
    japanese: 1.5, chinese: 1, korean: 1, 'south-asian': 1.5, 'west-african': 1,
  },
  // Departure 1 above - British-house heavy, and unlike the other crafts.
  'VFX Supervisor': {
    'anglo-american': 26, 'british-irish': 27,
    french: 8, germanic: 6, nordic: 5, slavic: 4, italian: 4,
    japanese: 5, chinese: 3, korean: 1.5,
    hispanic: 5, 'middle-eastern': 1.5, 'south-asian': 2, 'west-african': 1,
  },
  // Not covered by the survey. Casting is an industry-internal, largely
  // US/UK-based craft, so it sits near the on-screen end of the gradient.
  'Casting Director': {
    'anglo-american': 38, 'british-irish': 20,
    french: 6, nordic: 5, germanic: 5, slavic: 4, italian: 4,
    hispanic: 6, 'middle-eastern': 2,
    japanese: 1.5, chinese: 1, korean: 1, 'south-asian': 2, 'west-african': 2,
  },
};

/**
 * Film TITLES are not people. A possessive or proper-name title ("Callahan's
 * Redemption") names a CHARACTER in an English-language film, so it leans
 * considerably more Anglo than any talent roster does.
 */
export const TITLE_NAME_ORIGIN_WEIGHTS: NameOriginWeights = {
  'anglo-american': 55, 'british-irish': 20,
  italian: 4, hispanic: 5, french: 3, nordic: 3, germanic: 3, slavic: 2,
  'west-african': 2, 'middle-eastern': 1, japanese: 1, 'south-asian': 1,
};
