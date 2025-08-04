import { useState, useEffect, useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

const MOVE_STEP = 20; // pixels to move per key press
const STORAGE_KEY = 'ui-position';
const MIN_VISIBLE = 100; // minimum pixels that must remain visible

export function useMoveable() {
  // Load saved position or use default (center)
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate the saved position is still within bounds
        return clampPosition(parsed);
      } catch {
        // fallback to default
      }
    }
    return { x: 0, y: 0 }; // center position
  });

  // Function to clamp position within screen bounds (horizontal only)
  const clampPosition = useCallback((pos: Position): Position => {
    const screenWidth = window.innerWidth;
    
    // Calculate safe bounds for horizontal movement only
    const maxX = (screenWidth / 2) - MIN_VISIBLE;
    const minX = -(screenWidth / 2) + MIN_VISIBLE;
    
    return {
      x: Math.max(minX, Math.min(maxX, pos.x)),
      y: 0 // Always keep y at 0 (no vertical movement)
    };
  }, []);

  // Save position to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position]);

  // Handle window resize to keep UI on screen
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => clampPosition(prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  const moveLeft = useCallback(() => {
    setPosition(prev => clampPosition({ ...prev, x: prev.x - MOVE_STEP }));
  }, [clampPosition]);

  const moveRight = useCallback(() => {
    setPosition(prev => clampPosition({ ...prev, x: prev.x + MOVE_STEP }));
  }, [clampPosition]);

  const resetPosition = useCallback(() => {
    setPosition({ x: 0, y: 0 });
  }, []);

  // Keyboard event handler (only left/right arrows)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only respond to Ctrl + Left/Right arrow keys
      if (!event.ctrlKey) return;

      // Check if focus is within a scrollable chat area
      const activeElement = document.activeElement;
      const chatContainer = document.querySelector('[data-chat-container]');
      if (chatContainer && chatContainer.contains(activeElement)) {
        // Don't move UI if user is focused within chat area
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveRight();
          break;
        case 'Home': // Ctrl+Home to reset position
          event.preventDefault();
          resetPosition();
          break;
        // Removed ArrowUp and ArrowDown cases
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveLeft, moveRight, resetPosition]);

  // Listen for global shortcuts from main process
  useEffect(() => {
    const handleGlobalShortcut = (event: CustomEvent) => {
      switch (event.detail) {
        case 'ctrl-left':
          moveLeft();
          break;
        case 'ctrl-right':
          moveRight();
          break;
      }
    };

    // Listen for custom events dispatched by the preload script
    window.addEventListener('global-shortcut', handleGlobalShortcut as EventListener);
    return () => window.removeEventListener('global-shortcut', handleGlobalShortcut as EventListener);
  }, [moveLeft, moveRight]);

  // Prevent wheel events from affecting the moveable container when scrolling in chat
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as Element;
      // Check if the wheel event is happening within a chat container
      const chatContainer = target.closest('[data-chat-container]');
      if (chatContainer) {
        // Stop the event from bubbling up to the main container
        event.stopPropagation();
      }
    };

    document.addEventListener('wheel', handleWheel, { capture: true });
    return () => document.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  const containerStyle = {
    transform: `translate(${position.x}px, ${position.y}px)`,
    transition: 'transform 0.1s ease-out'
  };

  return {
    position,
    containerStyle,
    moveLeft,
    moveRight,
    resetPosition
  };
} 