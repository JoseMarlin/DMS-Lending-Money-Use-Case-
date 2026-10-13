import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SCENARIOS, SCENARIO_KEYS } from '@/data/seed';
import { useAppStore } from '@/data/store';
import type { KycOutage } from '@/data/types';

/**
 * Presenter controls for the demo. NOT part of the product UI: it has its own look (dashed amber
 * border, monospace) so nobody mistakes it for a DMS+ screen. Remove it before handing over.
 * Where it sits: the app shell has the sidebar (Bin, collapse) at the bottom left, so there it is at the
 * bottom right. The standalone form at /apply has its step buttons at the right, so there it is at
 * the bottom left. Switching the user is in the avatar menu of the shell, not here.
 */
export default function DemoPanel() {
  const [open, setOpen] = useState(false);
  const onForm = useLocation().pathname.toLowerCase() === '/apply';
  const activeScenario = useAppStore((s) => s.activeScenario);
  const fillScenario = useAppStore((s) => s.fillScenario);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const kycOutage = useAppStore((s) => s.kycOutage);
  const setKycOutage = useAppStore((s) => s.setKycOutage);

  return (
    <aside
      aria-label="Demo controls"
      className={`fixed bottom-3 z-[9999] font-mono text-xs text-amber-950 ${onForm ? 'left-3' : 'right-3'}`}
    >
      {!open ? (
        <button
          type="button"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="rounded-full border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-1.5 font-semibold shadow-md hover:bg-amber-100"
        >
          Demo controls
        </button>
      ) : (
        <div className="w-80 rounded-md border-2 border-dashed border-amber-500 bg-amber-50 p-3 shadow-lg">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <div className="font-bold uppercase tracking-wide">Demo controls</div>
              <div className="text-[11px] text-amber-800">Not part of the product UI</div>
            </div>
            <button
              type="button"
              aria-expanded={true}
              aria-label="Collapse demo controls"
              onClick={() => setOpen(false)}
              className="rounded border border-amber-400 px-1.5 leading-5 hover:bg-amber-100"
            >
              &minus;
            </button>
          </div>

          <div className="mb-3">
            <div className="mb-1 font-semibold">Fill with scenario</div>
            <div className="grid grid-cols-3 gap-1.5">
              {SCENARIO_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  title={SCENARIOS[key].description}
                  aria-pressed={activeScenario === key}
                  onClick={() => fillScenario(key)}
                  className={`rounded border px-1 py-1.5 text-left leading-tight ${
                    activeScenario === key
                      ? 'border-amber-700 bg-amber-300'
                      : 'border-amber-400 bg-white hover:bg-amber-100'
                  }`}
                >
                  <span className="block font-bold">Scenario {key}</span>
                  <span className="block text-[11px]">{SCENARIOS[key].label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="demo-kyc-outage" className="mb-1 block font-semibold">
              KYC source outage
            </label>
            <select
              id="demo-kyc-outage"
              value={kycOutage}
              onChange={(e) => setKycOutage(e.target.value as KycOutage)}
              className="w-full rounded border border-amber-400 bg-white px-1.5 py-1"
            >
              <option value="none">None</option>
              <option value="pan-once">PAN source times out once</option>
              <option value="pan-down">PAN source stays down</option>
              <option value="gst-down">GST source stays down</option>
            </select>
          </div>

          <button
            type="button"
            onClick={resetDemo}
            className="w-full rounded border border-red-400 bg-white px-2 py-1.5 font-semibold text-red-800 hover:bg-red-50"
          >
            Reset demo
          </button>
        </div>
      )}
    </aside>
  );
}
