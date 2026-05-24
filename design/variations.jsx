// 5 visual directions for the LiD trainer question card.
// All show the same question (Q2 — religion class) on a 390x844 phone frame
// in Learn mode (correct answer revealed) for fair comparison.

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
    "history class.",
    "religion class.",
    "politics class.",
    "language class.",
  ],
  correct: 1,
  keywords: [
    { de: "Religionsunterricht", en: "religious education class" },
    { de: "14. Lebensjahr", en: "14th year of life" },
  ],
};

// helper: highlight keywords in German text
function Hl({ text, keywords }) {
  if (!keywords?.length) return <>{text}</>;
  const terms = keywords.map(k => k.de).sort((a, b) => b.length - a.length);
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('(' + escaped.join('|') + ')', 'g');
  return <>
    {text.split(re).map((p, i) =>
      terms.includes(p)
        ? <span className="kw" key={i}>{p}</span>
        : <React.Fragment key={i}>{p}</React.Fragment>
    )}
  </>;
}

// ───────────────────────────────────────────────────────────
// V1 — Editorial paper (current direction, refined)
// ───────────────────────────────────────────────────────────
function V1Editorial() {
  return (
    <div className="v-frame v1">
      <div className="v1-top">
        <span className="brand">
          <span className="flag"></span>Leben in Deutschland
        </span>
        <span className="v1-mode">
          <button className="on">Learn</button>
          <button>Test</button>
        </span>
      </div>
      <div className="v1-sub">
        <span className="cat">Alle Kategorien</span>
        <span className="count">2<span className="of"> / 18</span></span>
      </div>
      <div className="v1-track"><span className="fill"></span></div>
      <div className="v1-card">
        <div className="v1-meta"><b>AUFGABE {Q.num}</b> · {Q.category.toUpperCase()}</div>
        <h2 className="v1-q"><Hl text={Q.q} keywords={Q.keywords} /></h2>
        <p className="v1-qen">{Q.qEn}</p>
        <ul className="v1-ans">
          {Q.options.map((o, i) => (
            <li key={i}>
              <button className={i === Q.correct ? 'ok' : ''}>
                <span className="letter">{String.fromCharCode(65+i)}</span>
                <span className="text">{o}<span className="en">{Q.optionsEn[i]}</span></span>
                <span className="mark">{i === Q.correct ? '✓' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="v1-hint"><a><span className="i">i</span>Why &amp; keywords</a></div>
      </div>
      <div className="v1-nav">
        <button>←</button>
        <button>Mark gewusst</button>
        <button className="primary">Weiter →</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// V2 — Workbook (lined notebook paper, textbook tone)
// ───────────────────────────────────────────────────────────
function V2Workbook() {
  return (
    <div className="v-frame v2">
      <div className="v2-head">
        <div className="stamp">Übungsheft · Kapitel 1</div>
        <div className="title">Leben in Deutschland</div>
        <div className="meta">Frage {Q.num} von 18 — {Q.category}</div>
      </div>
      <div className="v2-body">
        <p className="v2-q">
          <span className="v2-num">{Q.num}.</span>
          <Hl text={Q.q} keywords={Q.keywords} />
        </p>
        <p className="v2-qen">↳ {Q.qEn}</p>
        <ol className="v2-ans">
          {Q.options.map((o, i) => {
            const isOk = i === Q.correct;
            return (
              <li key={i}>
                <span className={'label' + (isOk ? ' label-correct' : '')}>{String.fromCharCode(97+i)})</span>
                <span>
                  <span className={isOk ? 'underline' : ''}>{o}</span>
                  <span className="en">{Q.optionsEn[i]}</span>
                </span>
                {isOk && <span className="tick">✓</span>}
              </li>
            );
          })}
        </ol>
        <div className="v2-foot">
          <span className="stickynote">
            <b>Merke:</b> Religion ist Wahlfach — only religion class is optional until age 14.
          </span>
        </div>
      </div>
      <div className="v2-nav">
        <button>← zurück</button>
        <span className="v2-progress">Seite 2 / 18</span>
        <button className="primary">weiter →</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// V3 — Bold poster (low density, hero, modernist)
// ───────────────────────────────────────────────────────────
function V3Poster() {
  return (
    <div className="v-frame v3">
      <div className="v3-top">
        <span className="num">FRAGE 02 / 18</span>
        <span className="modes">
          <span className="on">Learn</span>
          <span>Test</span>
        </span>
      </div>
      <div className="v3-body">
        <div className="v3-cat">{Q.category}</div>
        <h1 className="v3-q"><Hl text={Q.q} keywords={Q.keywords} /></h1>
        <p className="v3-qen">{Q.qEn}</p>
        <ul className="v3-ans">
          {Q.options.map((o, i) => {
            const isOk = i === Q.correct;
            return (
              <li key={i}>
                <button className={isOk ? 'ok' : ''}>
                  <span className="letter">{String.fromCharCode(65+i)}</span>
                  <span className="text">{o}<span className="en">{Q.optionsEn[i]}</span></span>
                  {isOk && <span className="mark">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="v3-bottom">
        <span className="progress">
          02
          <span className="dots">
            <span></span><span className="on"></span>
            {Array.from({length:16}).map((_,i)=><span key={i}></span>)}
          </span>
        </span>
        <button className="next">Next</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// V4 — Conversational chat (friendly, mobile-native)
// ───────────────────────────────────────────────────────────
function V4Chat() {
  return (
    <div className="v-frame v4">
      <div className="v4-top">
        <div className="avatar" aria-hidden="true"></div>
        <div className="who">
          <div className="name">Berlin Coach</div>
          <div className="desc">Question 2 of 18 · Gesellschaft</div>
        </div>
        <div className="status"><span className="dot"></span>Live</div>
      </div>
      <div className="v4-body">
        <div className="v4-day">today · learn mode</div>
        <div className="v4-msg coach">
          <Hl text={Q.q} keywords={Q.keywords} />
          <span className="gloss">{Q.qEn}</span>
        </div>
        <div className="v4-replies">
          {Q.options.map((o, i) => {
            const isOk = i === Q.correct;
            return (
              <button key={i} className={'v4-reply' + (isOk ? ' picked' : '')}>
                {o}
                <span className="en">{Q.optionsEn[i]}</span>
              </button>
            );
          })}
        </div>
        <div className="v4-msg feedback">
          ✓ Genau! <span style={{fontWeight:400, color:'#1a6e3b', opacity:0.85}}>Religion is the only optional subject.</span>
        </div>
      </div>
      <div className="v4-input">
        <button className="chip">Tap for hint &amp; keywords…</button>
        <button className="send" aria-label="Next">→</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// V5 — Brutalist monospace (high density, technical)
// ───────────────────────────────────────────────────────────
function V5Brutal() {
  return (
    <div className="v-frame v5">
      <div className="v5-top">
        <span className="brand">LiD//TRAINER</span>
        <span className="blip">DE→EN</span>
        <span className="mode">
          <button className="on">LEARN</button>
          <button>TEST</button>
        </span>
      </div>
      <div className="v5-sub">
        <span>Q.{String(Q.num).padStart(3,'0')} · {Q.category}</span>
        <span>02/18 · 11%</span>
      </div>
      <div className="v5-body">
        <span className="v5-q-label">FRAGE</span>
        <p className="v5-q"><Hl text={Q.q} keywords={Q.keywords} /></p>
        <p className="v5-qen">// {Q.qEn}</p>
        <div className="v5-ans">
          {Q.options.map((o, i) => {
            const isOk = i === Q.correct;
            return (
              <div key={i} className={'row' + (isOk ? ' ok' : '')}>
                <span className="k">[{String.fromCharCode(65+i)}]</span>
                <span className="t">{o}<span className="en">→ {Q.optionsEn[i]}</span></span>
                <span className="m">{isOk ? '✓' : ' '}</span>
              </div>
            );
          })}
        </div>
        <div className="v5-inline">
          <span className="label">// KEYWORDS</span>
          {Q.keywords.map((k, i) => (
            <span key={i} className="keychip">
              <b>{k.de}</b> <span className="en">= {k.en}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="v5-nav">
        <button>← PREV</button>
        <button>★ KNOWN</button>
        <button>NEXT →</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Canvas layout
// ───────────────────────────────────────────────────────────
function App() {
  return (
    <DesignCanvas>
      <DCSection id="dirs" title="LiD Trainer — five UI directions"
        subtitle="Same question, five takes. Layout · tone · density vary in each. Click a card to focus full-size.">
        <DCArtboard id="v1" label="1 · Editorial paper" width={390} height={780}>
          <V1Editorial />
        </DCArtboard>
        <DCArtboard id="v2" label="2 · Workbook" width={390} height={780}>
          <V2Workbook />
        </DCArtboard>
        <DCArtboard id="v3" label="3 · Bold poster" width={390} height={780}>
          <V3Poster />
        </DCArtboard>
        <DCArtboard id="v4" label="4 · Coach chat" width={390} height={780}>
          <V4Chat />
        </DCArtboard>
        <DCArtboard id="v5" label="5 · Brutalist mono" width={390} height={780}>
          <V5Brutal />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
