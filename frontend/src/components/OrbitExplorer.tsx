import { motion } from 'motion/react';
import { Activity, ArrowRight, CircleDot, Compass, Orbit, RefreshCw } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { OrbitPreview } from '../lib/orbit';

type Props = {
  altitude: number;
  inclination: number;
  onAltitude: (value: number) => void;
  onInclination: (value: number) => void;
  onPreset: (altitude: number, inclination: number) => void;
  preview: OrbitPreview | null;
  loading: boolean;
  error: string | null;
  realAltitude: number | null;
  realPeriod: number | null;
  onRetry: () => void;
};

const presets = [
  { label: 'LOW LEO', altitude: 350, inclination: 28.5 },
  { label: 'ISS-LIKE', altitude: 420, inclination: 51.6 },
  { label: 'POLAR', altitude: 550, inclination: 90 },
  { label: 'SUN-SYNC STYLE', altitude: 700, inclination: 98 },
];
const fmt = (number: number, digits=1) => number.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

function RangeControl({ label, value, min, max, step, unit, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void; hint: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return <div className="lab-control">
    <div className="lab-control__head"><label htmlFor={`lab-${label.replaceAll(' ', '-')}`}>{label}</label><output>{fmt(value, 0)}<small>{unit}</small></output></div>
    <input id={`lab-${label.replaceAll(' ', '-')}`} className="lab-range" type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} style={{ '--lab-progress': `${progress}%` } as CSSProperties}
      aria-label={`Hypothetical orbit ${label.toLowerCase()}`} />
    <div className="lab-control__ticks"><span>{fmt(min, 0)}{unit}</span><span>{fmt(max, 0)}{unit}</span></div>
    <p>{hint}</p>
  </div>;
}

export default function OrbitExplorer({ altitude, inclination, onAltitude, onInclination, onPreset, preview, loading, error, realAltitude, realPeriod, onRetry }: Props) {
  const synced = preview?.parameters.altitude_km === altitude && preview.parameters.inclination_deg === inclination;
  const result = synced ? preview : null;
  const period = result?.derived.period_minutes;
  const speed = result?.derived.speed_km_s;
  const periodDelta = period != null && realPeriod != null ? (period - realPeriod) : null;
  return <motion.div className="panel-scroll orbit-lab" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .25 }}>
    <div className="lab-intro"><span className="lab-orbit-icon"><Orbit size={22} strokeWidth={1.25}/></span><div><div className="lab-overline">EXPERIMENT / 003</div><h3>Orbit Explorer<span>.</span></h3><p>Shape a virtual orbit. See its physics.</p></div></div>
    <div className="lab-status"><span className={`lab-status__dot ${loading ? 'lab-status__dot--loading' : ''}`}/><span>{loading || !synced ? 'RECALCULATING TWO-BODY MODEL' : 'SIMULATION SYNCHRONIZED'}</span><span>KEPLERIAN</span></div>
    <div className="lab-presets-label"><Compass size={12}/> QUICK EXPERIMENTS</div>
    <div className="lab-presets">{presets.map(p => <button type="button" key={p.label}
      className={altitude === p.altitude && inclination === p.inclination ? 'selected' : ''}
      onClick={() => onPreset(p.altitude, p.inclination)}>{p.label}</button>)}</div>
    <RangeControl label="ORBIT ALTITUDE" value={altitude} min={200} max={2000} step={10} unit=" km"
      onChange={onAltitude} hint="Higher circular orbits move slower and take longer to complete." />
    <RangeControl label="ORBIT INCLINATION" value={inclination} min={0} max={180} step={1} unit="°"
      onChange={onInclination} hint="Tilts the orbital plane relative to Earth's equator; beyond 90° is retrograde." />
    <div className="lab-results-title"><span><Activity size={13}/> LIVE PHYSICS</span><span>BACKEND COMPUTED</span></div>
    <div className="lab-results">
      <div className="lab-result"><span>ORBITAL PERIOD</span><strong>{period != null ? fmt(period, 2) : '—'}<small>min</small></strong>
        <span className="lab-result__detail">{periodDelta == null ? 'Compare against the ISS' : `${periodDelta >= 0 ? '+' : ''}${fmt(periodDelta, 1)} min vs ISS`}</span></div>
      <div className="lab-result"><span>CIRCULAR VELOCITY</span><strong>{speed != null ? fmt(speed, 3) : '—'}<small>km/s</small></strong>
        <span className="lab-result__detail">{result ? `r = ${fmt(result.derived.orbital_radius_km, 0)} km` : 'Waiting for computed orbit'}</span></div>
    </div>
    <div className="lab-comparison"><div className="lab-comparison__header"><CircleDot size={13}/> REFERENCE COMPARISON</div>
      <div className="lab-comparison__row"><span>ISS · REAL SGP4</span><strong>{realAltitude != null ? `${fmt(realAltitude, 0)} km` : 'DATA UNAVAILABLE'}</strong></div>
      <div className="lab-comparison__row lab-comparison__row--virtual"><span>APHELION-X · IDEAL MODEL</span><strong>{fmt(altitude, 0)} km</strong></div>
      <p>Amber = real ISS trajectory. Violet = hypothetical orbit. This does not modify the ISS.</p>
    </div>
    {error && <div className="lab-error" role="alert"><span>{error}</span><button onClick={onRetry}><RefreshCw size={13}/> Retry</button></div>}
    <div className="lab-disclaimer"><ArrowRight size={14}/><p><b>Science note</b> — Circular two-body model, spherical Earth, fixed RAAN. The luminous ring shows the orbit plane at the sampled instant; the dashed trail includes Earth's rotation. Not live telemetry or SGP4.</p></div>
  </motion.div>;
}
