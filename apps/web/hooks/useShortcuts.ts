import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface Shortcut {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  label: string;
  action: () => void;
  category: 'Navigation' | 'System';
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Special case: Esc should still work to blur
        if (event.key === 'Escape') {
          target.blur();
        } else {
          return;
        }
      }

      const match = shortcuts.find((s) => {
        const keyMatch = event.key.toLowerCase() === s.key.toLowerCase();
        const altMatch = !!s.altKey === event.altKey;
        const ctrlMatch = !!s.ctrlKey === event.ctrlKey;
        const shiftMatch = !!s.shiftKey === event.shiftKey;
        return keyMatch && altMatch && ctrlMatch && shiftMatch;
      });

      if (match) {
        event.preventDefault();
        match.action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
