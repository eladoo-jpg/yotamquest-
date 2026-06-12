/**
 * LearningGate — React overlay for all in-maze learning events.
 *
 * Listens for:  window 'yotam:gate:open'   { detail: EventDef }
 * Dispatches:   window 'yotam:gate:answered' { detail: { eventId, correct, reward } }
 *               window 'yotam:shake'          { detail: { strength } }
 *
 * Gate types handled: reading_gate, mcq_gate, typing_gate
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── phase constants ──────────────────────────────────────────── */
const IDLE            = 'idle';
const QUESTION        = 'question';
const FEEDBACK_WRONG  = 'feedback_wrong';
const FEEDBACK_CORRECT= 'feedback_correct';

/* ─── tiny helpers ─────────────────────────────────────────────── */
const dispatch = (name, detail) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

/* ─── audio helpers (Web Audio API — no files needed) ──────────── */
function correctSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

function wrongSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}

function freezeWhisperSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(380, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (_) {}
}

function freezeSpeech(text) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang  = 'he-IL';
    utt.rate  = 0.8;
    utt.pitch = 0.9;
    const speak = () => {
      const voices  = window.speechSynthesis.getVoices();
      const heVoice = voices.find(v => v.lang && v.lang.startsWith('he'));
      if (heVoice) utt.voice = heVoice;
      window.speechSynthesis.speak(utt);
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      speak();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true });
    }
  } catch (_) {}
}

const FINAL_FORMS = { 'ך':'כ', 'ם':'מ', 'ן':'נ', 'ף':'פ', 'ץ':'צ' };
const normalize = (s) =>
  s.trim()
   .replace(/[^א-ת]/g, '')
   .replace(/[ךםןףץ]/g, c => FINAL_FORMS[c]);

// Voice-input normalize: strip nikud diacritics + punctuation
const normalizeHebrew = (s) =>
  s.replace(/[ְ-ׇ]/g, '').replace(/[.,!?]/g, '').trim();

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
  return dp[m][n];
}

const HEBREW_LETTER_NAMES = {
  'א':'אלף', 'ב':'בית', 'ג':'גימל', 'ד':'דלת', 'ה':'הא',
  'ו':'וו',  'ז':'זין', 'ח':'חית', 'ט':'טית', 'י':'יוד',
  'כ':'כף',  'ל':'למד', 'מ':'מם',  'נ':'נון', 'ס':'סמך',
  'ע':'עין', 'פ':'פא',  'צ':'צדי', 'ק':'קוף', 'ר':'ריש',
  'ש':'שין', 'ת':'תו',  'ן':'נון', 'ם':'מם',  'ף':'פא',
  'ך':'כף',  'ץ':'צדי',
};

function speakLetter(letter) {
  try {
    if (!window.speechSynthesis) return;
    const name = HEBREW_LETTER_NAMES[letter] || letter;
    const utt  = new SpeechSynthesisUtterance(name);
    utt.lang   = 'he-IL';
    utt.rate   = 0.9;
    utt.pitch  = 1.0;
    const voices  = window.speechSynthesis.getVoices();
    const heVoice = voices.find(v => v.lang && v.lang.startsWith('he'));
    if (heVoice) utt.voice = heVoice;
    window.speechSynthesis.speak(utt);
  } catch (_) {}
}

