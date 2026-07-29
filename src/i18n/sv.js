/**
 * Swedish — the default.
 *
 * Uses the terminology Swedish schools actually use, not literal translations:
 * "tiokompisar" for number bonds to ten, "hoppräkna" for skip counting,
 * "minnessiffra" for a carry, "låna" for borrowing. A child should recognise
 * the words from their maths lesson.
 */
export default {
  common: {
    back: '← Tillbaka',
    done: '← Klar',
    menu: '🏠 Meny',
  },

  ops: {
    addition: 'Addition',
    subtraction: 'Subtraktion',
    multiplication: 'Multiplikation',
    division: 'Division',
  },

  menu: {
    title: '⚽ Mattemästarna',
    subtitle: 'Träna som proffsen — gör mål på planen och i matten ⚽',
    play: 'Spela',
    changePlayer: '👕 Byt spelare',
    stats: '🏆 Min statistik',
    goals: '⚽ Mål',
    factsKnown: '🧠 Kan utantill',
    soundOn: '🔊 Ljud på',
    soundOff: '🔇 Ljud av',
  },

  mode: {
    title: 'Välj träning',
    subtitle: 'Vad ska vi köra på idag?',
    progress: '{pct}% av vägen',
    opensAt: 'Öppnas vid {n} rätt',
    tryAnyway: 'Testa ändå →',
    shootout: '⏱️ Straffläggning',
    shootoutNote: '⏱️ Straffläggning: domaren tar tiden. Samma matte, mer drama. Har du rätt gör du mål — varje gång.',
  },

  roster: {
    title: 'Välj din spelare',
    subtitle: 'Alla är med i truppen. Byt hur ofta du vill!',
  },

  game: {
    kickOf: '{n}/{total}',
    showTrick: '🧠 Tipsa mig!',
    clockOff: '🏳️ Ta bort klockan',
    paused: 'Pausad',
    ready: 'Klar',
    goal: '⚽ MÅÅÅL!',
    goalScreamer: '⚽ OSTOPPBART! Rakt i krysset!',
    goalGlove: '⚽ MÅL! Han nuddade den — men in gick den!',
    goalRebound: '⚽ RETURMÅL! Du snappade knepet och satte den.',
    goalRetake: '⚽ Mål på omtagningen. Matten var rätt — klockan var bara snabb.',
    parried: '🧤 Retur! Bollen lever — kör igen!',
    reveal: 'Svaret är {ans}. Tryck på det — då kommer hjärnan ihåg det.',
    revealDone: 'Bra. Vi tar {ans} en gång till lite senare.',
    timeout: '⏱️ Pip! Ta straffen ändå — utan klocka den här gången.',
    streak: '🔥 {n} i rad!',
    dotsLabel: 'Straff {n} av {total}. {results}',
    noKicks: 'Inga straffar lagda än.',
    resultGoal: 'mål',
    resultRebound: 'returmål',
    resultMiss: 'räddad',
  },

  result: {
    nextRound: '▶ Nästa omgång',
    changeTraining: 'Byt träning',
    brainPoints: '🧠 Hjärnpoäng',
    brainPointsNote: 'Hjärnpoäng får man bara av de svåra. Snyggt jobbat.',
    fromRebound: '{n} på returen. ',
    retakes: '{n} omtagning(ar).',
    clockWon: '⏱️ Klockan vann den där — inte matten.',
    clockWonMsg: 'Du hade rätt på {n} av dem så fort pipet tystnade. Det är att kunna. Klockan var bara för snabbt ställd.',
    moreTime: 'Ja, ge mig mer tid',
    starsLabel: '{n} av 3 stjärnor',
  },

  stars: {
    s5: { title: '🏆 Fem av fem', msg: 'Du höll fokus varenda straff. Det kräver riktig koncentration.' },
    s4: { title: '🎯 Fyra mål', msg: 'Dina knep fungerar. Den som slank förbi är värd en titt till.' },
    s3: { title: '⚽ Tre mål', msg: 'Fler in än ut. Vilken straff kändes knepigast?' },
    s2: { title: '💪 Två mål, tre tal tränade', msg: 'De du missade är precis de som hjärnan bygger just nu.' },
    s1: { title: '🧠 Du tog ett och fortsatte', msg: 'Att hålla ut en svår omgång är det som gör dig bättre.' },
    s0: { title: '🧠 Tuff omgång — du gjorde klart den', msg: 'De här talen är fortfarande nya. Kör samma fem igen och se vad som händer.' },
  },

  trophy: {
    title: '🏆 Din statistik',
    goalsScored: 'Mål gjorda',
    factsKnown: 'Tal du kan direkt',
    bestRun: '🔥 Bästa svit',
    inARow: 'i rad',
    whereUpTo: 'Så här långt har du kommit',
    firstTry: '{n} av de senaste {total} rätt på första försöket',
    workingOn: 'Tränar på',
    tryLabel: 'testa:',
    reset: 'Nollställ framsteg',
    resetConfirm: 'Nollställa alla framsteg? Det går inte att ångra.',
    language: 'Språk',
  },

  rivals: {
    red_devil:  'Röda Djävulen',
    white_wall: 'Vita Muren',
    blaugrana:  'Katalanska Muren',
    gunner:     'Kanonjären',
    dynamite:   'Dynamiten',
  },

  fixture: {
    label: '🧤 Derbyt',
    note: 'I derbyt väljer {rival} frågorna — han tar dina knepigaste. Han väljer aldrig utgången. Har du rätt gör du mål.',
    intro: '{rival} har plockat ut fem kluriga. Redo?',
    picked: '{rival} valde de här.',
    goalNod: '{rival} nickar. Den gick inte att ta.',
    won: 'Du vann mötet. {n} av {total} förbi {rival}.',
    low: 'Fem skott, fem försök. De som gled undan kommer tillbaka.',
    ledger: 'Du har vunnit {n} möten mot {rival}.',
    next: 'Nästa möte: {rival}.',
    off: 'Träning utan motståndare',
  },

  banter: {
    greet: [
      '{rival}: "Jag har värmt upp handskarna. Kom igen!"',
      '{rival}: "Fem skott. Jag är redo när du är."',
      '{rival}: "Kul att ses igen. Visa vad du kan!"',
    ],
    beaten: [
      '{rival}: "Den var för bra för mig."',
      '{rival}: "Snyggt! Den fick jag aldrig tag i."',
      '{rival}: "Oj. Den satt."',
    ],
    wonTie: [
      '{rival} ger dig en high five. "Bra spelat. Vi ses i returmatchen!"',
      '{rival}: "Du var vass idag. Grattis!"',
    ],
    closeTie: [
      '{rival}: "Tack för matchen. Jag väntar här när du vill igen."',
      '{rival}: "Bra kämpat. Samma tid nästa gång?"',
    ],
  },

  map: {
    title: '🌱 Din plan',
    grown: '{n} av {total} rutor odlade',
    gridLabel: 'Kartan över {op}',
    cellLabel: '{fact}, ruta {box} av 5',
    unplanted: 'Osådd',
    growing: 'Växer',
    solid: 'Sitter',
    bigNumbers: 'Större tal',
    practise: 'Träna den här',
    close: 'Stäng',
    open: '🌱 Se din plan',
    menuSummary: '{n} av {total} tal sitter säkert',
  },

  season: {
    title: '🏆 Säsong {n}',
    subtitle: 'Fyra turneringar. En motståndare i varje.',
    allClear: 'Alla fyra klara! Nästa säsong väntar.',
    cups: '{n} vunna säsonger',
    tieProgress: '{n} av {total} vinster i mötet',
    playTie: 'Spela',
    strip: 'Säsong {n} · {comp}',
    comp: {
      cup:    'Cupen',
      league: 'Ligan',
      europe: 'Europacupen',
      final:  'Finalen',
    },
    tieWon: '🏆 Du tog mötet mot {rival}!',
    seasonWon: '🏆🏆 Säsong {n} avklarad! Alla fyra turneringar vunna.',
  },

  unlock: '🔓 {icon} {name} upplåst!',

  /* ── KNEP ───────────────────────────────────────────────── */
  hint: {
    add: {
      bondToTen:   { label: 'Tiokompisar', steps: '{a} och {b} är tiokompisar — bra att kunna utantill' },
      justOneMore: { label: 'Bara en till', steps: '{max}, räkna sedan upp {min}' },
      double:      { label: 'Det är dubbelt', steps: '{a} och {a} — dubbelt går snabbt' },
      nearDouble:  { label: 'Nästan dubbelt', steps: '{min}+{min}={dbl}, sedan en till' },
      nineTrick:   { label: 'Nio-knepet', steps: '{other}+10={plusTen}, ta sedan bort 1' },
      addTen:      { label: 'Lägg till tio', steps: 'Bara tiotalssiffran ändras' },
      makeTen:     { label: 'Gör tio först', steps: '{a}+{toTen}=10, sedan +{rest}={ans}' },
      splitUp:     { label: 'Dela upp talet', steps: '{aT}+{bT}={tens}, {aO}+{bO}={onesSum}, lägg ihop' },
      countOn:     { label: 'Räkna uppåt', steps: 'Börja på {max}, räkna upp {min}' },
    },
    sub: {
      takeNothing: { label: 'Ta bort ingenting', steps: 'Inget försvinner, inget ändras' },
      allOfIt:     { label: 'Allt på en gång', steps: 'Ta bort allt — noll kvar' },
      countUp:     { label: 'Räkna uppåt', steps: 'Från {b} upp till {a} är {ans} steg' },
      nineTrick:   { label: 'Nio-knepet', steps: 'Ta bort 10 → {minusTen}, lägg sedan tillbaka 1' },
      takeTens:    { label: 'Ta bort tiotal', steps: 'Bara tiotalssiffran ändras' },
      downToTen:   { label: 'Ner till tio', steps: '{a}−{aO}=10, sedan −{rest}={ans}' },
      splitUp:     { label: 'Dela upp talet', steps: '{aT}−{bT}={tens}, {aO}−{bO}={onesDiff}' },
      countUpEnd:  { label: 'Räkna uppåt', steps: 'Börja på {b}, hoppa upp till {a}' },
    },
    mul: {
      flip:            'Vänd på det: {hi}×{lo}. ',
      zeroGroups:      { label: 'Noll grupper', steps: 'Inga grupper alls — det blir 0' },
      oneGroup:        { label: 'En grupp', steps: 'En grupp med {hi} är {hi}' },
      doubleIt:        { label: 'Dubbla', steps: '{hi}+{hi}={ans}' },
      timesTen:        { label: 'Gånger tio', steps: '{hi} med en nolla efter' },
      halfOfTen:       { label: 'Hälften av tio', steps: '{hi}×10={x10}, hälften är {ans}' },
      oneGroupLess:    { label: 'En grupp mindre', steps: '{hi}×10={x10}, ta bort {hi}' },
      doubleDouble:    { label: 'Dubbla två gånger', steps: '{hi}+{hi}={x2}, {x2}+{x2}={ans}' },
      doubleThrice:    { label: 'Dubbla tre gånger', steps: '{hi}→{x2}→{x4}→{ans}' },
      doublePlusOne:   { label: 'Dubbla plus en', steps: '{hi}×2={x2}, plus {hi} blir {ans}' },
      fivePlusOne:     { label: 'Fem plus en', steps: '{hi}×5={x5}, plus {hi} blir {ans}' },
      fivePlusTwo:     { label: 'Fem plus två', steps: '{hi}×5={x5}, {hi}×2={x2}, lägg ihop' },
      skipCount:       { label: 'Hoppräkna', steps: 'Räkna med {lo}: {lo}, {s2}, {s3}…' },
    },
    div: {
      splitByOne:  { label: 'Dela med ett', steps: 'En grupp — det blir kvar {a}' },
      oneEach:     { label: 'En var', steps: '{a} i grupper om {a} blir 1' },
      halveIt:     { label: 'Ta hälften', steps: 'Hälften av {a} är {ans}' },
      divideByTen: { label: 'Dela med tio', steps: 'Ta bort nollan: {a} → {ans}' },
      skipCount:   { label: 'Hoppräkna', steps: '{b}, {s2}, {s3}… hur många för att nå {a}?' },
      flipIt:      { label: 'Vänd på det', steps: '{b} × ? = {a}. Samma tal, baklänges.' },
    },
    generic: { label: 'Tänk igenom det', steps: 'Ta ett steg i taget' },
  },

  /* ── DIAGNOSER ──────────────────────────────────────────
     Beskriver vart talet tog vägen, aldrig barnet. */
  diag: {
    ADD_CARRY_DROP:          'Så nära — minnessiffran blev kvar.',
    ADD_CONCAT:              'Tiotalen och entalen skrevs bredvid varandra i stället för att läggas ihop.',
    ADD_DOUBLE_PULL:         'Det är dubbelt. De här två skiljer sig med ett, så det blir ett mer.',
    ADD_ROUND_NO_ADJUST:     'Smart att runda upp — ta nu bort det extra igen.',
    ADD_OP_CONFUSION:        'Det är skillnaden. Här ska det vara plus.',
    ADD_BRIDGE_SLIP:         'Rätt tänkt över tiotalet — bara ett steg fel.',
    ADD_COUNT_ON:            'Ett steg fel. Räkna en gång till.',
    SUB_SMALLER_FROM_LARGER: 'Entalen byttes om. Du får ta det större från det mindre — låna ett tiotal.',
    SUB_BORROW_NO_DECREMENT: 'Du lånade ett tiotal, men tiotalen behöll det också.',
    SUB_ZERO_BUG:            'Det finns inget att ta från i entalen — låna ett tiotal först.',
    SUB_OP_CONFUSION:        'Det är summan. Här ska något tas bort.',
    SUB_DECREMENT_ONLY:      'Ett helt tiotal försvann där.',
    SUB_COUNT_BACK:          'Ett steg fel. Räkna bakåt en gång till.',
    MUL_SQUARE_PULL:         'Det är kvadraten bredvid. De här två skiljer sig med ett.',
    MUL_ADJACENT_MULTIPLE:   'En grupp för mycket eller för lite — räkna grupperna igen.',
    MUL_NINE_SHORTCUT:       'Gånger tio var rätt början — ta nu bort en grupp.',
    MUL_HALF_TABLE:          'Det är hälften. En dubbling kvar.',
    MUL_DIGIT_REVERSAL:      'Rätt siffror — bara omvänd ordning.',
    MUL_OP_CONFUSION:        'Det är summan. Här handlar det om grupper av.',
    MUL_IDENTITY_BUG:        'Se upp med noll och ett — de har egna regler.',
    DIV_SWAP_OPERANDS:       'Det är hur många som är i varje grupp, inte hur många grupper.',
    DIV_SKIP_MISCOUNT:       'En grupp fel — hoppräkna en gång till.',
    DIV_HALF_ERROR:          'Det är dubbelt så mycket som svaret — en halvering saknas.',
    DIV_OP_CONFUSION:        'Det är skillnaden. Här ska det delas upp.',
    DIV_ECHO_DIVIDEND:       'Det är talet du började med, innan du delade.',
  },

  /* ── TEXTUPPGIFTER ─────────────────────────────────────── */
  word: {
    addition: [
      '{p1} gjorde {a} mål. {p2} gjorde {b}. Hur många mål tillsammans?',
      '{team} hade {a} supportrar. Sedan kom {b} till. Hur många nu?',
    ],
    subtraction: [
      '{team} sålde {a} biljetter. {b} lämnades tillbaka. Hur många är kvar?',
      '{p1} sköt {a} skott och missade {b}. Hur många gick in?',
    ],
    subtractionCompare: [
      '{p1} har {a} kort, {p2} har {b}. Hur många fler har {p1}?',
    ],
    multiplication: [
      '{a} lag med {b} spelare i varje. Hur många spelare?',
      '{p1} gör {b} mål varje match. Hur många efter {a} matcher?',
      'Läktaren har {a} rader med {b} platser. Hur många platser?',
    ],
    division: [
      '{a} bollar delas lika i {b} påsar. Hur många i varje påse?',
      '{a} spelare bildar lag om {b}. Hur många lag?',
    ],
  },
}
