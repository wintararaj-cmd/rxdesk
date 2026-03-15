'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';

export interface ShortcutItem {
  key: string;
  combination: string;
  label: string;
  category: string;
}

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutItem[];
}

export function ShortcutsHelp({ isOpen, onClose, shortcuts }: ShortcutsHelpProps) {
  if (!isOpen) return null;

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Keyboard Shortcuts</h3>
                <p className="text-gray-500 text-sm">Boost your productivity with quick keys</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-auto pr-2 custom-scrollbar">
            {categories.map(category => (
              <div key={category}>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">{category}</h4>
                <div className="grid grid-cols-1 gap-2">
                  {shortcuts.filter(s => s.category === category).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                      <span className="text-sm font-medium text-gray-700">{s.label}</span>
                      <div className="flex items-center gap-1.5">
                        {s.combination.split('+').map((part, i) => (
                          <React.Fragment key={i}>
                            <kbd className="min-w-[24px] px-1.5 py-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 rounded-md shadow-sm">
                              {part.trim()}
                            </kbd>
                            {i < s.combination.split('+').length - 1 && (
                              <span className="text-gray-300 text-xs">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
