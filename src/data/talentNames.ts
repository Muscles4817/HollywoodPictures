// First/last name word banks for generated talent. Flavour only - no gameplay
// effect.
//
// Since the shipped default roster generates everybody (data/talentDatabases.ts),
// a single playthrough can draw well over two thousand people. These banks hold
// 690 first names and 750 surnames; engine/talentGenerator.ts layers structural
// variation on top (a middle initial on some people, an occasional
// double-barrelled surname), lifting the effective space into the millions.
// talentNames.test.ts pins the actual collision rate at real draw volumes rather
// than trusting that arithmetic.
//
// First names are a single unisex pool BY DESIGN rather than split by gender -
// see engine/talentGenerator.ts, which draws gender independently. No name here
// was ever meant to imply one.
//
// GROUPING IS STRUCTURAL, NOT DECORATIVE.
//
// The banks are organised by naming tradition and a person's two names are drawn
// from the SAME region, because names correlate in life and a reader notices
// when they do not. Drawing the halves independently across all ten regions -
// which is what these banks did when they were two flat lists - put roughly 80%
// of generated people on a cross-region pairing, producing "Priyanka Flanagan"
// and "Duke Suzuki" at a rate no real industry roster comes close to. Those do
// not read as cosmopolitan, they read as GENERATED, which is the immersion break.
//
// Mixed names are real and deliberately kept: mixed heritage, marriage and
// chosen professional names all produce them, and engine/talentGenerator.ts
// draws a minority of people that way on purpose (CROSS_REGION_CHANCE). What
// changed is the RATE - a deliberate minority rather than the default.
//
// The regional mix is also weighted per role, anchored to a survey of Academy
// nominees and box-office leads: the further from the camera, the less Anglophone
// the name reads (62.7% on-screen, 44.0% below-the-line). See
// NAME_REGION_WEIGHTS_BY_ROLE.
import type { TalentProfession } from '../types';

/**
 * A naming tradition - how a name READS, never a claim about anyone's heritage
 * or nationality. Region labels are the maintenance groupings these banks always
 * carried; what changed is that drawing now respects them.
 */
export type NameRegion =
  | 'britain-ireland'
  | 'north-america'
  | 'france-iberia-italy'
  | 'germanic-nordic'
  | 'central-eastern-europe'
  | 'levant-gulf'
  | 'south-central-asia'
  | 'east-southeast-asia'
  | 'africa'
  | 'americas-caribbean-pacific';

export interface RegionalNameBank {
  /** Human-readable region name, for tooling and tests. */
  label: string;
  /** Plausible nationalities for this tradition, for PersonIdentity.nationality. */
  nationalities: string[];
  /** Unisex by design - see the file header. */
  first: string[];
  last: string[];
}

