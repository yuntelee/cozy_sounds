import { useState } from 'react';
import MapEditor from './MapEditor';
import TopDownGame from './TopDownGame';

function App() {
  const [activeView, setActiveView] = useState('game');

  return (
    <div>
      <button onClick={() => setActiveView('game')}>Game</button>
      <button onClick={() => setActiveView('map')}>Map Editor</button>
      {activeView === 'map' ? <MapEditor /> : <TopDownGame />}
    </div>
  );
}

export default App;