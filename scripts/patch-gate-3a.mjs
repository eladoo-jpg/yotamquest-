import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/react/components/LearningGate.jsx';
let s = readFileSync(f, 'utf8');

// ── 1. Add panelZoom state after pressedBtn ───────────────────────────────────
const OLD_STATE = `  const [pressedBtn,  setPressedBtn]  = useState(null);    // press-scale animation: 'mcq-N' | 'letter-N'`;
const NEW_STATE  = `  const [pressedBtn,  setPressedBtn]  = useState(null);    // press-scale animation: 'mcq-N' | 'letter-N'
  const [panelZoom,   setPanelZoom]   = useState(false);   // gate-open zoom animation`;
if (!s.includes(OLD_STATE)) { console.error('OLD_STATE not found'); process.exit(1); }
s = s.replace(OLD_STATE, NEW_STATE);
console.log('✓ panelZoom state added');

// ── 2. Inject CSS keyframes useEffect before gate listener useEffect ──────────
const OLD_EFFECT = `  useEffect(() => {
    window.addEventListener('yotam:gate:open', openGate);
    return () => window.removeEventListener('yotam:gate:open', openGate);
  }, [openGate]);`;
const NEW_EFFECT = `  useEffect(() => {
    if (!document.getElementById('yq-gate-styles')) {
      const s = document.createElement('style');
      s.id = 'yq-gate-styles';
      s.textContent = [
        '@keyframes gateZoom { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }',
        '@keyframes spinIn { 0%{transform:rotate(-180deg) scale(0);opacity:0} 100%{transform:rotate(0deg) scale(1);opacity:1} }',
        '@keyframes flashOut { 0%{opacity:1} 100%{opacity:0} }',
      ].join(' ');
      document.head.appendChild(s);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('yotam:gate:open', openGate);
    return () => window.removeEventListener('yotam:gate:open', openGate);
  }, [openGate]);`;
if (!s.includes(OLD_EFFECT)) { console.error('OLD_EFFECT not found'); process.exit(1); }
s = s.replace(OLD_EFFECT, NEW_EFFECT);
console.log('✓ CSS keyframes useEffect added');

// ── 3. Trigger zoom in openGate ──────────────────────────────────────────────
const OLD_ZOOM_TRIGGER = `    setFlashSlots([]);

    const t = g.content.timer ?? 0;`;
const NEW_ZOOM_TRIGGER  = `    setFlashSlots([]);
    setPanelZoom(true);
    setTimeout(() => setPanelZoom(false), 220);

    const t = g.content.timer ?? 0;`;
if (!s.includes(OLD_ZOOM_TRIGGER)) { console.error('OLD_ZOOM_TRIGGER not found'); process.exit(1); }
s = s.replace(OLD_ZOOM_TRIGGER, NEW_ZOOM_TRIGGER);
console.log('✓ panelZoom trigger added to openGate');

// ── 4. Feedback render: add flash overlay + spin ✓ icon ─────────────────────
const OLD_FEEDBACK = `  if (phase === FEEDBACK_CORRECT || phase === FEEDBACK_WRONG) {
    const correct = phase === FEEDBACK_CORRECT;
    return (
      <div style={S.overlay}>
        <div style={S.panel}>
          <div style={S.neonLine} />
          <div style={S.feedbackBanner(correct)}>
            {correct ? '✅ כל הכבוד! נכון!' : S._wrongMsg()}
          </div>
          {!correct && showHint && content.hint && (
            <div style={S.hint}>💡 רמז: {content.hint}</div>
          )}
        </div>
      </div>
    );
  }`;
const NEW_FEEDBACK = `  if (phase === FEEDBACK_CORRECT || phase === FEEDBACK_WRONG) {
    const correct = phase === FEEDBACK_CORRECT;
    return (
      <div style={S.overlay}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: correct ? 'rgba(0,220,100,0.15)' : 'rgba(255,50,50,0.10)',
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
            {correct ? '✅ כל הכבוד! נכון!' : S._wrongMsg()}
          </div>
          {!correct && showHint && content.hint && (
            <div style={S.hint}>💡 רמז: {content.hint}</div>
          )}
        </div>
      </div>
    );
  }`;
if (!s.includes(OLD_FEEDBACK)) { console.error('OLD_FEEDBACK not found'); process.exit(1); }
s = s.replace(OLD_FEEDBACK, NEW_FEEDBACK);
console.log('✓ feedback flash overlay + spin icon added');

// ── 5. Main question panel: add zoom animation ────────────────────────────────
const OLD_PANEL = `  /* ── main question UI ────────────────────────────────────────── */
  return (
    <div style={S.overlay}>
      <div style={S.panel}>`;
const NEW_PANEL = `  /* ── main question UI ────────────────────────────────────────── */
  return (
    <div style={S.overlay}>
      <div style={{ ...S.panel, animation: panelZoom ? 'gateZoom 220ms ease' : undefined }}>`;
if (!s.includes(OLD_PANEL)) { console.error('OLD_PANEL not found'); process.exit(1); }
s = s.replace(OLD_PANEL, NEW_PANEL);
console.log('✓ panel zoom animation wired');

// ── 6. Button press 0.9 → 0.88 (MCQ) ────────────────────────────────────────
s = s.replace(
  `transform: pressedBtn === 'mcq-' + i ? 'scale(0.9)' : 'scale(1)'`,
  `transform: pressedBtn === 'mcq-' + i ? 'scale(0.88)' : 'scale(1)'`
);
console.log('✓ MCQ button press scale 0.9→0.88');

// ── 7. Button press 0.9 → 0.88 (letter) ─────────────────────────────────────
s = s.replace(
  `transform: pressedBtn === 'letter-' + i ? 'scale(0.9)' : 'scale(1)'`,
  `transform: pressedBtn === 'letter-' + i ? 'scale(0.88)' : 'scale(1)'`
);
console.log('✓ letter button press scale 0.9→0.88');

writeFileSync(f, s, 'utf8');
console.log('All 3A gate edits saved.');