export const NAME_BANKS: Record<NameRegion, RegionalNameBank> = {
  'britain-ireland': {
    label: 'Britain & Ireland',
    nationalities: ['British', 'Irish', 'Scottish', 'Welsh'],
    first: [
      'Marla', 'Theo', 'Duke', 'Cole', 'Ronan', 'Fiona', 'Benji', 'Otis', 'Ivy', 'Marcus',
      'Harriet', 'Callum', 'Reggie', 'Adrian', 'Willa', 'Grace', 'Camille', 'Freya', 'Clara', 'Tobias',
      'Hugo', 'Freddie', 'Josephine', 'Felix', 'Cora', 'Julian', 'Devon', 'Saoirse', 'Tegan', 'Georgia',
      'Marnie', 'Neve', 'Milo', 'Alfie', 'Bess', 'Cormac', 'Dervla', 'Eamon', 'Fenella', 'Gareth',
      'Hattie', 'Iris', 'Jarvis', 'Kitty', 'Lachlan', 'Maeve', 'Niall', 'Orla', 'Piers', 'Quentin',
      'Rhys', 'Sorcha', 'Tamsin', 'Ulric', 'Verity', 'Wilf', 'Yvonne', 'Alasdair', 'Bridie', 'Crispin',
      'Delphine', 'Edwin', 'Flora', 'Gwendolyn', 'Hamish', 'Imogen', 'Jocelyn', 'Keir', 'Lorna', 'Merrick',
      'Nolan', 'Ottoline', 'Padraig', 'Rosalind', 'Seamus', 'Thea', 'Ursula', 'Vaughn', 'Winifred', 'Alistair',
      'Bronwyn', 'Cillian', 'Dympna', 'Ewan', 'Ffion', 'Gemma', 'Huw', 'Isla', 'Jago', 'Kerensa',
      'Lowri', 'Morwenna', 'Nesta', 'Osian', 'Peredur', 'Rhiannon', 'Sian', 'Taliesin', 'Wyn', 'Emrys',
      'Aled', 'Bethan', 'Caradoc', 'Dilys', 'Eilir', 'Gwilym', 'Heledd', 'Ianto', 'Llinos', 'Meirion',
      'Nerys', 'Owain', 'Prydwen', 'Rhodri', 'Seren', 'Tomos', 'Wenna', 'Anwen', 'Bleddyn', 'Carys',
      'Aoibheann', 'Brannagh', 'Ciaran', 'Deirdre', 'Eibhlin', 'Fionnuala', 'Grainne', 'Iarla', 'Keelin', 'Lorcan',
      'Muireann', 'Naoise', 'Oisin', 'Roisin', 'Sinead', 'Tadhg', 'Ultan', 'Aisling', 'Bearach', 'Cathal',
      'Donnacha', 'Eabha', 'Fergal', 'Aneurin', 'Bedwyr', 'Cadwgan', 'Eluned', 'Gwenllian', 'Idris', 'Llewelyn',
    ],
    last: [
      'Ashcombe', 'Barlow', 'Cadwallader', 'Danvers', 'Ellery', 'Fairbrother', 'Gattrell', 'Hallam', 'Ingleby', 'Jarrow',
      'Kingsmill', 'Lockhart', 'Marchbank', 'Netherfield', 'Osgood', 'Penhale', 'Quennell', 'Ravensworth', 'Selby', 'Thackery',
      'Underhill', 'Verrell', 'Wexford', 'Yardley', 'Ainsworth', 'Braithwaite', 'Cholmondeley', 'Dunsmore', 'Eastcott', 'Fenwick',
      'Garrowby', 'Hesketh', 'Inchbald', 'Jephson', 'Kettleby', 'Langrish', 'Mallory', 'Norbury', 'Ottley', 'Pargeter',
      'Rockingham', 'Standish', 'Trelawney', 'Ufford', 'Vansittart', 'Wraysbury', 'Yelverton', 'Ashby', 'Blackwood', 'Cavendish',
      'Doughty', 'Erskine', 'Fitzalan', 'Greenhalgh', 'Hardcastle', 'Ipswich', 'Kirkbride', 'Loveridge', 'Merriweather', 'Nithsdale',
      'Ormerod', 'Peverell', 'Quarrington', 'Rutherglen', 'Shackleton', 'Tollemache', 'Uttoxeter', 'Vickery', 'Whitcombe', 'Applegarth',
      'Bracewell', 'Corrigan', 'Devlin', 'Enright', 'Flanagan', 'Gallagher', 'Hanrahan', 'Kavanagh', 'Lenihan', 'Moriarty',
      'Nolan', 'ODonoghue', 'Prendergast', 'Quigley', 'Rafferty', 'Sheridan', 'Tierney', 'Woulfe', 'Boyle', 'Cassidy',
      'Doherty', 'Fallon', 'Gilhooly', 'Hennessy', 'Kilbride', 'Loughlin', 'Mulcahy', 'Nugent', 'Quinlan', 'Slattery',
      'Buchanan', 'Cameron', 'Drummond', 'Farquhar', 'Galbraith', 'Hepburn', 'Inglis', 'Kinnaird', 'Lamont', 'MacAulay',
      'MacGregor', 'Ogilvie', 'Ramsay', 'Sinclair', 'Tulloch', 'Urquhart', 'Wemyss', 'Abernethy', 'Balfour', 'Colquhoun',
      'Penhaligon', 'Trelawny', 'Kernick', 'Bawden', 'Tresidder', 'Nancarrow', 'Polkinghorne', 'Chegwidden', 'Hendra', 'Trewin',
      'Carbis', 'Rosevear', 'Menadue', 'Pascoe', 'Trembath', 'Vivian', 'Kitto', 'Chynoweth', 'Retallick', 'Bosanko',
      'Ballantyne', 'Carmichael', 'Dalgleish', 'Elphinstone', 'Fotheringham', 'Glendinning', 'Haddington', 'Inverleith', 'Kilmorey', 'Lamplugh',
      'Mainwaring', 'Netherwood', 'Ossington', 'Polwhele', 'Ruthven', 'Strathearn', 'Tullamore', 'Wolstenholme', 'Aberdour', 'Bandeath',
      'Corstorphine', 'Drumlanrig', 'Ednam', 'Fettes', 'Gartmore', 'Hawthornden', 'Inverarity', 'Kincardine', 'Lauderdale', 'Moncrieff',
    ],
  },
  'north-america': {
    label: 'North America',
    nationalities: ['American', 'Canadian'],
    first: [
      'Jax', 'Nova', 'Deshawn', 'Kai', 'Dallas', 'Everett', 'Harlan', 'Josie', 'Lyle', 'Marcy',
      'Nate', 'Odell', 'Presley', 'Quincy', 'Roscoe', 'Sable', 'Tucker', 'Verna', 'Wade', 'Zelda',
      'Aubrey', 'Beau', 'Cassidy', 'Dean', 'Earlene', 'Forrest', 'Gaines', 'Hollis', 'Ida', 'Jethro',
      'Kendra', 'Lorne', 'Mabel', 'Nash', 'Opal', 'Porter', 'Ruthie', 'Shelby', 'Travis', 'Vance',
      'Arlo', 'Birdie', 'Cyrus', 'Dot', 'Emmett', 'Fern', 'Garrett', 'Hazel', 'Ike',
      'Junie', 'Kip', 'Luella', 'Merle', 'Nell', 'Orson', 'Peg', 'Rufus', 'Sadie', 'Thaddeus',
      'Vernon', 'Winona', 'Zeb', 'Amos', 'Bonnie', 'Clete', 'Della', 'Elroy', 'Fay', 'Gus',
      'Maceo', 'Delphia', 'Brantley', 'Georgene', 'Sutton', 'Loretta', 'Ryder', 'Marlys', 'Wilburn', 'Berniece',
      'Kellen', 'Adaline', 'Tobin', 'Charlene', 'Ledger', 'Rosalie', 'Braxton', 'Wilma', 'Cassius', 'Doreen',
      'Judd', 'Iva', 'Cletus', 'Nadine', 'Ossie', 'Bernice', 'Rowdy', 'Estelle', 'Bodie', 'Maureen',
      'Grover', 'Clemmie', 'Hank', 'Vada', 'Linus', 'Alva', 'Milton', 'Zora', 'Chester', 'Elva',
      'Rueben', 'Faye', 'Alton', 'Lurline', 'Otho', 'Trudy', 'Wilbur', 'Ada', 'Ephraim', 'Nettie',
      'Booker', 'Selma', 'Dewey', 'Lurlene', 'Lemuel', 'Cleo', 'Rollin', 'Etta', 'Silas', 'Vesta',
      'Hershel', 'Lila', 'Orville', 'Myrtle', 'Willard', 'Ivadelle', 'Clyde', 'Tressie', 'Roy', 'Bertha',
      'Homer', 'Odessa', 'Virgil', 'Lavinia', 'Elmer', 'Pearline',
      'Waverly', 'Isadore', 'Rexford', 'Malinda', 'Thurman', 'Cordelia', 'Ellsworth', 'Verlene', 'Jasper', 'Roweena',
      'Lafayette', 'Winnifred', 'Emory', 'Clarabelle', 'Rutherford', 'Docia', 'Barnabas', 'Leota', 'Ambrose', 'Zelphia',
      'Dewitt', 'Arvilla', 'Newton', 'Melvina', 'Solomon', 'Orpha', 'Leland', 'Zadie', 'Ferris', 'Cleta',
      'Hardin', 'Neva', 'Ozell', 'Ludie', 'Talmadge', 'Effie', 'Wendell', 'Sudie', 'Bertram', 'Lovie',
      'Aurelius', 'Bernadine', 'Cassander', 'Dorinda', 'Ellery', 'Fredericka', 'Gaylord', 'Henrietta', 'Idella', 'Jubal',
      'Kermit', 'Lavonne', 'Micajah', 'Norvel', 'Ophelia', 'Pentreath', 'Quintus', 'Roderic', 'Sylvanus', 'Theodosia',
      'Ulysses', 'Valeda', 'Wilburta', 'Xavier', 'Yancey', 'Zebulon', 'Alphonse', 'Bethel', 'Cyrenus', 'Dulcie',
      'Eldridge', 'Fidelia', 'Garnet', 'Hosea', 'Ivalene', 'Jephson', 'Kenelm', 'Lurana', 'Mordecai', 'Nathaniel',
      'Obadiah', 'Philander', 'Reuben', 'Sylvester', 'Thurlow', 'Vergil', 'Wilhelmine', 'Zephaniah', 'Abner', 'Clovis',
      'Delmar', 'Ezekiel', 'Florine', 'Grantland', 'Hollice', 'Isham', 'Jephtha', 'Kearney', 'Lysander', 'Marvel',
    ],
    last: [
      'Ackerly', 'Boone', 'Cutshaw', 'Dunphy', 'Eastland', 'Frawley', 'Grubbs', 'Hollingsworth', 'Ivey', 'Jessup',
      'Kessler', 'Ledbetter', 'Mabry', 'Nunnally', 'Odom', 'Purvis', 'Quarles', 'Renfro', 'Stapleton', 'Tatum',
      'Upshaw', 'Vandergriff', 'Whitlock', 'Yeager', 'Ansley', 'Bardwell', 'Crenshaw', 'Dillard', 'Eubanks', 'Fairchild',
      'Gaskins', 'Hargrove', 'Isbell', 'Jernigan', 'Kirkland', 'Lassiter', 'Mendenhall', 'Northcutt', 'Oldham', 'Pettigrew',
      'Rowland', 'Sizemore', 'Threadgill', 'Vestal', 'Waddell', 'Yancey', 'Applewhite', 'Bledsoe', 'Culpepper', 'Doss',
      'Ellington', 'Fortenberry', 'Gainey', 'Hollandsworth', 'Inman', 'Jolley', 'Kimbrough', 'Loveless', 'Muncy', 'Nettles',
      'Overstreet', 'Pilcher', 'Ridgeway', 'Sherrill', 'Tolliver', 'Vaughters', 'Whitten', 'Youngblood', 'Ballinger', 'Cobb',
      'Ashworth', 'Brumfield', 'Calloway', 'Denbow', 'Etheridge', 'Stallworth', 'Galloway', 'Hasbrouck', 'Ingersoll', 'Jarrell',
      'Keating', 'Lockridge', 'Mattingly', 'Nickerson', 'Ogletree', 'Pennington', 'Quimby', 'Rockwell', 'Sanderlin', 'Trueblood',
      'Halloran', 'Vanderpool', 'Wexler', 'Yarborough', 'Abernathy', 'Blackmon', 'Cavanaugh', 'Winfree', 'Easterling', 'Cottrell',
      'Goodnight', 'Hollinger', 'Ironside', 'Jennings', 'Kilpatrick', 'Lindstrom', 'Shackleford', 'Nolen', 'Ormsby', 'Pickering',
      'Quillen', 'Radcliffe', 'Vantrease', 'Bricker', 'Utley', 'Vandiver', 'Winthrop', 'Yeatman', 'Ashcraft', 'Bramlett',
      'Cordell', 'Duckworth', 'Ellsworth', 'Fitzhugh', 'Granger', 'Haskins', 'Ivers', 'Josephs', 'Kendrick', 'Lattimore',
      'Millsap', 'Norwood', 'Overton', 'Prewitt', 'Rhinehart', 'Satterfield', 'Tidwell', 'Rutledge', 'Whitmire', 'Wolcott',
      'Ambrose', 'Beauchamp', 'Chastain', 'Delacourt',
      'Threlkeld', 'Bourgeois', 'Hackensmith', 'Vandermeer', 'Crittenden', 'Applegate', 'Stroud', 'Wingfield', 'Danforth', 'Muhlenberg',
      'Kettering', 'Slaughterbeck', 'Wentworth', 'Ferriday', 'Broadnax', 'Hazelrigg', 'Tinsley', 'Poindexter', 'Cranmer', 'Shufelt',
      'Bickerstaff', 'Ravenel', 'Waterston', 'Grissom', 'Hollenbeck', 'Netterville', 'Peabody', 'Swinford', 'Trammell', 'Vandeveer',
      'Wisecarver', 'Yarnell', 'Ackland', 'Brightwell', 'Coggins', 'Dabney', 'Featherstone', 'Gillingham', 'Hazzard', 'Ivancic',
      'Abercrombie', 'Bellinger', 'Cannonbury', 'Delashmutt', 'Endicott', 'Fothergill', 'Gallatin', 'Hollingshead', 'Ingham', 'Jorgenson',
      'Kilsyth', 'Loftus', 'Marchbanks', 'Nightingale', 'Ollinger', 'Pemberly', 'Quackenbush', 'Rasmusson', 'Steadwell', 'Tolbert',
      'Uphoff', 'Vansickle', 'Wadsworth', 'Yandell', 'Ashenfelter', 'Birdwell', 'Chamberlain', 'Dinsmore', 'Edgecomb', 'Furlong',
      'Grantham', 'Haversham', 'Inglewood', 'Jamison', 'Kingsbury', 'Livingood', 'Mortenson', 'Newcombe', 'Oglesby', 'Pennebaker',
      'Redmond', 'Stallings', 'Tuttleman', 'Vreeland', 'Wamsley', 'Youngquist', 'Attwater', 'Blakeney', 'Carmody', 'Dellinger',
    ],
  },
  'france-iberia-italy': {
    label: 'France, Iberia, Italy',
    nationalities: ['French', 'Spanish', 'Portuguese', 'Italian', 'Belgian'],
    first: [
      'Elena', 'Rosa', 'Lucia', 'Elodie', 'Beatriz', 'Sofia', 'Pablo', 'Lorenzo', 'Matteo', 'Chiara',
      'Anouk', 'Renata', 'Colette', 'Marisol', 'Rocco', 'Amelie', 'Paloma', 'Javier', 'Thiago', 'Gael',
      'Diego', 'Santiago', 'Enzo', 'Simone', 'Dario', 'Bruno', 'Rafael', 'Nestor', 'Pia', 'Ivo',
      'Aurelien', 'Bastien', 'Celestine', 'Dominique', 'Ardis', 'Fabien', 'Gaspard', 'Honore', 'Isabelle', 'Jules',
      'Lucien', 'Margaux', 'Ottilia', 'Octave', 'Perrine', 'Rémy', 'Sylvie', 'Thibault', 'Valentine', 'Xerxes',
      'Alonso', 'Bianca', 'Consuelo', 'Duarte', 'Emilia', 'Fausto', 'Graziella', 'Ignacio', 'Joaquim', 'Leonor',
      'Mariana', 'Nuno', 'Ofelia', 'Paulo', 'Quirino', 'Rosario', 'Salvatore', 'Tomás', 'Ubaldo', 'Vittoria',
      'Alba', 'Cesare', 'Donatella', 'Ettore', 'Fiorella', 'Gianluca', 'Ilaria', 'Leandro', 'Mirella', 'Nicoletta',
    ],
    last: [
      'Auclair', 'Bellamy', 'Sturdivant', 'Devereux', 'Escoffier', 'Fontaine', 'Gaudreau', 'Hachette', 'Jourdain', 'Lacroix',
      'Marchetti', 'Nadeau', 'Ormont', 'Pelletier', 'Quesnel', 'Rousseau', 'Sabatier', 'Thibodeaux', 'Vaillancourt', 'Blanchard',
      'Charbonneau', 'Delacroix', 'Estienne', 'Fournier', 'Hollister', 'Hebert', 'Lamarche', 'Montclair', 'Perreault', 'Rivard',
      'Aguilar', 'Barrantes', 'Cabrera', 'Delgado', 'Escamilla', 'Fuentes', 'Gallardo', 'Herrera', 'Ibarra', 'Jaramillo',
      'Lozano', 'Madrigal', 'Nieves', 'Olmedo', 'Palacios', 'Quintana', 'Rosales', 'Salazar', 'Trevino', 'Urrutia',
      'Valdivia', 'Zamora', 'Almeida', 'Bettencourt', 'Carvalho', 'Esteves', 'Figueiredo', 'Guimaraes', 'Loureiro', 'Marinho',
      'Nogueira', 'Pacheco', 'Queiroz', 'Rebelo', 'Sampaio', 'Teixeira', 'Vasconcelos', 'Barbieri', 'Castellano', 'Danesi',
      'Esposito', 'Falconieri', 'Gagliardi', 'Lombardi', 'Marchesi', 'Nicolosi', 'Orsini', 'Petrucci', 'Rinaldi', 'Sartori',
      'Tosatti', 'Vaccaro', 'Zangrilli', 'Bellucci', 'Cavallo', 'Ferraro', 'Grimaldi', 'Lanzetti', 'Montalto', 'Ricciardi',
    ],
  },
  'germanic-nordic': {
    label: 'Germany, Low Countries, Nordics',
    nationalities: ['German', 'Austrian', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish'],
    first: [
      'Anders', 'Bjorn', 'Astrid', 'Ingrid', 'Soren', 'Mikael', 'Inga', 'Greta', 'Lars', 'Oskar',
      'Nils', 'Lotte', 'Casper', 'Liv', 'Emil', 'Kirsi', 'Sena', 'Vera', 'Ezra', 'Marta',
      'Annika', 'Bendik', 'Dagmar', 'Eirik', 'Frida', 'Gunnar', 'Helle', 'Ivar', 'Johanna', 'Kasper',
      'Leif', 'Maren', 'Niels', 'Ola', 'Pernille', 'Ragnar', 'Signe', 'Torvald', 'Ulla', 'Viggo',
      'Wiebke', 'Ansgar', 'Brigitta', 'Detlef', 'Elke', 'Friedrich', 'Gisela', 'Heinrich', 'Ilse', 'Jürgen',
      'Katrin', 'Ludwig', 'Magda', 'Norbert', 'Ottilie', 'Reinhold', 'Sieglinde', 'Ulrich', 'Waltraud', 'Bram',
      'Femke', 'Gijs', 'Hendrika', 'Joost', 'Maartje', 'Pieter', 'Roos', 'Sander', 'Truus', 'Willem',
      'Annelie', 'Bastiaan', 'Cornelis', 'Dietrich', 'Eldrid', 'Floris', 'Gerda', 'Halvard', 'Solvej', 'Jorun',
      'Klaas', 'Lisbet', 'Mathijs', 'Nanna', 'Olaf', 'Petra', 'Runa', 'Solveig', 'Thies', 'Ulrikke',
      'Vigdis', 'Wilhelmina', 'Ynge', 'Agneta', 'Bodil', 'Cato', 'Dorthe', 'Espen', 'Frauke', 'Gerrit',
    ],
    last: [
      'Achterberg', 'Brandt', 'Diefenbach', 'Ehrlich', 'Fassbinder', 'Grunewald', 'Hoffmeister', 'Kellerman', 'Lindqvist', 'Mauer',
      'Neuhaus', 'Osterhagen', 'Pfeiffer', 'Reinholt', 'Schilling', 'Trautwein', 'Ulbrecht', 'Vogelsang', 'Weissmuller', 'Zeitler',
      'Bergstrom', 'Dahlgren', 'Ekstrand', 'Falkenberg', 'Gustafsen', 'Halvorsen', 'Ingebretsen', 'Kvalheim', 'Lindahl', 'Malmgren',
      'Nordstrom', 'Ostergaard', 'Rasmussen', 'Sandvik', 'Thorsen', 'Vinterberg', 'Aabye', 'Bjornstad', 'Dahlberg', 'Engstrom',
      'Fjeldstad', 'Grimstad', 'Hallstrom', 'Jorgensen', 'Kirkeby', 'Lindberg', 'Mikkelsen', 'Nyquist', 'Ravnsborg', 'Sundqvist',
      'Bakhuizen', 'Coppens', 'Dekkers', 'Eikelboom', 'Groeneveld', 'Hoogendijk', 'Kuiperman', 'Lindeboom', 'Meulenbelt', 'Oosterhuis',
      'Rijkaard', 'Steenbergen', 'Vandenbroek', 'Wijnands', 'Zeelenberg', 'Buitendijk', 'Doornbos', 'Haverkamp', 'Verstegen', 'Zwanenburg',
      'Aldenhoven', 'Berkenkamp', 'Claassen', 'Dornbusch', 'Eggebrecht', 'Feddersen', 'Gerbrandy', 'Hillebrand', 'Jacobsen', 'Kalsbeek',
      'Lauritzen', 'Moerdijk', 'Nieuwenhuis', 'Oberhauser', 'Prinsloo', 'Quakkelaar', 'Ruthenbeck', 'Siebrand', 'Tammsaare', 'Uitdenbogaard',
      'Vermeulen', 'Waldschmidt', 'Zandvliet', 'Aakerlund', 'Blixen', 'Dyrhaug', 'Eskildsen', 'Fagerlund', 'Gjertsen', 'Holmberg',
    ],
  },
  'central-eastern-europe': {
    label: 'Central & Eastern Europe, the Balkans',
    nationalities: ['Polish', 'Czech', 'Hungarian', 'Russian', 'Ukrainian', 'Serbian', 'Croatian', 'Romanian'],
    first: [
      'Birgitte', 'Dmitri', 'Nikolai', 'Anya', 'Viktor', 'Nikita', 'Zoya', 'Elina', 'Sasha', 'Nadia',
      'Selin', 'Milena', 'Bogdan', 'Dragana', 'Emilian', 'Franjo', 'Gordana', 'Ilja', 'Jadranka', 'Kazimierz',
      'Lidia', 'Miroslav', 'Nevena', 'Ondrej', 'Pavla', 'Radek', 'Slavica', 'Tadeusz', 'Vesna', 'Zdenek',
      'Agnieszka', 'Blaz', 'Cveta', 'Dusan', 'Ewa', 'Gyorgy', 'Hedvig', 'Ilona', 'Janos', 'Katalin',
      'Laszlo', 'Marek', 'Natalia', 'Oksana', 'Piotr', 'Ruzena', 'Stanislav', 'Tatiana', 'Vlad', 'Zsofia',
      'Anastasia', 'Borislav', 'Danica', 'Evgeni', 'Filip', 'Grigori', 'Irina', 'Jelena', 'Kostya', 'Ljuba',
    ],
    last: [
      'Andreyev', 'Bakhmetev', 'Chernyshov', 'Dubrovin', 'Yefimov', 'Golitsyn', 'Ignatiev', 'Kalinin', 'Lebedev', 'Miloradov',
      'Nesterov', 'Ostrovsky', 'Pankratov', 'Rozhdestvensky', 'Sokolov', 'Turgenev', 'Vasiliev', 'Yablokov', 'Zhukovsky', 'Bazhenov',
      'Czerniak', 'Dabrowski', 'Grabowski', 'Jablonski', 'Kowalczyk', 'Lewandowski', 'Michalski', 'Nowicki', 'Pietrzak', 'Rutkowski',
      'Sadowski', 'Tomaszewski', 'Wisniewski', 'Zielinski', 'Balog', 'Csanyi', 'Dobrev', 'Farkas', 'Horvath', 'Kovacs',
      'Lukacs', 'Nemeth', 'Petrovic', 'Radulescu', 'Stoyanov', 'Takacs', 'Vukovic', 'Zsigmond', 'Antonescu', 'Bogdanovic',
      'Dimitrov', 'Grozdanov', 'Ilievski', 'Jovanovic', 'Krstic', 'Marinescu', 'Novakovic', 'Popescu', 'Simeonov', 'Todorovic',
    ],
  },
  'levant-gulf': {
    label: 'Greece, Turkey, the Levant, the Gulf',
    nationalities: ['Greek', 'Turkish', 'Lebanese', 'Egyptian', 'Israeli', 'Iranian'],
    first: [
      'Omar', 'Amina', 'Noor', 'Tariq', 'Yasmin', 'Leila', 'Malik', 'Zainab', 'Amir', 'Fatima',
      'Rashid', 'Yusuf', 'Karim', 'Naima', 'Bilal', 'Salma', 'Hamza', 'Rania', 'Darius', 'Cyprian',
      'Adnan', 'Basma', 'Dalia', 'Elias', 'Farid', 'Ghada', 'Hisham', 'Iman', 'Jamal', 'Khalil',
      'Layla', 'Mounir', 'Nabil', 'Rasha', 'Sami', 'Tamer', 'Wafa', 'Yara', 'Ziad', 'Anoush',
      'Berk', 'Ceyda', 'Demir', 'Ece', 'Ferhat', 'Gizem', 'Hakan', 'Ilkay', 'Kerem', 'Melis',
      'Ozan', 'Pelin', 'Serkan', 'Tuna', 'Yalcin', 'Zehra', 'Alexios', 'Despina', 'Fotini', 'Iannis',
      'Kalliope', 'Lambros', 'Myrto', 'Nikos', 'Panagiota', 'Stavros', 'Thanos', 'Vasiliki', 'Xanthe', 'Zoi',
    ],
    last: [
      'Alexopoulos', 'Diamantis', 'Fotiadis', 'Giannakos', 'Hatzis', 'Kanellos', 'Lambrakis', 'Mavridis', 'Nikolaidis', 'Pappas',
      'Sarantos', 'Theodorou', 'Vlachos', 'Xenakis', 'Zervas', 'Andronikos', 'Christoforou', 'Dendrinos', 'Kalogeras', 'Stamatis',
      'Akkaya', 'Bayrakdar', 'Cetinkaya', 'Demirel', 'Erdogmus', 'Gunduz', 'Kilicaslan', 'Ozdemir', 'Sahinkaya', 'Yildirim',
      'Abadi', 'Baroudi', 'Chalhoub', 'Dagher', 'Fakhoury', 'Ghanem', 'Haddad', 'Jabbour', 'Khoury', 'Mansour',
      'Nassar', 'Rahal', 'Sabbagh', 'Tannous', 'Zaghloul', 'Alkhatib', 'Barakat', 'Darwish', 'Farouk', 'Halabi',
      'Amirkhani', 'Bahrami', 'Delavari', 'Esfandiari', 'Ghorbani', 'Hosseinzadeh', 'Jahangiri', 'Kermani', 'Mirzaei', 'Nourbakhsh',
    ],
  },
  'south-central-asia': {
    label: 'South & Central Asia',
    nationalities: ['Indian', 'Pakistani', 'Bangladeshi', 'Sri Lankan'],
    first: [
      'Priya', 'Rohan', 'Arjun', 'Ravi', 'Sanjay', 'Indira', 'Ishaan', 'Priyanka', 'Roshan', 'Sina',
      'Aarti', 'Bhavna', 'Chetan', 'Divya', 'Farhan', 'Gita', 'Harpreet', 'Jaya', 'Kiran', 'Lakshmi',
      'Manju', 'Nikhil', 'Padma', 'Rekha', 'Sunil', 'Tara', 'Uma', 'Vikram', 'Yash', 'Zara',
      'Anjali', 'Balraj', 'Deepa', 'Girish', 'Hemant', 'Jasleen', 'Kavita', 'Mohan', 'Neelam', 'Pallavi',
      'Rajiv', 'Shalini', 'Tanvir', 'Varun', 'Aziza', 'Bekzod', 'Dilnoza', 'Farrukh', 'Gulnara', 'Jamshid',
      'Nargis', 'Rustam', 'Shirin', 'Timur', 'Zarina', 'Parviz', 'Laleh', 'Kaveh', 'Mitra', 'Behrouz',
    ],
    last: [
      'Achari', 'Bhattacharya', 'Chandrasekar', 'Deshmukh', 'Gopalakrishnan', 'Hiremath', 'Iyengar', 'Jhaveri', 'Kulkarni', 'Lakshmanan',
      'Mahadevan', 'Narayanan', 'Padmanabhan', 'Raghunathan', 'Sundaram', 'Thiruvengadam', 'Venkataraman', 'Balasubramanian', 'Chakraborty', 'Dasgupta',
      'Gangopadhyay', 'Krishnamurthy', 'Mukhopadhyay', 'Parthasarathy', 'Ramaswamy', 'Subramaniam', 'Vaidyanathan', 'Ahluwalia', 'Bhandari', 'Chaudhary',
      'Dhillon', 'Grewal', 'Kohli', 'Mahajan', 'Randhawa', 'Sabharwal', 'Talwar', 'Virk', 'Abbasi', 'Chowdhury',
      'Faruqui', 'Hashmi', 'Jafri', 'Khalilzad', 'Mirbagheri', 'Qureshi', 'Rahimi', 'Siddiqui', 'Zaidi', 'Nazarbek',
      'Abdullayev', 'Ergashev', 'Karimov', 'Rakhmonov', 'Turgunbek', 'Yusupov', 'Bekmurodov', 'Sattarov', 'Umarov', 'Nurlanov',
    ],
  },
  'east-southeast-asia': {
    label: 'East & Southeast Asia',
    nationalities: ['Chinese', 'Japanese', 'South Korean', 'Filipino', 'Thai', 'Vietnamese'],
    first: [
      'Yuki', 'Kenji', 'Mei', 'Jun', 'Hana', 'Aki', 'Suki', 'Kian', 'Akira', 'Chiyo',
      'Daichi', 'Emi', 'Fumiko', 'Haruki', 'Ichiro', 'Junko', 'Kaoru', 'Michiko', 'Noboru', 'Reiko',
      'Satoshi', 'Takumi', 'Yoko', 'Bao', 'Chun', 'Fang', 'Guo', 'Hui', 'Jia', 'Lian',
      'Ming', 'Ping', 'Qiang', 'Rong', 'Shan', 'Wei', 'Xiu', 'Yun', 'Zhen', 'Bora',
      'Dae', 'Eunji', 'Haneul', 'Jisoo', 'Minho', 'Seojun', 'Yerin', 'Anh', 'Duc', 'Hien',
      'Linh', 'Nguyet', 'Quang', 'Thao', 'Trang', 'Vinh', 'Amihan', 'Bayani', 'Dalisay', 'Ligaya',
      'Marikit', 'Tala', 'Adit', 'Cahaya', 'Dewi', 'Rahman', 'Siti', 'Wayan', 'Intan', 'Bagus',
    ],
    last: [
      'Akiyama', 'Fujimori', 'Hasegawa', 'Ishiguro', 'Kawabata', 'Matsushima', 'Nakagawa', 'Okonogi', 'Shimomura', 'Takahashi',
      'Uchiyama', 'Watanabe', 'Yamashiro', 'Kuroshima', 'Morimoto', 'Nishikawa', 'Sakaguchi', 'Tsukamoto', 'Yoshinaga', 'Hiraoka',
      'Cheung', 'Fong', 'Guan', 'Huang', 'Jiang', 'Kwok', 'Liang', 'Ouyang', 'Qiao', 'Shen',
      'Tang', 'Wong', 'Xie', 'Yeung', 'Zhao', 'Situ', 'Duanmu', 'Nangong', 'Zhuge', 'Murong',
      'Baek', 'Choe', 'Hwang', 'Jeong', 'Kwon', 'Moon', 'Namgung', 'Seok', 'Yoon', 'Jang',
      'Bui', 'Dang', 'Hoang', 'Luong', 'Ngo', 'Phan', 'Trinh', 'Vuong', 'Doan', 'Truong',
      'Abueva', 'Batungbakal', 'Dimaculangan', 'Fernandez', 'Magsaysay', 'Pangilinan', 'Salonga', 'Tolentino', 'Villanueva', 'Hidayat',
      'Kusumo', 'Prabowo', 'Santoso', 'Wibowo', 'Halimah', 'Rahardjo', 'Sutrisno', 'Nurhaliza', 'Chaiyaporn', 'Suwannachot',
    ],
  },
  'africa': {
    label: 'Africa',
    nationalities: ['Nigerian', 'Ghanaian', 'Kenyan', 'South African', 'Senegalese', 'Ethiopian'],
    first: [
      'Aisha', 'Kwame', 'Emeka', 'Ayana', 'Imani', 'Kojo', 'Onyeka', 'Amara', 'Ithel', 'Naomi',
      'Abeni', 'Chidi', 'Dayo', 'Ekene', 'Folake', 'Gbenga', 'Ifeoma', 'Jelani', 'Kehinde', 'Lulu',
      'Makena', 'Nneka', 'Obi', 'Sade', 'Tendai', 'Uzoma', 'Wanjiku', 'Yaa', 'Zola', 'Adaeze',
      'Bakari', 'Chiamaka', 'Dumisani', 'Esi', 'Fikile', 'Gugu', 'Hodan', 'Jamila', 'Kofi', 'Lerato',
      'Mandla', 'Nadifa', 'Oumar', 'Rasheeda', 'Sipho', 'Thandiwe', 'Ubah', 'Yewande', 'Zuri', 'Abdi',
      'Baraka', 'Chinedu', 'Fatoumata', 'Habiba', 'Kaleb', 'Mariama', 'Ngozi', 'Ousmane', 'Sekou', 'Tarik',
    ],
    last: [
      'Abiodun', 'Balogun', 'Chukwuma', 'Danjuma', 'Eneh', 'Falade', 'Gbadamosi', 'Ihenacho', 'Jideofor', 'Kalejaiye',
      'Lawal', 'Madueke', 'Nwachukwu', 'Obiora', 'Ogunsanya', 'Sowande', 'Uchendu', 'Yakubu', 'Adeyemi', 'Babatunde',
      'Chigozie', 'Emeagwali', 'Ifeanyi', 'Nwankwo', 'Okonjo', 'Olayinka', 'Onwuachi', 'Ezenwa', 'Asante', 'Boateng',
      'Darko', 'Frimpong', 'Gyasi', 'Mensah', 'Nkrumah', 'Opoku', 'Owusu', 'Quartey', 'Sarpong', 'Yeboah',
      'Cisse', 'Diallo', 'Fofana', 'Keita', 'Konate', 'Ndiaye', 'Sangare', 'Toure', 'Traore', 'Camara',
      'Achieng', 'Kamau', 'Kiprotich', 'Mwangi', 'Njoroge', 'Ochieng', 'Otieno', 'Wanjala', 'Abdulle', 'Farah',
      'Dlamini', 'Khumalo', 'Mabaso', 'Ndlovu', 'Nkosi', 'Sithole', 'Tshabalala', 'Zwane', 'Mokoena', 'Radebe',
      'Bekele', 'Gebremariam', 'Haile', 'Tesfaye', 'Woldemariam', 'Zerihun', 'Abrahams', 'Chikondi', 'Mwale', 'Banda',
    ],
  },
  'americas-caribbean-pacific': {
    label: 'The Americas beyond the US, the Caribbean, the Pacific',
    nationalities: ['Mexican', 'Brazilian', 'Argentine', 'Colombian', 'Jamaican', 'Australian'],
    first: [
      'Mateo', 'Camila', 'Rafaela', 'Sebastián', 'Valentina', 'Xiomara', 'Yolanda', 'Andres', 'Belen', 'Catalina',
      'Emiliano', 'Fernanda', 'Guillermo', 'Ines', 'Julieta', 'Lautaro', 'Micaela', 'Nicolás', 'Ramiro', 'Soledad',
      'Anansi', 'Delroy', 'Errol', 'Junior', 'Marcia', 'Nestor-Rae', 'Winston', 'Yolande', 'Ariki', 'Hine',
      'Kahu', 'Manaia', 'Ngaire', 'Rawiri', 'Tane', 'Whetu', 'Sione', 'Tevita', 'Lani', 'Keanu',
      'Malia', 'Nohea', 'Alofa', 'Fetu', 'Mele', 'Talia', 'Tui', 'Vaea', 'Iolana', 'Kalani',
    ],
    last: [
      'Alcantara', 'Bustamante', 'Carrasquillo', 'Dominguez', 'Echeverria', 'Figueroa', 'Guzman', 'Irizarry', 'Landaverde', 'Montenegro',
      'Nunez', 'Oquendo', 'Portillo', 'Quinonez', 'Rodriguez', 'Santamaria', 'Villalobos', 'Zavaleta', 'Betancourt', 'Cifuentes',
      'Escalante', 'Hinojosa', 'Maldonado', 'Peralta', 'Sepulveda', 'Urdaneta', 'Zeledon', 'Beaubrun', 'Cadet', 'Desrosiers',
      'Jean-Baptiste', 'Pierre-Louis', 'Toussaint', 'Blackman', 'Chevannes', 'Grandison', 'Marchand', 'Nembhard', 'Sealy', 'Vassell',
      'Ngata', 'Rangi', 'Tamati', 'Waititi', 'Whanau', 'Hokianga', 'Kereopa', 'Manukau', 'Paniora', 'Ruatara',
      'Faletau', 'Havili', 'Latu', 'Naivalu', 'Ratuvou', 'Tuilagi', 'Vakatawa', 'Kealoha', 'Makuakane', 'Kahananui',
    ],
  },
};

export const NAME_REGIONS = Object.keys(NAME_BANKS) as NameRegion[];

/**
 * The flat pools, derived from the regional banks rather than authored
 * separately - so there is exactly one place a name lives, and the flat and
 * grouped views can never disagree. Kept exported because a cross-region
 * surname draw (the deliberate mixed-name minority) reads from the whole pool,
 * as does the double-barrelled-surname embellishment.
 */
export const TALENT_FIRST_NAMES: string[] = NAME_REGIONS.flatMap((r) => NAME_BANKS[r].first);
export const TALENT_LAST_NAMES: string[] = NAME_REGIONS.flatMap((r) => NAME_BANKS[r].last);

/** Which region a given first name belongs to. Built once; a name appearing in two regions keeps its first. */
export const REGION_OF_FIRST_NAME: ReadonlyMap<string, NameRegion> = new Map(
  NAME_REGIONS.flatMap((region) => NAME_BANKS[region].first.map((name) => [name, region] as const)).reverse(),
);

// --- Regional mix by role --------------------------------------------------
//
// Anchored to a survey of 525 name-slots across Academy nominees for the 94th-
// 98th ceremonies in every category, plus the worldwide box-office top ~17 for
// 2023-2025. It found a strong, monotonic gradient - the further from the
// camera, the less Anglophone the name reads:
//
//     on-screen leads   62.7%      directors      56.8%
//     screenwriters     51.3%      craft (BTL)    44.0%
//
// (z = 3.69 on-screen vs below-the-line.) The direction of the non-Anglophone
// share differs by band too: below-the-line names are overwhelmingly continental
// EUROPEAN, on-screen ones skew Hispanic and African-diaspora, and DIRECTING is
// the only band where East Asian names are common (12.3%).
//
// Two deliberate departures. VFX Supervisor does NOT follow the other craft
// roles - measured at 52.5% Anglophone and dominated by British VFX-house names -
// so it gets its own entry. And the rarest regions keep a floor rather than
// tracking the survey to ~0, because the sample is Oscar-filtered and so
// excludes exactly the population this generator produces: the no-name budget
// tier and the unglamorous departments. The survey anchors the SHAPE; it is not
// applied as a quota.
//
// Weights are relative, not percentages.
export type NameRegionWeights = Partial<Record<NameRegion, number>>;

/** Roughly the pooled survey mix - used by any role without its own entry. */
export const DEFAULT_NAME_REGION_WEIGHTS: NameRegionWeights = {
  'north-america': 36, 'britain-ireland': 18,
  'france-iberia-italy': 11, 'germanic-nordic': 9, 'central-eastern-europe': 5,
  'east-southeast-asia': 5, 'americas-caribbean-pacific': 6,
  'levant-gulf': 3, 'south-central-asia': 3, africa: 4,
};

export const NAME_REGION_WEIGHTS_BY_ROLE: Partial<Record<TalentProfession, NameRegionWeights>> = {
  // The most Anglophone band, and where Hispanic and African-diaspora names
  // appear most.
  Actor: {
    'north-america': 40, 'britain-ireland': 21,
    'france-iberia-italy': 9, 'germanic-nordic': 8, 'central-eastern-europe': 2,
    'east-southeast-asia': 4, 'americas-caribbean-pacific': 6,
    africa: 4, 'levant-gulf': 1.5, 'south-central-asia': 2,
  },
  // The only band where East Asian names are common (12.3% measured).
  Director: {
    'north-america': 36, 'britain-ireland': 19,
    'france-iberia-italy': 9, 'germanic-nordic': 11, 'central-eastern-europe': 4,
    'east-southeast-asia': 11.5, 'americas-caribbean-pacific': 3,
    'levant-gulf': 3, 'south-central-asia': 2, africa: 1.5,
  },
  // Highest continental-European share of any above-the-line role (35.5%).
  Writer: {
    'north-america': 33, 'britain-ireland': 18,
    'france-iberia-italy': 13, 'germanic-nordic': 17, 'central-eastern-europe': 6,
    'east-southeast-asia': 7, 'americas-caribbean-pacific': 2,
    'levant-gulf': 3.5, 'south-central-asia': 1.5, africa: 1,
  },
  // The least Anglophone role measured (28%) - though on n=25, the survey's most
  // fragile figure, so this is pulled back toward the craft mean.
  Cinematographer: {
    'north-america': 24, 'britain-ireland': 15,
    'france-iberia-italy': 17, 'germanic-nordic': 21, 'central-eastern-europe': 8,
    'east-southeast-asia': 3.5, 'americas-caribbean-pacific': 6,
    'levant-gulf': 3, 'south-central-asia': 1.5, africa: 1,
  },
  Editor: {
    'north-america': 27, 'britain-ireland': 15,
    'france-iberia-italy': 17, 'germanic-nordic': 21, 'central-eastern-europe': 8,
    'east-southeast-asia': 3.5, 'americas-caribbean-pacific': 4,
    'levant-gulf': 2, 'south-central-asia': 1.5, africa: 1,
  },
  Composer: {
    'north-america': 24, 'britain-ireland': 14,
    'france-iberia-italy': 17, 'germanic-nordic': 21, 'central-eastern-europe': 6,
    'east-southeast-asia': 4.5, 'americas-caribbean-pacific': 5,
    'levant-gulf': 3.5, 'south-central-asia': 2, africa: 1,
  },
  // The most Anglophone of the craft roles (52.8%).
  'Production Designer': {
    'north-america': 33, 'britain-ireland': 20,
    'france-iberia-italy': 13, 'germanic-nordic': 14, 'central-eastern-europe': 6,
    'east-southeast-asia': 3.5, 'americas-caribbean-pacific': 5,
    'levant-gulf': 2, 'south-central-asia': 1.5, africa: 1,
  },
  // Departure 1 - British-VFX-house heavy, and unlike the other crafts.
  'VFX Supervisor': {
    'north-america': 26, 'britain-ireland': 27,
    'france-iberia-italy': 12, 'germanic-nordic': 11, 'central-eastern-europe': 4,
    'east-southeast-asia': 9.5, 'americas-caribbean-pacific': 5,
    'levant-gulf': 1.5, 'south-central-asia': 2, africa: 1,
  },
  // Not covered by the survey. Casting is an industry-internal, largely US/UK
  // craft, so it sits near the on-screen end of the gradient.
  'Casting Director': {
    'north-america': 38, 'britain-ireland': 20,
    'france-iberia-italy': 10, 'germanic-nordic': 10, 'central-eastern-europe': 4,
    'east-southeast-asia': 3.5, 'americas-caribbean-pacific': 6,
    'levant-gulf': 2, 'south-central-asia': 2, africa: 2,
  },
};

/**
 * Film TITLES are not people. A possessive or proper-name title names a
 * CHARACTER in an English-language picture, so it leans considerably more
 * Anglophone than any talent roster does.
 */
export const TITLE_NAME_REGION_WEIGHTS: NameRegionWeights = {
  'north-america': 55, 'britain-ireland': 20,
  'france-iberia-italy': 7, 'germanic-nordic': 6, 'central-eastern-europe': 2,
  'americas-caribbean-pacific': 5, africa: 2, 'east-southeast-asia': 1,
  'levant-gulf': 1, 'south-central-asia': 1,
};