/* ─── styles (all inline — no CSS file) ────────────────────────── */
const S = {
  overlay: {
    position:        'fixed',
    inset:           0,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'rgba(1,4,12,0.82)',
    backdropFilter:  'blur(3px)',
    zIndex:          200,
    fontFamily:      '"Courier New", monospace',
    direction:       'rtl',
  },
  panel: {
    position:        'relative',
    width:           'min(440px, 92vw)',
    background:      'linear-gradient(160deg,#020e1f 0%,#050a18 100%)',
    border:          '1.5px solid #0066cc',
    borderRadius:    12,
    boxShadow:       '0 0 28px #0044aa88, inset 0 0 18px #00224422',
    padding:         '24px 22px 20px',
    color:           '#cce8ff',
    overflow:        'hidden',
  },
  neonLine: {
    position:        'absolute',
    top:             0, left:0, right:0,
    height:          2,
    background:      'linear-gradient(90deg,transparent,#00aaff,transparent)',
    opacity:         0.7,
  },
  label: {
    fontSize:        13,
    color:           '#3388bb',
    letterSpacing:   2,
    marginBottom:    10,
    textTransform:   'uppercase',
  },
  passage: {
    background:      '#010c1a',
    border:          '1px solid #0a2a44',
    borderRadius:    7,
    padding:         '12px 14px',
    fontSize:        17,
    lineHeight:      1.65,
    color:           '#b0d8f5',
    marginBottom:    16,
    whiteSpace:      'pre-line',
  },
  passageHighlight: {
    background:      '#021930',
    border:          '1px solid #0055aa',
  },
  question: {
    fontSize:        22,
    fontWeight:      'bold',
    color:           '#aae8ff',
    marginBottom:    14,
    lineHeight:      1.4,
  },
  optionsGrid: {
    display:         'grid',
    gap:             10,
  },
  btn: (state) => ({
    padding:         '14px 16px',
    borderRadius:    8,
    border:          `1.5px solid ${
      state === 'correct' ? '#00cc66' :
      state === 'wrong'   ? '#cc2244' :
      state === 'dim'     ? '#0a1a2a' : '#1a4466'
    }`,
    background:      `${
      state === 'correct' ? 'rgba(0,140,60,0.25)'  :
      state === 'wrong'   ? 'rgba(160,20,40,0.30)' :
      state === 'dim'     ? '#060e1a'              : '#0a1e33'
    }`,
    color:           `${
      state === 'correct' ? '#44ffaa' :
      state === 'wrong'   ? '#ff5577' :
      state === 'dim'     ? '#1a3a55' : '#88ccff'
    }`,
    fontSize:        20,
    cursor:          state === 'dim' ? 'default' : 'pointer',
    transition:      'all 0.15s',
    textAlign:       'right',
    direction:       'rtl',
    fontFamily:      '"Courier New", monospace',
    boxShadow:       state === 'correct' ? '0 0 14px #00cc6655' :
                     state === 'wrong'   ? '0 0 10px #cc224455' : 'none',
  }),
  hint: {
    marginTop:       12,
    padding:         '9px 12px',
    background:      '#010c1a',
    border:          '1px dashed #0a3a66',
    borderRadius:    6,
    color:           '#4499cc',
    fontSize:        14,
    lineHeight:      1.5,
  },
  feedbackBanner: (correct) => ({
    textAlign:       'center',
    fontSize:        22,
    fontWeight:      'bold',
    color:           correct ? '#44ffaa' : '#ffaa44',
    padding:         '18px 0 10px',
    textShadow:      correct
      ? '0 0 16px #00cc6688'
      : '0 0 16px #ff880088',
  }),
  _wrongMsg: () => {
    const msgs = [
      '!כמעט! נסה שוב 💪',
      '!יש לך ניסיון נוסף ⭐',
      '!קרוב! חשוב שוב 🤔',
      '!אופס! תנסה עוד פעם 🎯',
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },
  timerRow: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'flex-end',
    gap:             8,
    marginBottom:    12,
  },
  timerCircle: (pct, urgent) => ({
    width:           42,
    height:          42,
    borderRadius:    '50%',
    border:          `3px solid ${urgent ? '#ff4444' : '#1a5599'}`,
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontSize:        16,
    fontWeight:      'bold',
    color:           urgent ? '#ff6666' : '#5599cc',
    boxShadow:       urgent ? '0 0 12px #ff444466' : 'none',
    transition:      'border-color 0.3s, color 0.3s, box-shadow 0.3s',
    background:      `conic-gradient(#0055aa ${pct * 360}deg, #010c1a 0deg)`,
  }),
  /* typing UI */
  typingPrompt: {
    fontSize:        22,
    color:           '#88ccff',
    lineHeight:      1.55,
    marginBottom:    14,
    direction:       'rtl',
  },
  targetWordBox: {
    background:      '#0a0500',
    border:          '1.5px solid #cc5500',
    borderRadius:    8,
    padding:         '10px 14px 12px',
    marginBottom:    16,
    textAlign:       'center',
  },
  targetWordLabel: {
    fontSize:        11,
    color:           '#664422',
    letterSpacing:   3,
    marginBottom:    8,
    textTransform:   'uppercase',
    fontFamily:      '"Courier New", monospace',
  },
  targetWordLetters: {
    display:         'flex',
    flexDirection:   'row',           // LTR: ג(left) … ן(right) — readable in game boxes
    gap:             6,
    justifyContent:  'center',
  },
  targetLetterCell: {
    width:           44,
    height:          50,
    borderRadius:    6,
    border:          '1.5px solid #994400',
    background:      '#1a0900',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontSize:        26,
    fontWeight:      'bold',
    color:           '#ff9933',
    boxShadow:       '0 0 10px #ff660022',
  },
  wordDisplay: {
    display:         'flex',
    flexDirection:   'row',           // LTR: slot[0] leftmost — matches target word layout
    gap:             8,
    justifyContent:  'center',
    marginBottom:    18,
  },
  letterSlot: (filled, flash) => ({
    width:           44,
    height:          52,
    borderRadius:    6,
    border:          `2px solid ${filled ? '#0088cc' : '#0a2a44'}`,
    background:      filled ? '#011a33' : '#010810',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    fontSize:        26,
    fontWeight:      'bold',
    color:           filled ? '#88ddff' : '#1a3a55',
    transition:      'all 0.15s',
    boxShadow:       flash ? '0 0 12px #ff444488' : (filled ? '0 0 8px #0066aa44' : 'none'),
  }),
  lettersBank: {
    display:         'flex',
    flexWrap:        'wrap',
    gap:             10,
    justifyContent:  'center',
    marginBottom:    8,
  },
  letterBtn: (used, flash, freezeGlow) => ({
    width:           48,
    height:          52,
    borderRadius:    7,
    border:          `1.5px solid ${used ? '#0a1a2a' : flash ? '#cc2244' : freezeGlow ? '#ccaa00' : '#1a5577'}`,
    background:      used ? '#050d17' : flash ? 'rgba(140,10,30,0.3)' : freezeGlow ? 'rgba(160,120,0,0.25)' : '#091c2e',
    color:           used ? '#0d2035' : flash ? '#ff5577' : freezeGlow ? '#ffcc44' : '#66bbee',
    fontSize:        28,
    fontWeight:      'bold',
    cursor:          used ? 'default' : 'pointer',
    fontFamily:      '"Courier New", monospace',
    transition:      'all 0.12s',
    boxShadow:       flash ? '0 0 10px #cc224466' : freezeGlow ? '0 0 14px #ccaa0088' : 'none',
    animation:       freezeGlow === 2 ? 'freezePulse 1s ease infinite' : undefined,
  }),
  backspaceBtn: {
    marginTop:       4,
    padding:         '8px 18px',
    borderRadius:    6,
    border:          '1px solid #1a3a55',
    background:      '#060f1c',
    color:           '#335577',
    fontSize:        13,
    cursor:          'pointer',
    fontFamily:      '"Courier New", monospace',
  },
};

