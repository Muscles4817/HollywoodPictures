// First/last name word banks for generated talent. Flavour only - no gameplay
// effect.
//
// Since the shipped default roster generates everybody (data/talentDatabases.ts),
// a single playthrough can draw well over two thousand people, and the old
// 160 x 160 = 25,600-combination space produced roughly a hundred duplicate
// names at that volume.
//
// These banks are 690 x 750 = 517,500 plain combinations - a 20x widening -
// and engine/talentGenerator.ts layers structural variation on top (a middle
// initial on some people, an occasional double-barrelled surname), which lifts
// the effective space into the millions. talentNames.test.ts pins the actual
// collision rate at real draw volumes rather than trusting that arithmetic.
//
// First names are a single unisex pool BY DESIGN rather than split by gender -
// see engine/talentGenerator.ts, which draws gender independently. No name here
// was ever meant to imply one.
//
// Both banks draw across many naming traditions, and the two are drawn
// independently, so a person may carry a given name from one tradition and a
// surname from another. That is deliberate and true to a real film industry:
// mixed heritage, marriages, and chosen professional names all produce exactly
// that. Grouping below is for maintenance only - it has no effect on drawing.

export const TALENT_FIRST_NAMES: string[] = [
  // --- Britain & Ireland ---------------------------------------------------
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

  // --- North America -------------------------------------------------------
  'Jax', 'Nova', 'Deshawn', 'Kai', 'Dallas', 'Everett', 'Harlan', 'Josie', 'Lyle', 'Marcy',
  'Nate', 'Odell', 'Presley', 'Quincy', 'Roscoe', 'Sable', 'Tucker', 'Verna', 'Wade', 'Zelda',
  'Aubrey', 'Beau', 'Cassidy', 'Dean', 'Earlene', 'Forrest', 'Gaines', 'Hollis', 'Ida', 'Jethro',
  'Kendra', 'Lorne', 'Mabel', 'Nash', 'Opal', 'Porter', 'Ruthie', 'Shelby', 'Travis', 'Vance',
  'Wendell', 'Arlo', 'Birdie', 'Cyrus', 'Dot', 'Emmett', 'Fern', 'Garrett', 'Hazel', 'Ike',
  'Junie', 'Kip', 'Luella', 'Merle', 'Nell', 'Orson', 'Peg', 'Rufus', 'Sadie', 'Thaddeus',
  'Vernon', 'Winona', 'Zeb', 'Amos', 'Bonnie', 'Clete', 'Della', 'Elroy', 'Fay', 'Gus',

  // --- France, Iberia, Italy ----------------------------------------------
  'Elena', 'Rosa', 'Lucia', 'Elodie', 'Beatriz', 'Sofia', 'Pablo', 'Lorenzo', 'Matteo', 'Chiara',
  'Anouk', 'Renata', 'Colette', 'Marisol', 'Rocco', 'Amelie', 'Paloma', 'Javier', 'Thiago', 'Gael',
  'Diego', 'Santiago', 'Enzo', 'Simone', 'Dario', 'Bruno', 'Rafael', 'Nestor', 'Pia', 'Ivo',
  'Aurelien', 'Bastien', 'Celestine', 'Dominique', 'Estelle', 'Fabien', 'Gaspard', 'Honore', 'Isabelle', 'Jules',
  'Lucien', 'Margaux', 'Nadine', 'Octave', 'Perrine', 'Rémy', 'Sylvie', 'Thibault', 'Valentine', 'Xavier',
  'Alonso', 'Bianca', 'Consuelo', 'Duarte', 'Emilia', 'Fausto', 'Graziella', 'Ignacio', 'Joaquim', 'Leonor',
  'Mariana', 'Nuno', 'Ofelia', 'Paulo', 'Quirino', 'Rosario', 'Salvatore', 'Tomás', 'Ubaldo', 'Vittoria',
  'Alba', 'Cesare', 'Donatella', 'Ettore', 'Fiorella', 'Gianluca', 'Ilaria', 'Leandro', 'Mirella', 'Nicoletta',

  // --- Germany, Low Countries, Nordics ------------------------------------
  'Anders', 'Bjorn', 'Astrid', 'Ingrid', 'Soren', 'Mikael', 'Inga', 'Greta', 'Lars', 'Oskar',
  'Nils', 'Lotte', 'Casper', 'Liv', 'Emil', 'Kirsi', 'Sena', 'Vera', 'Ezra', 'Marta',
  'Annika', 'Bendik', 'Dagmar', 'Eirik', 'Frida', 'Gunnar', 'Helle', 'Ivar', 'Johanna', 'Kasper',
  'Leif', 'Maren', 'Niels', 'Ola', 'Pernille', 'Ragnar', 'Signe', 'Torvald', 'Ulla', 'Viggo',
  'Wiebke', 'Ansgar', 'Brigitta', 'Detlef', 'Elke', 'Friedrich', 'Gisela', 'Heinrich', 'Ilse', 'Jürgen',
  'Katrin', 'Ludwig', 'Magda', 'Norbert', 'Ottilie', 'Reinhold', 'Sieglinde', 'Ulrich', 'Waltraud', 'Bram',
  'Femke', 'Gijs', 'Hendrika', 'Joost', 'Maartje', 'Pieter', 'Roos', 'Sander', 'Truus', 'Willem',

  // --- Central & Eastern Europe, the Balkans ------------------------------
  'Petra', 'Dmitri', 'Nikolai', 'Anya', 'Viktor', 'Nikita', 'Zoya', 'Elina', 'Sasha', 'Nadia',
  'Selin', 'Milena', 'Bogdan', 'Dragana', 'Emilian', 'Franjo', 'Gordana', 'Ilja', 'Jadranka', 'Kazimierz',
  'Lidia', 'Miroslav', 'Nevena', 'Ondrej', 'Pavla', 'Radek', 'Slavica', 'Tadeusz', 'Vesna', 'Zdenek',
  'Agnieszka', 'Blaz', 'Cveta', 'Dusan', 'Ewa', 'Gyorgy', 'Hedvig', 'Ilona', 'Janos', 'Katalin',
  'Laszlo', 'Marek', 'Natalia', 'Oksana', 'Piotr', 'Ruzena', 'Stanislav', 'Tatiana', 'Vlad', 'Zsofia',
  'Anastasia', 'Borislav', 'Danica', 'Evgeni', 'Filip', 'Grigori', 'Irina', 'Jelena', 'Kostya', 'Ljuba',

  // --- Greece, Turkey, the Levant, the Gulf -------------------------------
  'Omar', 'Amina', 'Noor', 'Tariq', 'Yasmin', 'Leila', 'Malik', 'Zainab', 'Amir', 'Fatima',
  'Rashid', 'Yusuf', 'Karim', 'Naima', 'Bilal', 'Salma', 'Hamza', 'Rania', 'Darius', 'Cyprian',
  'Adnan', 'Basma', 'Dalia', 'Elias', 'Farid', 'Ghada', 'Hisham', 'Iman', 'Jamal', 'Khalil',
  'Layla', 'Mounir', 'Nabil', 'Rasha', 'Sami', 'Tamer', 'Wafa', 'Yara', 'Ziad', 'Anoush',
  'Berk', 'Ceyda', 'Demir', 'Ece', 'Ferhat', 'Gizem', 'Hakan', 'Ilkay', 'Kerem', 'Melis',
  'Ozan', 'Pelin', 'Serkan', 'Tuna', 'Yalcin', 'Zehra', 'Alexios', 'Despina', 'Fotini', 'Iannis',
  'Kalliope', 'Lambros', 'Myrto', 'Nikos', 'Panagiota', 'Stavros', 'Thanos', 'Vasiliki', 'Xanthe', 'Zoi',

  // --- South & Central Asia -----------------------------------------------
  'Priya', 'Rohan', 'Arjun', 'Ravi', 'Sanjay', 'Indira', 'Ishaan', 'Priyanka', 'Roshan', 'Sina',
  'Aarti', 'Bhavna', 'Chetan', 'Divya', 'Farhan', 'Gita', 'Harpreet', 'Jaya', 'Kiran', 'Lakshmi',
  'Manju', 'Nikhil', 'Padma', 'Rekha', 'Sunil', 'Tara', 'Uma', 'Vikram', 'Yash', 'Zara',
  'Anjali', 'Balraj', 'Deepa', 'Girish', 'Hemant', 'Jasleen', 'Kavita', 'Mohan', 'Neelam', 'Pallavi',
  'Rajiv', 'Shalini', 'Tanvir', 'Varun', 'Aziza', 'Bekzod', 'Dilnoza', 'Farrukh', 'Gulnara', 'Jamshid',
  'Nargis', 'Rustam', 'Shirin', 'Timur', 'Zarina', 'Parviz', 'Laleh', 'Kaveh', 'Mitra', 'Behrouz',

  // --- East & Southeast Asia ----------------------------------------------
  'Yuki', 'Kenji', 'Mei', 'Jun', 'Hana', 'Aki', 'Suki', 'Kian', 'Akira', 'Chiyo',
  'Daichi', 'Emi', 'Fumiko', 'Haruki', 'Ichiro', 'Junko', 'Kaoru', 'Michiko', 'Noboru', 'Reiko',
  'Satoshi', 'Takumi', 'Yoko', 'Bao', 'Chun', 'Fang', 'Guo', 'Hui', 'Jia', 'Lian',
  'Ming', 'Ping', 'Qiang', 'Rong', 'Shan', 'Wei', 'Xiu', 'Yun', 'Zhen', 'Bora',
  'Dae', 'Eunji', 'Haneul', 'Jisoo', 'Minho', 'Seojun', 'Yerin', 'Anh', 'Duc', 'Hien',
  'Linh', 'Nguyet', 'Quang', 'Thao', 'Trang', 'Vinh', 'Amihan', 'Bayani', 'Dalisay', 'Ligaya',
  'Marikit', 'Tala', 'Adit', 'Cahaya', 'Dewi', 'Rahman', 'Siti', 'Wayan', 'Intan', 'Bagus',

  // --- Africa ---------------------------------------------------------------
  'Aisha', 'Kwame', 'Emeka', 'Ayana', 'Imani', 'Kojo', 'Onyeka', 'Amara', 'Idris', 'Naomi',
  'Abeni', 'Chidi', 'Dayo', 'Ekene', 'Folake', 'Gbenga', 'Ifeoma', 'Jelani', 'Kehinde', 'Lulu',
  'Makena', 'Nneka', 'Obi', 'Sade', 'Tendai', 'Uzoma', 'Wanjiku', 'Yaa', 'Zola', 'Adaeze',
  'Bakari', 'Chiamaka', 'Dumisani', 'Esi', 'Fikile', 'Gugu', 'Hodan', 'Jamila', 'Kofi', 'Lerato',
  'Mandla', 'Nadifa', 'Oumar', 'Rasheeda', 'Sipho', 'Thandiwe', 'Ubah', 'Yewande', 'Zuri', 'Abdi',
  'Baraka', 'Chinedu', 'Fatoumata', 'Habiba', 'Kaleb', 'Mariama', 'Ngozi', 'Ousmane', 'Sekou', 'Tarik',

  // --- The Americas beyond the US, the Caribbean, the Pacific -------------
  'Mateo', 'Camila', 'Rafaela', 'Sebastián', 'Valentina', 'Xiomara', 'Yolanda', 'Andres', 'Belen', 'Catalina',
  'Emiliano', 'Fernanda', 'Guillermo', 'Ines', 'Julieta', 'Lautaro', 'Micaela', 'Nicolás', 'Ramiro', 'Soledad',
  'Anansi', 'Delroy', 'Errol', 'Junior', 'Marcia', 'Nestor-Rae', 'Winston', 'Yolande', 'Ariki', 'Hine',
  'Kahu', 'Manaia', 'Ngaire', 'Rawiri', 'Tane', 'Whetu', 'Sione', 'Tevita', 'Lani', 'Keanu',
  'Malia', 'Nohea', 'Alofa', 'Fetu', 'Mele', 'Talia', 'Tui', 'Vaea', 'Iolana', 'Kalani',
];

