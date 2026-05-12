import { readFileSync, writeFileSync } from 'fs';
const f = 'C:/Projects/Claude proj/yotamquesT/src/react/components/LearningGate.jsx';
let s = readFileSync(f, 'utf8');

// ── 1. Add pressedBtn state after flashSlots ──────────────────────────────────
const OLD_STATE = `  const [flashSlots,  setFlashSlots]  = useState([]);      // typing_gate: wrong flash slots`;
const NEW_STATE  = `  const [flashSlots,  setFlashSlots]  = useState([]);      // typing_gate: wrong flash slots
  const [pressedBtn,  setPressedBtn]  = useState(null);    // press-scale animation: 'mcq-N' | 'letter-N'`;
if (!s.includes(OLD_STATE)) { console.error('OLD_STATE not found'); process.exit(1); }
s = s.replace(OLD_STATE, NEW_STATE);
console.log('✓ pressedBtn state added');

// ── 2. MCQ button: add press handlers + transform ────────────────────────────
const OLD_MCQ = [
  `                <button`,
  `                  key={i}`,
  `                  style={S.btn(state)}`,
  `                  onClick={() => onMCQChoice(i)}`,
  `                  disabled={phase !== QUESTION}`,
  `                >`,
].join('\n');
const NEW_MCQ = [
  `                <button`,
  `                  key={i}`,
  `                  style={{ ...S.btn(state), transform: pressedBtn === 'mcq-' + i ? 'scale(0.9)' : 'scale(1)', transition: 'transform 80ms ease, all 0.15s' }}`,
  `                  onPointerDown={() => setPressedBtn('mcq-' + i)}`,
  `                  onPointerUp={() => setPressedBtn(null)}`,
  `                  onPointerLeave={() => setPressedBtn(null)}`,
  `                  onClick={() => onMCQChoice(i)}`,
  `                  disabled={phase !== QUESTION}`,
  `                >`,
].join('\n');
if (!s.includes(OLD_MCQ)) { console.error('OLD_MCQ not found'); process.exit(1); }
s = s.replace(OLD_MCQ, NEW_MCQ);
console.log('✓ MCQ press animation added');

// ── 3. Letter button: add press handlers + transform ─────────────────────────
const OLD_LETTER = [
  `                  <button`,
  `                    key={i}`,
  `                    style={S.letterBtn(used, flash)}`,
  `                    onClick={() => onLetterTap(i)}`,
  `                    disabled={used || phase !== QUESTION}`,
  `                  >`,
].join('\n');
const NEW_LETTER = [
  `                  <button`,
  `                    key={i}`,
  `                    style={{ ...S.letterBtn(used, flash), transform: pressedBtn === 'letter-' + i ? 'scale(0.9)' : 'scale(1)', transition: 'transform 80ms ease, all 0.12s' }}`,
  `                    onPointerDown={() => !used && setPressedBtn('letter-' + i)}`,
  `                    onPointerUp={() => setPressedBtn(null)}`,
  `                    onPointerLeave={() => setPressedBtn(null)}`,
  `                    onClick={() => onLetterTap(i)}`,
  `                    disabled={used || phase !== QUESTION}`,
  `                  >`,
].join('\n');
if (!s.includes(OLD_LETTER)) { console.error('OLD_LETTER not found'); process.exit(1); }
s = s.replace(OLD_LETTER, NEW_LETTER);
console.log('✓ letter button press animation added');

// ── 4. MCQ btn fontSize 17 → 20 ──────────────────────────────────────────────
// Only the btn() function's fontSize line
s = s.replace(
  `    cursor:          state === 'dim' ? 'default' : 'pointer',\n    transition:      'all 0.15s',\n    textAlign:       'right',\n    direction:       'rtl',\n    fontFamily:      '"Courier New", monospace',`,
  `    fontSize:        20,\n    cursor:          state === 'dim' ? 'default' : 'pointer',\n    transition:      'all 0.15s',\n    textAlign:       'right',\n    direction:       'rtl',\n    fontFamily:      '"Courier New", monospace',`
);

// Remove the old fontSize:17 line for btn if it exists separately
// Check what we have now in btn()
const btnFontCheck = s.match(/btn: \(state\) => \(\{[\s\S]*?fontSize:\s*(\d+)/);
if (btnFontCheck) console.log('btn fontSize now:', btnFontCheck[1]);

// ── 5. Letter btn fontSize 24 → 28 ───────────────────────────────────────────
s = s.replace(
  `    color:           used ? '#0d2035' : flash ? '#ff5577' : '#66bbee',\n    fontSize:        24,`,
  `    color:           used ? '#0d2035' : flash ? '#ff5577' : '#66bbee',\n    fontSize:        28,`
);
console.log('✓ font sizes bumped');

// ── 6. Question text fontSize 19 → 22 ────────────────────────────────────────
s = s.replace(
  `  question: {\n    fontSize:        19,\n    fontWeight:      'bold',\n    color:           '#88ddff',`,
  `  question: {\n    fontSize:        22,\n    fontWeight:      'bold',\n    color:           '#aae8ff',`
);
console.log('✓ question font/contrast bumped');

writeFileSync(f, s, 'utf8');
console.log('LearningGate 2D edits saved.');
