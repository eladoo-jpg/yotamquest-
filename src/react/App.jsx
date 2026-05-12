import GameWrapper from './GameWrapper';
import LearningGate from './components/LearningGate';

export default function App() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#020508',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <GameWrapper />
      {/* LearningGate renders as a fixed overlay above the canvas */}
      <LearningGate />
    </div>
  );
}