export const TALENT_LAST_NAMES: string[] = [
  // --- Britain & Ireland ---------------------------------------------------
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

  // --- North America -------------------------------------------------------
  'Ackerly', 'Boone', 'Cutshaw', 'Dunphy', 'Eastland', 'Frawley', 'Grubbs', 'Hollingsworth', 'Ivey', 'Jessup',
  'Kessler', 'Ledbetter', 'Mabry', 'Nunnally', 'Odom', 'Purvis', 'Quarles', 'Renfro', 'Stapleton', 'Tatum',
  'Upshaw', 'Vandergriff', 'Whitlock', 'Yeager', 'Ansley', 'Bardwell', 'Crenshaw', 'Dillard', 'Eubanks', 'Fairchild',
  'Gaskins', 'Hargrove', 'Isbell', 'Jernigan', 'Kirkland', 'Lassiter', 'Mendenhall', 'Northcutt', 'Oldham', 'Pettigrew',
  'Rowland', 'Sizemore', 'Threadgill', 'Vestal', 'Waddell', 'Yancey', 'Applewhite', 'Bledsoe', 'Culpepper', 'Doss',
  'Ellington', 'Fortenberry', 'Gainey', 'Hollandsworth', 'Inman', 'Jolley', 'Kimbrough', 'Loveless', 'Muncy', 'Nettles',
  'Overstreet', 'Pilcher', 'Ridgeway', 'Sherrill', 'Tolliver', 'Vaughters', 'Whitten', 'Youngblood', 'Ballinger', 'Cobb',

  // --- France, Iberia, Italy ----------------------------------------------
  'Auclair', 'Bellamy', 'Chastain', 'Devereux', 'Escoffier', 'Fontaine', 'Gaudreau', 'Hachette', 'Jourdain', 'Lacroix',
  'Marchetti', 'Nadeau', 'Ormont', 'Pelletier', 'Quesnel', 'Rousseau', 'Sabatier', 'Thibodeaux', 'Vaillancourt', 'Beauchamp',
  'Charbonneau', 'Delacroix', 'Estienne', 'Fournier', 'Granger', 'Hebert', 'Lamarche', 'Montclair', 'Perreault', 'Rivard',
  'Aguilar', 'Barrantes', 'Cabrera', 'Delgado', 'Escamilla', 'Fuentes', 'Gallardo', 'Herrera', 'Ibarra', 'Jaramillo',
  'Lozano', 'Madrigal', 'Nieves', 'Olmedo', 'Palacios', 'Quintana', 'Rosales', 'Salazar', 'Trevino', 'Urrutia',
  'Valdivia', 'Zamora', 'Almeida', 'Bettencourt', 'Carvalho', 'Esteves', 'Figueiredo', 'Guimaraes', 'Loureiro', 'Marinho',
  'Nogueira', 'Pacheco', 'Queiroz', 'Rebelo', 'Sampaio', 'Teixeira', 'Vasconcelos', 'Barbieri', 'Castellano', 'Danesi',
  'Esposito', 'Falconieri', 'Gagliardi', 'Lombardi', 'Marchesi', 'Nicolosi', 'Orsini', 'Petrucci', 'Rinaldi', 'Sartori',
  'Tosatti', 'Vaccaro', 'Zangrilli', 'Bellucci', 'Cavallo', 'Ferraro', 'Grimaldi', 'Lanzetti', 'Montalto', 'Ricciardi',

  // --- Germany, Low Countries, Nordics ------------------------------------
  'Achterberg', 'Brandt', 'Diefenbach', 'Ehrlich', 'Fassbinder', 'Grunewald', 'Hoffmeister', 'Kellerman', 'Lindqvist', 'Mauer',
  'Neuhaus', 'Osterhagen', 'Pfeiffer', 'Reinholt', 'Schilling', 'Trautwein', 'Ulbrecht', 'Vogelsang', 'Weissmuller', 'Zeitler',
  'Bergstrom', 'Dahlgren', 'Ekstrand', 'Falkenberg', 'Gustafsen', 'Halvorsen', 'Ingebretsen', 'Kvalheim', 'Lindahl', 'Malmgren',
  'Nordstrom', 'Ostergaard', 'Rasmussen', 'Sandvik', 'Thorsen', 'Vinterberg', 'Aabye', 'Bjornstad', 'Dahlberg', 'Engstrom',
  'Fjeldstad', 'Grimstad', 'Hallstrom', 'Jorgensen', 'Kirkeby', 'Lindberg', 'Mikkelsen', 'Nyquist', 'Ravnsborg', 'Sundqvist',
  'Bakhuizen', 'Coppens', 'Dekkers', 'Eikelboom', 'Groeneveld', 'Hoogendijk', 'Kuiperman', 'Lindeboom', 'Meulenbelt', 'Oosterhuis',
  'Rijkaard', 'Steenbergen', 'Vandenbroek', 'Wijnands', 'Zeelenberg', 'Buitendijk', 'Doornbos', 'Haverkamp', 'Verstegen', 'Zwanenburg',

  // --- Central & Eastern Europe, the Balkans ------------------------------
  'Andreyev', 'Bakhmetev', 'Chernyshov', 'Dubrovin', 'Yefimov', 'Golitsyn', 'Ignatiev', 'Kalinin', 'Lebedev', 'Miloradov',
  'Nesterov', 'Ostrovsky', 'Pankratov', 'Rozhdestvensky', 'Sokolov', 'Turgenev', 'Vasiliev', 'Yablokov', 'Zhukovsky', 'Bazhenov',
  'Czerniak', 'Dabrowski', 'Grabowski', 'Jablonski', 'Kowalczyk', 'Lewandowski', 'Michalski', 'Nowicki', 'Pietrzak', 'Rutkowski',
  'Sadowski', 'Tomaszewski', 'Wisniewski', 'Zielinski', 'Balog', 'Csanyi', 'Dobrev', 'Farkas', 'Horvath', 'Kovacs',
  'Lukacs', 'Nemeth', 'Petrovic', 'Radulescu', 'Stoyanov', 'Takacs', 'Vukovic', 'Zsigmond', 'Antonescu', 'Bogdanovic',
  'Dimitrov', 'Grozdanov', 'Ilievski', 'Jovanovic', 'Krstic', 'Marinescu', 'Novakovic', 'Popescu', 'Simeonov', 'Todorovic',

  // --- Greece, Turkey, the Levant, the Gulf -------------------------------
  'Alexopoulos', 'Diamantis', 'Fotiadis', 'Giannakos', 'Hatzis', 'Kanellos', 'Lambrakis', 'Mavridis', 'Nikolaidis', 'Pappas',
  'Sarantos', 'Theodorou', 'Vlachos', 'Xenakis', 'Zervas', 'Andronikos', 'Christoforou', 'Dendrinos', 'Kalogeras', 'Stamatis',
  'Akkaya', 'Bayrakdar', 'Cetinkaya', 'Demirel', 'Erdogmus', 'Gunduz', 'Kilicaslan', 'Ozdemir', 'Sahinkaya', 'Yildirim',
  'Abadi', 'Baroudi', 'Chalhoub', 'Dagher', 'Fakhoury', 'Ghanem', 'Haddad', 'Jabbour', 'Khoury', 'Mansour',
  'Nassar', 'Rahal', 'Sabbagh', 'Tannous', 'Zaghloul', 'Alkhatib', 'Barakat', 'Darwish', 'Farouk', 'Halabi',
  'Amirkhani', 'Bahrami', 'Delavari', 'Esfandiari', 'Ghorbani', 'Hosseinzadeh', 'Jahangiri', 'Kermani', 'Mirzaei', 'Nourbakhsh',

  // --- South & Central Asia -----------------------------------------------
  'Achari', 'Bhattacharya', 'Chandrasekar', 'Deshmukh', 'Gopalakrishnan', 'Hiremath', 'Iyengar', 'Jhaveri', 'Kulkarni', 'Lakshmanan',
  'Mahadevan', 'Narayanan', 'Padmanabhan', 'Raghunathan', 'Sundaram', 'Thiruvengadam', 'Venkataraman', 'Balasubramanian', 'Chakraborty', 'Dasgupta',
  'Gangopadhyay', 'Krishnamurthy', 'Mukhopadhyay', 'Parthasarathy', 'Ramaswamy', 'Subramaniam', 'Vaidyanathan', 'Ahluwalia', 'Bhandari', 'Chaudhary',
  'Dhillon', 'Grewal', 'Kohli', 'Mahajan', 'Randhawa', 'Sabharwal', 'Talwar', 'Virk', 'Abbasi', 'Chowdhury',
  'Faruqui', 'Hashmi', 'Jafri', 'Khalilzad', 'Mirbagheri', 'Qureshi', 'Rahimi', 'Siddiqui', 'Zaidi', 'Nazarbek',
  'Abdullayev', 'Ergashev', 'Karimov', 'Rakhmonov', 'Turgunbek', 'Yusupov', 'Bekmurodov', 'Sattarov', 'Umarov', 'Nurlanov',

  // --- East & Southeast Asia ----------------------------------------------
  'Akiyama', 'Fujimori', 'Hasegawa', 'Ishiguro', 'Kawabata', 'Matsushima', 'Nakagawa', 'Okonogi', 'Shimomura', 'Takahashi',
  'Uchiyama', 'Watanabe', 'Yamashiro', 'Kuroshima', 'Morimoto', 'Nishikawa', 'Sakaguchi', 'Tsukamoto', 'Yoshinaga', 'Hiraoka',
  'Cheung', 'Fong', 'Guan', 'Huang', 'Jiang', 'Kwok', 'Liang', 'Ouyang', 'Qiao', 'Shen',
  'Tang', 'Wong', 'Xie', 'Yeung', 'Zhao', 'Situ', 'Duanmu', 'Nangong', 'Zhuge', 'Murong',
  'Baek', 'Choe', 'Hwang', 'Jeong', 'Kwon', 'Moon', 'Namgung', 'Seok', 'Yoon', 'Jang',
  'Bui', 'Dang', 'Hoang', 'Luong', 'Ngo', 'Phan', 'Trinh', 'Vuong', 'Doan', 'Truong',
  'Abueva', 'Batungbakal', 'Dimaculangan', 'Fernandez', 'Magsaysay', 'Pangilinan', 'Salonga', 'Tolentino', 'Villanueva', 'Hidayat',
  'Kusumo', 'Prabowo', 'Santoso', 'Wibowo', 'Halimah', 'Rahardjo', 'Sutrisno', 'Nurhaliza', 'Chaiyaporn', 'Suwannachot',

  // --- Africa ---------------------------------------------------------------
  'Abiodun', 'Balogun', 'Chukwuma', 'Danjuma', 'Eneh', 'Falade', 'Gbadamosi', 'Ihenacho', 'Jideofor', 'Kalejaiye',
  'Lawal', 'Madueke', 'Nwachukwu', 'Obiora', 'Ogunsanya', 'Sowande', 'Uchendu', 'Yakubu', 'Adeyemi', 'Babatunde',
  'Chigozie', 'Emeagwali', 'Ifeanyi', 'Nwankwo', 'Okonjo', 'Olayinka', 'Onwuachi', 'Ezenwa', 'Asante', 'Boateng',
  'Darko', 'Frimpong', 'Gyasi', 'Mensah', 'Nkrumah', 'Opoku', 'Owusu', 'Quartey', 'Sarpong', 'Yeboah',
  'Cisse', 'Diallo', 'Fofana', 'Keita', 'Konate', 'Ndiaye', 'Sangare', 'Toure', 'Traore', 'Camara',
  'Achieng', 'Kamau', 'Kiprotich', 'Mwangi', 'Njoroge', 'Ochieng', 'Otieno', 'Wanjala', 'Abdulle', 'Farah',
  'Dlamini', 'Khumalo', 'Mabaso', 'Ndlovu', 'Nkosi', 'Sithole', 'Tshabalala', 'Zwane', 'Mokoena', 'Radebe',
  'Bekele', 'Gebremariam', 'Haile', 'Tesfaye', 'Woldemariam', 'Zerihun', 'Abrahams', 'Chikondi', 'Mwale', 'Banda',

  // --- The Americas beyond the US, the Caribbean, the Pacific -------------
  'Alcantara', 'Bustamante', 'Carrasquillo', 'Dominguez', 'Echeverria', 'Figueroa', 'Guzman', 'Irizarry', 'Landaverde', 'Montenegro',
  'Nunez', 'Oquendo', 'Portillo', 'Quinonez', 'Rodriguez', 'Santamaria', 'Villalobos', 'Zavaleta', 'Betancourt', 'Cifuentes',
  'Escalante', 'Hinojosa', 'Maldonado', 'Peralta', 'Sepulveda', 'Urdaneta', 'Zeledon', 'Beaubrun', 'Cadet', 'Desrosiers',
  'Jean-Baptiste', 'Pierre-Louis', 'Toussaint', 'Blackman', 'Chevannes', 'Grandison', 'Marchand', 'Nembhard', 'Sealy', 'Vassell',
  'Ngata', 'Rangi', 'Tamati', 'Waititi', 'Whanau', 'Hokianga', 'Kereopa', 'Manukau', 'Paniora', 'Ruatara',
  'Faletau', 'Havili', 'Latu', 'Naivalu', 'Ratuvou', 'Tuilagi', 'Vakatawa', 'Kealoha', 'Makuakane', 'Kahananui',
];
