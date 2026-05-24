// 4 themed variations of the LiD trainer question card.
// All show the same Q2 in Learn mode (correct answer revealed).
// Differences: color palette, corner radii, Tabler-style icons.

const Q = {
  num: 2,
  category: "Gesellschaft und Familie",
  q: "In Deutschland können Eltern bis zum 14. Lebensjahr ihres Kindes entscheiden, ob es in der Schule am …",
  qEn: "In Germany, parents can decide until their child is 14 whether it takes part at school in …",
  options: [
    "Geschichtsunterricht teilnimmt.",
    "Religionsunterricht teilnimmt.",
    "Politikunterricht teilnimmt.",
    "Sprachunterricht teilnimmt.",
  ],
  optionsEn: [
    "history class.", "religion class.", "politics class.", "language class.",
  ],
  correct: 1,
  hint: "Religion class is the optional one — parents decide until the child is 14. Everything else is mandatory.",
  keywords: [
    { de: "Religionsunterricht", en: "religious education" },
    { de: "14. Lebensjahr", en: "14th year of life" },
  ],
};

const CATS = [
  { de: "Alle Kategorien",          en: "ALL CATEGORIES" },
  { de: "Grundrechte",              en: "FUNDAMENTAL RIGHTS" },
  { de: "Gesellschaft und Familie", en: "SOCIETY & FAMILY" },
  { de: "Politik in der Demokratie",en: "POLITICS & DEMOCRACY" },
  { de: "Geschichte und Verantwortung", en: "HISTORY" },
  { de: "Rechtsstaat",              en: "RULE OF LAW" },
];

// ──────────────────────────────────────────────
// Tabler-style icons (1.5px stroke, rounded ends)
// ──────────────────────────────────────────────
function Svg({ size = 18, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );
}
const I = {
  shuffle: (p) => <Svg {...p}>
    <path d="M18 4l3 3l-3 3"/><path d="M18 20l3 -3l-3 -3"/>
    <path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5"/>
    <path d="M21 7h-5a5 5 0 0 0 -3 1m-4 8a5 5 0 0 1 -3 1h-3"/>
  </Svg>,
  star: (p) => <Svg {...p}>
    <path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>
  </Svg>,
  starFilled: (p) => <Svg {...p}>
    <path fill="currentColor" stroke="currentColor" d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/>
  </Svg>,
  check: (p) => <Svg {...p}><path d="M5 12l5 5l10 -10"/></Svg>,
  x: (p) => <Svg {...p}><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></Svg>,
  arrowLeft: (p) => <Svg {...p}>
    <path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/>
  </Svg>,
  arrowRight: (p) => <Svg {...p}>
    <path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/>
  </Svg>,
  book: (p) => <Svg {...p}>
    <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/>
    <path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/>
    <path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>
  </Svg>,
  flask: (p) => <Svg {...p}>
    <path d="M9 3l6 0"/><path d="M10 9l4 0"/>
    <path d="M10 3v6l-4 11a.7 .7 0 0 0 .5 1h11a.7 .7 0 0 0 .5 -1l-4 -11v-6"/>
  </Svg>,
};

// Highlight keyword spans in text
function Hl({ text, keywords }) {
  if (!keywords?.length) return <>{text}</>;
  const terms = keywords.map(k => k.de).sort((a, b) => b.length - a.length);
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  return <>
    {text.split(re).map((p, i) =>
      terms.includes(p)
        ? <span className="kw" key={i}>{p}</span>
        : <React.Fragment key={i}>{p}</React.Fragment>
    )}
  </>;
}

// ──────────────────────────────────────────────
// Shared question card (palette comes from parent className)
// ──────────────────────────────────────────────
function VFrame({ activeCat = 2, mode = "learn", brandLabel = "LiD Trainer" }) {
  return (
    <div className="v-frame">
      <div className="v-top">
        <div className="v-brand">
          <span className="flag" aria-hidden="true"></span>
          {brandLabel}
        </div>
        <div className="v-mode">
          <button className={mode === "learn" ? "on" : ""}>
            <span className="icon">{I.book({size:13})}</span>Learn
          </button>
          <button className={mode === "test" ? "on" : ""}>
            <span className="icon">{I.flask({size:13})}</span>Test
          </button>
        </div>
      </div>

      <div className="v-pills">
        {CATS.map((c, i) => (
          <button key={i} className={'v-pill' + (i === activeCat ? ' on' : '')}>
            <span className="de">{c.de}</span>
            <span className="en">{c.en}</span>
          </button>
        ))}
      </div>

      <div className="v-card">
        <div className="v-meta">
          <span className="tag">FRAGE 002</span>
          <span>{Q.category.toUpperCase()}</span>
          <span className="grow"></span>
          <span className="progress">02<span className="of">/18</span></span>
        </div>
        <h2 className="v-q"><Hl text={Q.q} keywords={Q.keywords} /></h2>
        <p className="v-qen">{Q.qEn}</p>
        <ul className="v-ans">
          {Q.options.map((opt, i) => {
            const isOk = i === Q.correct;
            return (
              <li key={i}>
                <button className={isOk ? 'ok' : ''}>
                  <span className="text">
                    <Hl text={opt} keywords={Q.keywords} />
                    <span className="en">{Q.optionsEn[i]}</span>
                  </span>
                  <span className="mark">
                    {isOk ? I.check({size:18}) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="v-notes">
          <p className="v-hint"><Hl text={Q.hint} keywords={Q.keywords} /></p>
          <div className="v-kws">
            {Q.keywords.map((k, i) => (
              <span className="v-kw" key={i}>
                <span className="de">{k.de}</span>
                <span className="en">{k.en}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="v-nav">
        <button><span className="icon">{I.arrowLeft({size:16})}</span>Prev</button>
        <button aria-label="Shuffle"><span className="icon">{I.shuffle({size:16})}</span></button>
        <button className="known"><span className="icon">{I.star({size:14})}</span>Mark known</button>
        <button className="primary">Next<span className="icon">{I.arrowRight({size:16})}</span></button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="palettes"
        title="LiD Trainer — themed variations"
        subtitle="Same question, four palettes. Rounded corners + Tabler-style line icons. Click a card to focus full-size.">
        <DCArtboard id="v1" label="1 · Sage Notebook"
          width={390} height={820} style={{ background: '#fbf8ee' }}>
          <div className="v1" style={{ width: '100%', height: '100%' }}>
            <VFrame activeCat={2} brandLabel="LiD Trainer" />
          </div>
        </DCArtboard>
        <DCArtboard id="v2" label="2 · Berlin Indigo"
          width={390} height={820} style={{ background: '#faf8f0' }}>
          <div className="v2" style={{ width: '100%', height: '100%' }}>
            <VFrame activeCat={2} brandLabel="LiD Trainer" />
          </div>
        </DCArtboard>
        <DCArtboard id="v3" label="3 · Sunset Terracotta"
          width={390} height={820} style={{ background: '#fdf6ec' }}>
          <div className="v3" style={{ width: '100%', height: '100%' }}>
            <VFrame activeCat={2} brandLabel="LiD Trainer" />
          </div>
        </DCArtboard>
        <DCArtboard id="v4" label="4 · Midnight Study"
          width={390} height={820} style={{ background: '#1a1d24' }}>
          <div className="v4" style={{ width: '100%', height: '100%' }}>
            <VFrame activeCat={2} brandLabel="LiD Trainer" />
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
