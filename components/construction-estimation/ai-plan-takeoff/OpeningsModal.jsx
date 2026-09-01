import React, { useState, useEffect } from 'react';

export function OpeningsModal({ isOpen, type = 'window', onClose, onSelectOpening }) {
  const [openingCode, setOpeningCode] = useState('1218');
  const [heightMm, setHeightMm] = useState(1200);
  const [widthMm, setWidthMm] = useState(1800);
  const [glassType, setGlassType] = useState('clear');
  const [hasTint, setHasTint] = useState(false);

  // Parse standard 4-digit codes (e.g. 1218 -> 1200mm high, 1800mm wide)
  const handleCodeChange = (code) => {
    setOpeningCode(code);
    if (code.length === 4 && !isNaN(code)) {
      const parsedHeight = parseInt(code.substring(0, 2), 10) * 100;
      const parsedWidth = parseInt(code.substring(2, 4), 10) * 100;
      if (parsedHeight > 0) setHeightMm(parsedHeight);
      if (parsedWidth > 0) setWidthMm(parsedWidth);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onSelectOpening({
      type,
      code: openingCode,
      heightMm,
      widthMm,
      glassType,
      hasTint
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md text-white shadow-2xl">
        <h2 className="text-xl font-bold mb-4 capitalize">Select {type} Spec</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Standard 4-Digit Code (Height/Width)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="e.g. 1218"
              value={openingCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-lg font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Height (mm)</label>
              <input
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Width (mm)</label>
              <input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Glass Spec</label>
            <select
              value={glassType}
              onChange={(e) => setGlassType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
            >
              <option value="clear">Clear Float</option>
              <option value="obscured">Obscured / Frosted</option>
              <option value="toughened">Toughened Safety Glass</option>

            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="tint"
              checked={hasTint}
              onChange={(e) => setHasTint(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
            <label htmlFor="tint" className="text-sm text-slate-300">Apply Window Tinting</label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-semibold"
          >
            Apply & Place
          </button>
        </div>
      </div>
    </div>
  );
}