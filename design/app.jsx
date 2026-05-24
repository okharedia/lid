const { useState, useEffect, useMemo, useCallback } = React;

const STORAGE_KEY = 'lid-trainer-v5';
const ALL_CATS = 'Alle Kategorien';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {return {};}
}
function saveState(patch) {
  try {
    const cur = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
}

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffled(arr, seed) {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function HighlightedText({ text, keywords }) {
  if (!keywords?.length) return <>{text}</>;
  const terms = keywords.map((k) => k.de).sort((a, b) => b.length - a.length);
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('(' + escaped.join('|') + ')', 'g');
  return (
    <>
      {text.split(re).map((p, i) =>
      terms.includes(p) ?
      <span className="kw" key={i}>{p}</span> :
      <React.Fragment key={i}>{p}</React.Fragment>
      )}
    </>);

}

function AnswerText({ text, keywords, isCorrect, reveal }) {
  if (!reveal || !isCorrect) return <>{text}</>;
  return <HighlightedText text={text} keywords={keywords} />;
}

function App() {
  const initial = loadState();
  const [mode, setMode] = useState(initial.mode || 'learn');
  const [category, setCategory] = useState(initial.category || ALL_CATS);
  const [shuffleSeed, setShuffleSeed] = useState(initial.shuffleSeed || 0);
  const [known, setKnown] = useState(new Set(initial.known || []));
  const [index, setIndex] = useState(initial.index || 0);
  const [selected, setSelected] = useState(null);

  const deck = useMemo(() => {
    let list = window.LID_QUESTIONS;
    if (category !== ALL_CATS) list = list.filter((q) => q.category === category);
    if (shuffleSeed) list = shuffled(list, shuffleSeed);
    return list;
  }, [category, shuffleSeed]);

  useEffect(() => {
    if (index >= deck.length) setIndex(0);
  }, [deck.length]);

  useEffect(() => {
    setSelected(null);
  }, [index, mode, category, shuffleSeed]);

  useEffect(() => {
    saveState({ mode, category, shuffleSeed, known: Array.from(known), index });
  }, [mode, category, shuffleSeed, known, index]);

  const current = deck[index] || null;
  const total = deck.length;
  const isLearn = mode === 'learn';
  const isAnswered = selected !== null;
  const revealNow = isLearn || isAnswered;
  // Notes (Why + Keywords) visible whenever the correct answer is on screen
  const notesVisible = isLearn || isAnswered;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);
  const toggleKnown = useCallback(() => {
    if (!current) return;
    setKnown((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);else
      next.add(current.id);
      return next;
    });
  }, [current]);
  const pickAnswer = useCallback((i) => {
    if (!isLearn && !isAnswered) setSelected(i);
  }, [isLearn, isAnswered]);

  useEffect(() => {
    function onKey(e) {
      const t = e.target.tagName;
      if (t === 'SELECT' || t === 'INPUT' || t === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {e.preventDefault();goPrev();} else
      if (e.key === 'ArrowRight') {e.preventDefault();goNext();} else
      if (e.key === 'k' || e.key === 'K') {e.preventDefault();toggleKnown();} else
      if (e.key === 'l' || e.key === 'L') {e.preventDefault();setMode('learn');} else
      if (e.key === 't' || e.key === 'T') {e.preventDefault();setMode('test');} else
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();pickAnswer(parseInt(e.key, 10) - 1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, toggleKnown, pickAnswer]);

  const isKnown = current && known.has(current.id);
  const progressPct = total ? (index + 1) / total * 100 : 0;
  const knownCount = useMemo(() =>
  deck.reduce((n, q) => n + (known.has(q.id) ? 1 : 0), 0),
  [deck, known]
  );
  const correctChosen = isAnswered && selected === current?.correct;
  const wrongChosen = isAnswered && selected !== current?.correct;

  return (
    <div className="bp-app">
      <header className="bp-top">
        <span className="brand">
          <span className="flag" aria-hidden="true"></span>
          LiD//Trainer
        </span>
        <span className="bp-mode" role="tablist" aria-label="Mode">
          <button aria-pressed={isLearn} onClick={() => setMode('learn')}>Learn</button>
          <button aria-pressed={!isLearn} onClick={() => setMode('test')}>Test</button>
        </span>
      </header>

      <div className="bp-pills-bar">
        <div className="pills">
          {window.LID_CATEGORIES.map((c) =>
          <button
            key={c}
            className="cat-pill"
            aria-pressed={c === category}
            onClick={() => {setCategory(c);setIndex(0);}}>
              <span className="de">{c}</span>
              <span className="en">{window.LID_CATEGORIES_EN?.[c] || ''}</span>
            </button>
          )}
        </div>
      </div>

      <div className="bp-track" aria-hidden="true">
        <div className="fill" style={{ width: `${progressPct}%` }}></div>
      </div>

      {current ?
      <section className="bp-card" key={current.id}>
          <div className="bp-q-label">
            <span className="tag">FRAGE {String(current.num).padStart(3, '0')}</span>
            <span>{current.category}</span>
            {isKnown && <span className="known-tag">✓ KNOWN</span>}
            <span className="grow"></span>
            {correctChosen && <span className="bp-feedback correct">Richtig</span>}
            {wrongChosen && <span className="bp-feedback wrong">Falsch</span>}
            {!correctChosen && !wrongChosen && <>
              {knownCount > 0 && <span className="bp-known"><span className="check">✓</span> {knownCount}</span>}
              <span className="progress">
                {String(total === 0 ? 0 : index + 1).padStart(2, '0')}<span className="pct">/{String(total).padStart(2, '0')}</span>
              </span>
            </>}
          </div>

          <h2 className="bp-q">
            <HighlightedText text={current.q} keywords={current.keywords} />
          </h2>

          {current.qEn && <p className="bp-q-en">{current.qEn}</p>}

          <ul className="bp-answers">
            {current.options.map((opt, i) => {
            const isCorrectAns = i === current.correct;
            let cls = 'bp-answer';
            if (revealNow) {
              if (isCorrectAns) cls += ' is-correct';else
              if (selected === i) cls += ' is-wrong';else
              cls += ' is-dim';
            }
            return (
              <li key={i}>
                  <button
                  className={cls}
                  disabled={isLearn || isAnswered}
                  onClick={() => pickAnswer(i)}>
                  
                    <span className="text">
                      <AnswerText text={opt} keywords={current.keywords} isCorrect={isCorrectAns} reveal={revealNow} />
                      {current.optionsEn?.[i] && <span className="en">{current.optionsEn[i]}</span>}
                    </span>
                    <span className="mark">
                      {revealNow && isCorrectAns ? '✓' : revealNow && selected === i ? '✕' : ''}
                    </span>
                  </button>
                </li>);

          })}
          </ul>

          <div className="bp-notes">
            {notesVisible ?
          <>
                <p className="bp-hint">
                  <HighlightedText text={current.hint} keywords={current.keywords} />
                </p>
                {current.keywords?.length > 0 &&
            <div className="bp-kw-list">
                    {current.keywords.map((k, i) =>
              <span className="kw-item" key={i}>
                      <span className="de">{k.de}</span>
                      <span className="en">{k.en}</span>
                    </span>
              )}
                  </div>
            }
              </> :

          <div className="bp-locked">— answer to reveal explanation &amp; keywords —</div>
          }
          </div>
        </section> :

      <div className="bp-empty">
          <div className="big">No cards</div>
          <div>try a different category</div>
        </div>
      }

      <nav className="bp-nav">
        <button onClick={goPrev} disabled={index === 0} aria-label="Previous">
          <span className="arrow">←</span> Prev
        </button>
        <button
          className="shuffle-btn"
          aria-pressed={!!shuffleSeed}
          onClick={() => setShuffleSeed(shuffleSeed ? 0 : Math.floor(Math.random() * 1e9) + 1)}
          aria-label="Shuffle"
          title="Shuffle deck">
          ⇆
        </button>
        <button
          className={'known-btn' + (isKnown ? ' on' : '')}
          onClick={toggleKnown}
          disabled={!current}>
          
          {isKnown ? '✓ Gewusst' : '★ Mark known'}
        </button>
        <button onClick={goNext} disabled={!current || index >= total - 1}>
          Next <span className="arrow">→</span>
        </button>
      </nav>
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
