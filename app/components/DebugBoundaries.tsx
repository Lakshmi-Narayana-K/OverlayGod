import { useMoveable } from '../hooks/useMoveable';

export function DebugBoundaries() {
  const { position } = useMoveable();
  
  return (
    <div className="fixed top-2 left-2 text-xs bg-red-500/80 text-white px-2 py-1 rounded font-mono">
      Position: x={position.x}, y={position.y}
      <br />
      Screen: {window.innerWidth}x{window.innerHeight}
    </div>
  );
} 