/* ═══════════════════════════════════════════════════════════════ */
export default function LearningGate() {
  const [gate,        setGate]        = useState(null);
  const [phase,       setPhase]       = useState(IDLE);
  const [attempts,    setAttempts]    = useState(0);
  const [showHint,    setShowHint]    = useState(false);
  const [hlPassage,   setHlPassage]   = useState(false);   // highlight passage on 2nd wrong
  const [hlAnswer,    setHlAnswer]    = useState(false);   // highlight correct answer
  const [selectedIdx, setSelectedIdx] = useState(null);    // MCQ: last tapped index
  const [flashIdxs,   setFlashIdxs]   = useState([]);      // MCQ: idxs flashing red
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [typed,       setTyped]       = useState([]);      // typing_gate: chosen letters
  const [usedSlots,   setUsedSlots]   = useState([]);      // typing_gate: which bank slots used
  const [flashSlots,  setFlashSlots]  = useState([]);      // typing_gate: wrong flash slots
  const [pressedBtn,  setPressedBtn]  = useState(null);    // press-scale animation: 'mcq-N' | 'letter-N'
  const [panelZoom,   setPanelZoom]   = useState(false);   // gate-open zoom animation
  const [shuffledOptions, setShuffledOptions] = useState(null); // { options[], correctIndex }
  const [shuffledLetters, setShuffledLetters] = useState([]);   // typing_gate: shuffled letter bank
  const [freezeLevel,  setFreezeLevel]  = useState(0);     // 0=off 1=whisper+glow 2=pulse
  const [freezeMsg,    setFreezeMsg]    = useState('');     // robot whisper text
  const [revealedCount, setRevealedCount] = useState(0);   // word reveal: letters shown so far
  const [phaseIdx,    setPhaseIdx]    = useState(0);       // multi-phase gate: current phase index
  const [readAloudPhase, setReadAloudPhase] = useState(0); // read_aloud_gate: auto-advance phase
  const [isListening,   setIsListening]   = useState(false);  // voice_gate: mic active
  const [voiceInputMode, setVoiceInputMode] = useState('voice'); // voice_gate: 'voice' | 'typing'

  const timerRef    = useRef(null);
  const gateRef     = useRef(null);  // tracks active gate for safe async callbacks
  const freeze8Ref        = useRef(null);  // freeze: 8s timeout
  const freeze15Ref       = useRef(null);  // freeze: +15s timeout
  const freeze38Ref       = useRef(null);  // freeze: +15s more → level 3 auto-reveal
  const handleCorrectRef  = useRef(null);  // stable pointer updated each render
  const handleWrongRef    = useRef(null);  // stable pointer updated each render
  const startVoiceRecogRef = useRef(null); // stable pointer for voice recognition starter
  const recognitionRef    = useRef(null);  // active SpeechRecognition instance
  const revealTickRef      = useRef(null);  // word reveal: single 8s timeout
  const revealCountRef     = useRef(0);     // word reveal: async mirror of revealedCount
  const startRevealTickRef = useRef(null);  // word reveal: stable fn pointer
  const isProcessingRef    = useRef(false); // phase-transition guard: prevents double-fire
  const readAloudTimerRef  = useRef(null);  // read_aloud_gate: auto-advance setTimeout id
  const fireReadAloudPhaseRef = useRef(null); // read_aloud_gate: stable phase-chainer pointer
  const readAloudWordRef   = useRef(null);  // read_aloud_gate: revealed word persists across phases

  /* ── radio dismiss — no Q&A feedback, straight to IDLE ─────── */
  const handleRadioDismiss = useCallback((g) => {
    gateRef.current = null;
    setPhase(IDLE);
    setGate(null);
    dispatch('yotam:gate:answered', { eventId: g.event_id, correct: true, reward: g.reward });
  }, []);

  /* ─── freeze handler ──────────────────────────────────────────────────── */
  const resetFreezeTimers = useCallback(() => {
    clearTimeout(freeze8Ref.current);
    clearTimeout(freeze15Ref.current);
    clearTimeout(freeze38Ref.current);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setFreezeLevel(0);
    setFreezeMsg('');
  }, []);

  const startFreezeTimers = useCallback((g) => {
    if (g.type !== 'typing_gate' && g.type !== 'voice_gate') return;
    clearTimeout(freeze8Ref.current);
    clearTimeout(freeze15Ref.current);
    clearTimeout(freeze38Ref.current);
    freeze8Ref.current = setTimeout(() => {
      const firstLetter = g.type === 'voice_gate'
        ? ((g.correct_answers?.[0] || '')[0] || '')
        : ((g.content.word || '')[0] || '');
      setFreezeMsg('אני חושב שהאות הראשונה היא… ' + firstLetter);
      setFreezeLevel(1);
      freezeWhisperSound();
      freezeSpeech('אני חושב שהאות הראשונה היא ' + firstLetter);
      freeze15Ref.current = setTimeout(() => {
        setFreezeLevel(2);
        freeze38Ref.current = setTimeout(() => {
          setFreezeLevel(3);
          if (g.type === 'voice_gate') {
            // auto-accept for voice gate
            setTimeout(() => { handleCorrectRef.current?.(g); }, 1500);
          } else {
            // fill slots then auto-submit for typing gate
            setTyped((g.content.word || '').split(''));
            setUsedSlots(Array.from({ length: (g.content.letters || []).length }, (_, i) => i));
            setTimeout(() => { handleCorrectRef.current?.(g); }, 1500);
          }
        }, 15000);
      }, 15000);
    }, 8000);
  }, []);

  const startRevealTick = (g) => {
    clearTimeout(revealTickRef.current);
    if (g.type !== 'typing_gate') return;
    const word = g.content.word || '';
    if (revealCountRef.current >= word.length) return;
    revealTickRef.current = setTimeout(() => {
      const idx = revealCountRef.current;
      if (idx < word.length) {
        revealCountRef.current = idx + 1;
        setRevealedCount(idx + 1);
        speakLetter(word[idx]);
      }
      startRevealTickRef.current?.(g);
    }, 8000);
  };
  startRevealTickRef.current = startRevealTick;

  /* ── voice recognition ─────────────────────────────────────── */
  const startVoiceRecognition = useCallback((g) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceInputMode('typing'); return; }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (_) {}
    }
    const rec = new SR();
    rec.lang = 'he-IL';
    rec.interimResults = false;
    rec.continuous = false;
    recognitionRef.current = rec;

    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onerror = (ev) => {
      setIsListening(false);
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setVoiceInputMode('typing');
      }
    };
    rec.onresult = (ev) => {
      setIsListening(false);
      const raw        = ev.results[0][0].transcript;
      const got        = normalizeHebrew(raw);
      const targets    = (g.correct_answers || [g.content?.word || '']).map(a => normalizeHebrew(a));
      const isCorrect  = targets.some(t => levenshtein(got, t) <= 1);
      if (isCorrect) { handleCorrectRef.current?.(g); }
      else           { handleWrongRef.current?.(g);   }
    };

    try { rec.start(); }
    catch (_) { setVoiceInputMode('typing'); }
  }, []);
  startVoiceRecogRef.current = startVoiceRecognition;

  /* ── read_aloud_gate phase chainer ─────────────────────────── */
  const fireReadAloudPhase = (g, idx) => {
    clearTimeout(readAloudTimerRef.current);
    const phaseDef = g.phases[idx];
    if (!phaseDef) return;
    if (phaseDef.display_word) readAloudWordRef.current = phaseDef.display_word;
    if (phaseDef.robot_says) freezeSpeech(phaseDef.robot_says);
    const isLast = idx === g.phases.length - 1;
    if (isLast) {
      // Last phase = typing: strip phases so handleCorrect closes gate normally
      const { phases: _p, ...baseG } = g;
      const typingG = { ...baseG, type: 'typing_gate', content: { ...g.content, ...phaseDef } };
      gateRef.current = typingG;
      setGate(typingG);
      shuffleLetters(typingG);
      startFreezeTimers(typingG);
      startRevealTickRef.current?.(typingG);
      return;
    }
    // Phases 0-2: auto-advance
    const delay = 5000;
    readAloudTimerRef.current = setTimeout(() => {
      if (gateRef.current?.event_id !== g.event_id) return; // gate closed mid-sequence
      setReadAloudPhase(idx + 1);
      fireReadAloudPhaseRef.current?.(g, idx + 1);
    }, delay);
  };
  fireReadAloudPhaseRef.current = fireReadAloudPhase;

  /*── open gate ─────────────────────────────────────────────── */
  const shuffleMCQ = (g) => {
    const opts = [...g.content.options];
    const correctWord = opts[g.content.correct_index];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    setShuffledOptions({ options: opts, correctIndex: opts.indexOf(correctWord) });
  };

  const shuffleLetters = (g) => {
    const arr = [...(g.content.letters || [])];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffledLetters(arr);
  };

  const openGate = useCallback((e) => {
    let g = e.detail;
    // Multi-phase typing gate: merge phase 0 into content (read_aloud_gate handles phases separately)
    if (g.phases?.length > 0 && g.type !== 'read_aloud_gate') {
      g = { ...g, content: { ...g.content, ...g.phases[0] } };
    }
    gateRef.current = g;
    setGate(g);
    setPhaseIdx(0);
    setPhase(QUESTION);
    setAttempts(0);
    setShowHint(false);
    setHlPassage(false);
    setHlAnswer(false);
    setSelectedIdx(null);
    setFlashIdxs([]);
    setTyped([]);
    setUsedSlots([]);
    setFlashSlots([]);
    setRevealedCount(0);
    revealCountRef.current = 0;
    setPanelZoom(true);
    setTimeout(() => setPanelZoom(false), 220);

    if (g.type === 'voice_gate') {
      // Stop any prior recognition session
      try { recognitionRef.current?.abort(); } catch (_) {}
      setIsListening(false);
      setVoiceInputMode('voice');
      if (g.robot_says) freezeSpeech(g.robot_says);
      // Shuffle letters now so typing fallback is ready immediately
      shuffleLetters(g);
      setShuffledOptions(null);
      resetFreezeTimers();
      startFreezeTimers(g);
      // Auto-start mic after TTS has a moment to begin
      setTimeout(() => { startVoiceRecogRef.current?.(g); }, 600);
      return;
    }

    if (g.content?.robot_says) freezeSpeech(g.content.robot_says);

    if (g.type === 'mcq_gate') shuffleMCQ(g); else setShuffledOptions(null);
    if (g.type === 'typing_gate') shuffleLetters(g); else setShuffledLetters([]);

    resetFreezeTimers();
    startFreezeTimers(g);
    startRevealTickRef.current?.(g);

    const t = g.content.timer ?? 0;
    setTimeLeft(t);
    if (t > 0) startTimer(t, g);

    // Radio messages auto-dismiss after content.duration ms
    if (g.type === 'radio_message') {
      const dur = g.content.duration ?? 4000;
      setTimeout(() => {
        if (gateRef.current?.event_id === g.event_id) handleRadioDismiss(g);
      }, dur);
    }

    // read_aloud_gate: start narration chain (phases 0-2 auto-advance, phase 3 = typing)
    if (g.type === 'read_aloud_gate' && g.phases?.length > 0) {
      setReadAloudPhase(0);
      clearTimeout(readAloudTimerRef.current);
      fireReadAloudPhaseRef.current?.(g, 0);
    }
  }, [handleRadioDismiss, resetFreezeTimers, startFreezeTimers]);

  useEffect(() => {
    if (!document.getElementById('yq-gate-styles')) {
      const s = document.createElement('style');
      s.id = 'yq-gate-styles';
      s.textContent = [
        '@keyframes gateZoom { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }',
        '@keyframes spinIn { 0%{transform:rotate(-180deg) scale(0);opacity:0} 100%{transform:rotate(0deg) scale(1);opacity:1} }',
        '@keyframes flashOut { 0%{opacity:1} 100%{opacity:0} }',
        '@keyframes freezePulse { 0%,100%{box-shadow:0 0 12px #ccaa00} 50%{box-shadow:0 0 28px #ffcc00,0 0 50px #ffcc0044} }',
        '@keyframes letterReveal { 0%{opacity:0;transform:scale(1.4)} 100%{opacity:1;transform:scale(1)} }',
        '@keyframes micPulse { 0%,100%{box-shadow:0 0 14px #00ffaa66,0 0 28px #00ffaa22} 50%{box-shadow:0 0 28px #00ffaacc,0 0 54px #00ffaa55} }',
      ].join(' ');
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('yotam:gate:open', openGate);
    return () => window.removeEventListener('yotam:gate:open', openGate);
  }, [openGate]);

  /* ── timer ─────────────────────────────────────────────────── */
  const startTimer = (seconds, g) => {
    clearInterval(timerRef.current);
    let t = seconds;
    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 0) {
        clearInterval(timerRef.current);
        handleWrong(g, true);
      }
    }, 1000);
  };

  const stopTimer = () => clearInterval(timerRef.current);

  /* ── correct / wrong ───────────────────────────────────────── */
  const handleCorrect = useCallback((g) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    stopTimer();
    resetFreezeTimers();
    clearTimeout(revealTickRef.current);
    try { recognitionRef.current?.abort(); } catch (_) {}
    setIsListening(false);
    setPhase(FEEDBACK_CORRECT);
    correctSound();
    dispatch('yotam:juice', { type: 'correct' });

    if (g.type === 'voice_gate' && g.success_says) freezeSpeech(g.success_says);

    // Multi-phase: advance to next phase without closing gate
    if (g.phases && phaseIdx < g.phases.length - 1) {
      const nextIdx = phaseIdx + 1;
      const nextG = { ...g, content: { ...g.content, ...g.phases[nextIdx] } };
      gateRef.current = nextG;
      setGate(nextG);
      setPhaseIdx(nextIdx);
      setTyped([]);
      setUsedSlots([]);
      setFlashSlots([]);
      setRevealedCount(0);
      revealCountRef.current = 0;
      shuffleLetters(nextG);
      resetFreezeTimers();
      startFreezeTimers(nextG);
      startRevealTickRef.current?.(nextG);
      if (nextG.content.robot_says) freezeSpeech(nextG.content.robot_says);
      setPhase(QUESTION);
      setTimeout(() => { isProcessingRef.current = false; }, 100);
    } else {
      dispatch('yotam:gate:answered', { eventId: g.event_id, correct: true, reward: g.reward });
      setTimeout(() => {
        gateRef.current = null;
        readAloudWordRef.current = null;
        setPhase(IDLE);
        setGate(null);
        isProcessingRef.current = false;
      }, 1800);
    }
  }, [resetFreezeTimers, phaseIdx, startFreezeTimers]);
  handleCorrectRef.current = handleCorrect; // update stable ref every render

  const handleWrong = useCallback((g, timeout = false) => {
    stopTimer();
    resetFreezeTimers();
    try { recognitionRef.current?.abort(); } catch (_) {}
    setIsListening(false);
    const newAttempts = attempts + 1;
    const isWarm = (g.type === 'mcq_gate' && (g.content.timer ?? 0) === 0) || g.type === 'typing_gate' || g.type === 'voice_gate';
    if (!isWarm) wrongSound();
    dispatch('yotam:juice', { type: 'wrong', attempt: newAttempts });
    setAttempts(newAttempts);
    setPhase(FEEDBACK_WRONG);

    // Adaptive behaviour
    const adaptive = g.adaptive ?? {};
    if (newAttempts === 1 && adaptive.if_wrong_once === 'show_hint')       setShowHint(true);
    if (newAttempts >= 2 && adaptive.if_wrong_twice === 'highlight_passage') setHlPassage(true);
    if (newAttempts >= 2 && (adaptive.if_wrong_twice === 'highlight_answer' || adaptive.if_wrong_twice === 'highlight_correct')) setHlAnswer(true);

    dispatch('yotam:gate:answered', { eventId: g.event_id, correct: false });

    setTimeout(() => {
      setPhase(QUESTION);
      setSelectedIdx(null);
      setFlashIdxs([]);
      setFlashSlots([]);
      if (g.type === 'mcq_gate') shuffleMCQ(g);
      if (g.type === 'typing_gate') { shuffleLetters(g); startFreezeTimers(g); startRevealTickRef.current?.(g); }
      if (g.type === 'voice_gate') { startFreezeTimers(g); startVoiceRecogRef.current?.(g); }
      // Restart timer (possibly shorter on 2nd+ wrong)
      let nextTimer = g.content.timer ?? 0;
      if (newAttempts >= 2 && adaptive.if_wrong_twice === 'reduce_timer' && nextTimer > 0) {
        nextTimer = Math.max(4, nextTimer - 2);
      }
      if (nextTimer > 0) startTimer(nextTimer, g);
    }, 1500);
  }, [attempts, resetFreezeTimers, startFreezeTimers]);
  handleWrongRef.current = handleWrong;

  /* ── MCQ handler ───────────────────────────────────────────── */
  const onMCQChoice = (idx) => {
    if (phase !== QUESTION) return;
    const correctIdx = shuffledOptions?.correctIndex ?? gate.content.correct_index;
    const correct = idx === correctIdx;
    setSelectedIdx(idx);
    if (!correct) {
      setFlashIdxs([idx]);
      handleWrong(gate);
    } else {
      handleCorrect(gate);
    }
  };

  /* ── typing handler ─────────────────────────────────────────── */
  const onLetterTap = (letterIdx) => {
    if (phase !== QUESTION) return;
    if (usedSlots.includes(letterIdx)) return;
    resetFreezeTimers();
    startFreezeTimers(gate);
    clearTimeout(revealTickRef.current);
    startRevealTickRef.current?.(gate);

    const letter = shuffledLetters[letterIdx];
    const newTyped = [...typed, letter];
    const newUsed  = [...usedSlots, letterIdx];
    setTyped(newTyped);
    setUsedSlots(newUsed);

    const word = gate.content.word;
    if (newTyped.length === word.length) {
      const built = newTyped.join('');
      if (normalize(built) === normalize(word)) {
        handleCorrect(gate);
      } else {
        // Flash all slots briefly, then reset
        setFlashSlots(newUsed);
        handleWrong(gate);
        setTimeout(() => {
          setTyped([]);
          setUsedSlots([]);
          setFlashSlots([]);
        }, 1500);
      }
    }
  };

  const onBackspace = () => {
    if (phase !== QUESTION || typed.length === 0) return;
    resetFreezeTimers();
    startFreezeTimers(gate);
    clearTimeout(revealTickRef.current);
    startRevealTickRef.current?.(gate);
    const newTyped = typed.slice(0, -1);
    const newUsed  = usedSlots.slice(0, -1);
    setTyped(newTyped);
    setUsedSlots(newUsed);
  };

  /* ── render nothing when idle ──────────────────────────────── */
  if (phase === IDLE || !gate) return null;

  const { content, label, type } = gate;
  const isTyping = type === 'typing_gate';
  const hasTimer = (content.timer ?? 0) > 0;
  const timerPct = hasTimer ? timeLeft / content.timer : 0;
  const timerUrgent = hasTimer && timeLeft <= 3;

  /* ── feedback screen ─────────────────────────────────────────── */
  if (phase === FEEDBACK_CORRECT || phase === FEEDBACK_WRONG) {
    const correct = phase === FEEDBACK_CORRECT;
    return (
      <div style={S.overlay}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: correct ? 'rgba(0,220,100,0.15)' : (gate?.type === 'mcq_gate' && (gate?.content?.timer ?? 0) === 0 ? 'rgba(255,180,30,0.10)' : 'rgba(255,50,50,0.10)'),
          animation: 'flashOut 200ms ease forwards',
        }} />
        <div style={S.panel}>
          <div style={S.neonLine} />
          {correct && (
            <div style={{
              fontSize: 48, textAlign: 'center', marginBottom: 8, color: '#00ee66',
              animation: 'spinIn 300ms ease forwards',
            }}>✓</div>
          )}
          <div style={S.feedbackBanner(correct)}>
            {correct ? '✅ כל הכבוד! נכון!' : isTyping ? 'קליטה משובשת, נסה שוב' : S._wrongMsg()}
          </div>
          {!correct && showHint && content.hint && (
            <div style={S.hint}>💡 רמז: {content.hint}</div>
          )}
        </div>
      </div>
    );
  }

  /* ── voice_gate ──────────────────────────────────────────────── */
  if (type === 'voice_gate') {
    const isTypingFallback = voiceInputMode === 'typing';
    return (
      <div style={S.overlay}>
        <div style={{ ...S.panel, animation: panelZoom ? 'gateZoom 220ms ease' : undefined }}>
          <div style={S.neonLine} />

          {/* Label */}
          <div style={S.label}>{label}</div>

          {/* Robot question */}
          <div style={{
            fontSize: 19, color: '#b0d8f5', lineHeight: 1.65,
            marginBottom: 22, direction: 'rtl', textAlign: 'right',
            background: '#010c1a', border: '1px solid #0a2a44',
            borderRadius: 7, padding: '12px 14px',
          }}>
            {gate.robot_says}
          </div>

          {!isTypingFallback ? (
            /* ── voice input UI ──────────────────────────── */
            <div style={{ textAlign: 'center' }}>
              {/* Mic button */}
              <button
                style={{
                  width: 80, height: 80, borderRadius: '50%', cursor: 'pointer',
                  border: `3px solid ${isListening ? '#00ffaa' : '#0066cc'}`,
                  background: isListening ? 'rgba(0,180,110,0.18)' : 'rgba(0,60,140,0.20)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                  boxShadow: isListening ? '0 0 20px #00ffaa88' : '0 0 10px #0066cc44',
                  animation: isListening ? 'micPulse 1s ease infinite' : undefined,
                  transition: 'all 0.2s',
                  marginBottom: 10,
                }}
                onClick={() => { if (!isListening) startVoiceRecognition(gate); }}
                disabled={phase !== QUESTION}
              >
                🎤
              </button>

              {isListening && (
                <div style={{ color: '#00ffaa', fontSize: 15, marginBottom: 8, letterSpacing: 1 }}>
                  מאזין…
                </div>
              )}
              {!isListening && (
                <div style={{ color: '#336688', fontSize: 13, marginBottom: 8 }}>
                  לחץ על המיקרופון ודבר
                </div>
              )}

              {/* Freeze whisper */}
              {freezeLevel > 0 && freezeMsg && (
                <div style={{
                  marginTop: 10, fontSize: 14, padding: '8px 12px',
                  background: '#010c1a', border: '1px dashed #0a3a66',
                  borderRadius: 6,
                  color: freezeLevel >= 2 ? '#ffcc44' : '#4499cc',
                  animation: freezeLevel === 2 ? 'freezePulse 1s ease infinite' : undefined,
                }}>
                  {freezeMsg}
                </div>
              )}

              {/* Typing fallback link */}
              <div style={{ marginTop: 14 }}>
                <button
                  style={{
                    background: 'none', border: 'none',
                    color: '#2a5a77', fontSize: 12, cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={() => {
                    try { recognitionRef.current?.abort(); } catch (_) {}
                    setIsListening(false);
                    setVoiceInputMode('typing');
                    shuffleLetters(gate);
                  }}
                >
                  אין מיקרופון? הקלד במקום
                </button>
              </div>
            </div>
          ) : (
            /* ── typing fallback UI ──────────────────────── */
            <>
              <div style={S.typingPrompt}>הקלד את שם הכלי:</div>

              {/* Input slots */}
              <div style={{ ...S.wordDisplay, marginBottom: 14 }}>
                {Array.from({ length: (gate.content.word || '').length }, (_, i) => {
                  const filled = i < typed.length;
                  const flash  = filled && flashSlots.length > 0;
                  return (
                    <div key={i} style={S.letterSlot(filled, flash)}>
                      {filled ? typed[i] : <span style={{ color: '#0a2a44', fontSize: 20 }}>_</span>}
                    </div>
                  );
                })}
              </div>

              {/* Letter bank */}
              <div style={S.lettersBank}>
                {shuffledLetters.map((letter, i) => {
                  const used       = usedSlots.includes(i);
                  const flash      = flashSlots.includes(i);
                  const freezeGlow = !used && freezeLevel > 0 && letter === (gate.content.word || '')[0] ? freezeLevel : 0;
                  return (
                    <button
                      key={i}
                      style={{ ...S.letterBtn(used, flash, freezeGlow), transform: pressedBtn === 'letter-' + i ? 'scale(0.88)' : 'scale(1)', transition: 'transform 80ms ease, all 0.12s' }}
                      onPointerDown={() => !used && setPressedBtn('letter-' + i)}
                      onPointerUp={() => setPressedBtn(null)}
                      onPointerLeave={() => setPressedBtn(null)}
                      onClick={() => {
                        if (phase !== QUESTION || usedSlots.includes(i)) return;
                        resetFreezeTimers();
                        startFreezeTimers(gate);
                        const letter = shuffledLetters[i];
                        const newTyped = [...typed, letter];
                        const newUsed  = [...usedSlots, i];
                        setTyped(newTyped);
                        setUsedSlots(newUsed);
                        const word = gate.content.word;
                        if (newTyped.length === word.length) {
                          const built   = newTyped.join('');
                          const targets = (gate.correct_answers || [word]).map(a => normalizeHebrew(a));
                          const ok      = targets.some(t => levenshtein(normalizeHebrew(built), t) <= 1);
                          if (ok) { handleCorrect(gate); }
                          else {
                            setFlashSlots(newUsed);
                            handleWrong(gate);
                            setTimeout(() => { setTyped([]); setUsedSlots([]); setFlashSlots([]); }, 1500);
                          }
                        }
                      }}
                      disabled={used || phase !== QUESTION}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Backspace */}
              {typed.length > 0 && phase === QUESTION && (
                <div style={{ textAlign: 'center' }}>
                  <button style={S.backspaceBtn} onClick={() => {
                    resetFreezeTimers();
                    startFreezeTimers(gate);
                    setTyped(typed.slice(0, -1));
                    setUsedSlots(usedSlots.slice(0, -1));
                  }}>
                    ← מחק אות
                  </button>
                </div>
              )}

              {/* Freeze whisper */}
              {freezeLevel > 0 && freezeMsg && (
                <div style={{
                  marginTop: 10, fontSize: 14, padding: '8px 12px',
                  background: '#010c1a', border: '1px dashed #0a3a66',
                  borderRadius: 6,
                  color: freezeLevel >= 2 ? '#ffcc44' : '#4499cc',
                  animation: freezeLevel === 2 ? 'freezePulse 1s ease infinite' : undefined,
                }}>
                  {freezeMsg}
                </div>
              )}

              {/* Back to voice link */}
              <div style={{ marginTop: 10, textAlign: 'center' }}>
                <button
                  style={{ background: 'none', border: 'none', color: '#2a5a77', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => { setVoiceInputMode('voice'); setTyped([]); setUsedSlots([]); startVoiceRecognition(gate); }}
                >
                  חזור לדיבור
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── read_aloud_gate — narration phases 0-2 ─────────────────── */
  if (type === 'read_aloud_gate') {
    if (!readAloudWordRef.current) return null; // phase 0: no word yet — show nothing
    return (
      <div style={S.overlay}>
        <div style={{ ...S.panel, textAlign: 'center' }}>
          <div style={S.neonLine} />
          {readAloudWordRef.current && (
            <div style={{
              fontSize: 64,
              color: '#00eeff',
              fontFamily: '"Arial","Tahoma",sans-serif',
              margin: '24px 0 20px',
              letterSpacing: 8,
              textShadow: '0 0 32px #00aaff88',
              direction: 'rtl',
            }}>
              {readAloudWordRef.current}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#1a3a55', marginTop: 8 }}>…</div>
        </div>
      </div>
    );
  }

  /* ── radio message — bottom bar, no Q&A ─────────────────────── */
  if (type === 'radio_message') {
    return (
      <div
        style={{
          position:   'fixed',
          bottom:     110,
          left:       12,
          right:      12,
          zIndex:     300,
          direction:  'rtl',
          cursor:     'pointer',
          fontFamily: '"Courier New", monospace',
        }}
        onClick={() => handleRadioDismiss(gate)}
      >
        <div style={{
          position:  'relative',
          background:'rgba(0,8,2,0.95)',
          border:    '1.5px solid #00cc44',
          borderRadius: 10,
          padding:   '14px 18px 12px',
          boxShadow: '0 0 24px #00cc4430, inset 0 0 12px #00220800',
        }}>
          {/* green neon top accent */}
          <div style={{
            position:   'absolute',
            top: 0, left: 0, right: 0,
            height:     2,
            background: 'linear-gradient(90deg,transparent,#00cc44,transparent)',
            borderRadius: '10px 10px 0 0',
          }} />
          {/* speaker label */}
          <div style={{
            fontSize:      11,
            color:         '#00aa33',
            letterSpacing: 3,
            marginBottom:  8,
            textTransform: 'uppercase',
          }}>
            📻 {content.speaker}
          </div>
          {/* message text */}
          <div style={{
            fontSize:   17,
            color:      '#88ffaa',
            lineHeight: 1.55,
            textAlign:  'right',
          }}>
            {content.text}
          </div>
          {/* tap-to-dismiss hint */}
          <div style={{
            marginTop:  10,
            fontSize:   11,
            color:      '#224422',
            textAlign:  'center',
          }}>
            הקש לסגירה
          </div>
        </div>
      </div>
    );
  }

  /* ── main question UI ────────────────────────────────────────── */
  return (
    <div style={S.overlay}>
      <div style={{ ...S.panel, animation: panelZoom ? 'gateZoom 220ms ease' : undefined }}>
        <div style={S.neonLine} />

        {/* Label + timer row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={S.label}>{label}</div>
          {hasTimer && (
            <div style={S.timerRow}>
              <div style={S.timerCircle(timerPct, timerUrgent)}>
                {timeLeft}
              </div>
            </div>
          )}
        </div>

        {/* Passage (reading/MCQ) */}
        {content.passage && (
          <div style={{ ...S.passage, ...(hlPassage ? S.passageHighlight : {}) }}>
            {content.passage}
          </div>
        )}

        {/* Question */}
        {content.question && (
          <div style={S.question}>{content.question}</div>
        )}

        {/* Hint (shown after first wrong if adaptive says so) */}
        {showHint && content.hint && (
          <div style={S.hint}>💡 רמז: {content.hint}</div>
        )}

        {/* MCQ options */}
        {!isTyping && content.options && (
          <div style={S.optionsGrid}>
            {(shuffledOptions?.options ?? content.options).map((opt, i) => {
              let state = 'default';
              if (hlAnswer && i === (shuffledOptions?.correctIndex ?? content.correct_index)) state = 'correct';
              else if (flashIdxs.includes(i)) state = 'wrong';
              else if (selectedIdx !== null && i !== selectedIdx) state = 'dim';
              return (
                <button
                  key={i}
                  style={{ ...S.btn(state), transform: pressedBtn === 'mcq-' + i ? 'scale(0.88)' : 'scale(1)', transition: 'transform 80ms ease, all 0.15s', fontFamily: '"Arial", "Tahoma", sans-serif', fontSize: 24 }}
                  onPointerDown={() => setPressedBtn('mcq-' + i)}
                  onPointerUp={() => setPressedBtn(null)}
                  onPointerLeave={() => setPressedBtn(null)}
                  onClick={() => onMCQChoice(i)}
                  disabled={phase !== QUESTION}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Typing gate */}
        {isTyping && (
          <>
            {/* read_aloud_gate: keep word visible above typing UI */}
            {readAloudWordRef.current && (
              <div style={{
                textAlign: 'center',
                fontSize: 64,
                color: '#00eeff',
                fontFamily: '"Arial","Tahoma",sans-serif',
                margin: '4px 0 12px',
                letterSpacing: 8,
                textShadow: '0 0 32px #00aaff88',
                direction: 'rtl',
              }}>
                {readAloudWordRef.current}
              </div>
            )}
            {/* 1. Instruction */}
            <div style={S.typingPrompt}>
              {content.prompt || 'הקלד את המילה:'}
            </div>

            {/* 2. Animated word reveal — letters appear one by one */}
            <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:16 }}>
              {(content.word || '').split('').map((letter, i) => {
                const visible      = i < revealedCount;
                const justRevealed = i + 1 === revealedCount;
                return (
                  <div key={i} style={{
                    width:48, height:54, borderRadius:8,
                    border:`2px solid ${visible ? '#00aaff' : '#0a1a2a'}`,
                    background: visible ? '#011a33' : '#060e1a',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:30, fontWeight:'bold',
                    color: visible ? '#88eeff' : 'transparent',
                    boxShadow: visible ? '0 0 16px #00aaff44' : 'none',
                    transition:'all 0.3s ease',
                    animation: justRevealed ? 'letterReveal 0.3s ease' : undefined,
                  }}>
                    {visible ? letter : ''}
                  </div>
                );
              })}
            </div>

            {/* 3. Input slots — where the player builds the word */}
            <div style={{ ...S.wordDisplay, marginBottom: 14 }}>
              {Array.from({ length: content.word.length }, (_, i) => {
                // RTL: i=0 is rightmost slot (row-reverse) → holds typed[0] (first letter)
                const filled = i < typed.length;
                const letter = filled ? typed[i] : '';
                const flash  = filled && flashSlots.length > 0;
                return (
                  <div key={i} style={S.letterSlot(filled, flash)}>
                    {letter || <span style={{ color: '#0a2a44', fontSize: 20 }}>_</span>}
                  </div>
                );
              })}
            </div>

            {/* 4. Letter bank — shuffled buttons to tap */}
            <div style={S.lettersBank}>
              {shuffledLetters.map((letter, i) => {
                const used       = usedSlots.includes(i);
                const flash      = flashSlots.includes(i);
                const freezeGlow = !used && freezeLevel > 0 && letter === (content.word || '')[0] ? freezeLevel : 0;
                return (
                  <button
                    key={i}
                    style={{ ...S.letterBtn(used, flash, freezeGlow), transform: pressedBtn === 'letter-' + i ? 'scale(0.88)' : 'scale(1)', transition: 'transform 80ms ease, all 0.12s' }}
                    onPointerDown={() => !used && setPressedBtn('letter-' + i)}
                    onPointerUp={() => setPressedBtn(null)}
                    onPointerLeave={() => setPressedBtn(null)}
                    onClick={() => onLetterTap(i)}
                    disabled={used || phase !== QUESTION}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            {/* 5. Backspace */}
            {typed.length > 0 && phase === QUESTION && (
              <div style={{ textAlign: 'center' }}>
                <button style={S.backspaceBtn} onClick={onBackspace}>
                  ← מחק אות
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
