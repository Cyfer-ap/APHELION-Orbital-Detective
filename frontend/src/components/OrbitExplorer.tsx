import { motion } from 'motion/react';
import {
  Activity, ArrowRight, Compass, Crosshair, Gauge, Orbit,
  RefreshCw, RotateCcw, Sparkles, Telescope,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { OrbitDesign, OrbitPreview, PreviewSample } from '../lib/orbit';

export type Props = {
  design: OrbitDesign;
  onChange: (patch: Partial<OrbitDesign>) => void;
  onPreset: (design: OrbitDesign) => void;
  preview: OrbitPreview | null;
  currentPreview: PreviewSample | null;
  loading: boolean;
  error: string | null;
  realAltitude: number | null;
  onRetry: () => void;
};

const presets: { name: string; note: string; design: OrbitDesign }[] = [
  { name: 'CIRCULAR', note: 'e = 0', design: { altitude_km: 550, inclination_deg: 51.6, eccentricity: 0, raan_deg: 0, argument_of_periapsis_deg: 0, phase_deg_at_epoch: 0 } },
  { name: 'ELLIPTICAL', note: 'apsides visible', design: { altitude_km: 450, inclination_deg: 51.6, eccentricity: .24, raan_deg: 35, argument_of_periapsis_deg: 60, phase_deg_at_epoch: 0 } },
  { name: 'POLAR', note: '90° inclined', design: { altitude_km: 650, inclination_deg: 90, eccentricity: .13, raan_deg: 130, argument_of_periapsis_deg: 25, phase_deg_at_epoch: 110 } },
  { name: 'RETROGRADE', note: 'tilted plane', design: { altitude_km: 800, inclination_deg: 125, eccentricity: .32, raan_deg: 250, argument_of_periapsis_deg: 190, phase_deg_at_epoch: 230 } },
];
const fmt = (value: number, decimals = 1) => value.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

function RangeControl({ id, label, value, min, max, step, unit, digits = 0, onChange, hint }: {
  id: string; label: string; value: number; min: number; max: number; step: number; unit: string;
  digits?: number; onChange: (value: number) => void; hint: string;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return <div className="lab-control mission-control">
    <div className="lab-control__head"><label htmlFor={id}>{label}</label><output>{fmt(value, digits)}<small>{unit}</small></output></div>
    <input id={id} className="lab-range" type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} style={{ '--lab-progress': `${progress}%` } as CSSProperties} />
    <div className="lab-control__ticks"><span>{fmt(min, digits)}{unit}</span><span>{fmt(max, digits)}{unit}</span></div>
    <p>{hint}</p>
  </div>;
}

function OrbitAnatomy({ eccentricity, trueAnomaly }: { eccentricity: number; trueAnomaly: number }) {
  // Visual schematic: 2D projected ellipse, compressed vertically for legibility.
  // Earth sits at a focus; location uses the actual Kepler E↔ν relation.
  const E = Math.atan2(Math.sqrt(1 - eccentricity*eccentricity) * Math.sin(trueAnomaly * Math.PI/180),
    eccentricity + Math.cos(trueAnomaly * Math.PI/180));
  const rx = 105, ry = 49 * Math.sqrt(1 - eccentricity*eccentricity);
  const focus = 155 + rx*eccentricity;
  const px = 155 + rx * Math.cos(E), py = 73 - ry * Math.sin(E);
  return <div className="anatomy-panel">
    <div className="anatomy-heading"><span><Telescope size={14}/> ORBIT ANATOMY</span><span>FOCUS-BASED MODEL</span></div>
    <svg viewBox="0 0 315 156" aria-label="Schematic elliptical orbit with Earth at a focus, perigee, apogee and virtual satellite" role="img">
      <defs>
        <linearGradient id="apsis-grad" x1="0" x2="1"><stop offset="0" stopColor="#9675f5" stopOpacity=".6"/><stop offset="1" stopColor="#d2a6ff"/></linearGradient>
        <radialGradient id="earth-focus"><stop offset="0" stopColor="#8ce9ea"/><stop offset="1" stopColor="#236c8e"/></radialGradient>
      </defs>
      <line x1="45" x2="264" y1="73" y2="73" stroke="#7888a9" strokeDasharray="3 6" strokeOpacity=".35"/>
      <ellipse cx="155" cy="73" rx={rx} ry={ry} fill="rgba(170,109,251,.035)" stroke="url(#apsis-grad)" strokeWidth="2"/>
      <line x1={focus} y1="73" x2={px} y2={py} stroke="#ba94ff" strokeDasharray="4 4" strokeOpacity=".7"/>
      <circle cx={focus} cy="73" r="9" fill="url(#earth-focus)" stroke="#7bc6e2" strokeWidth="1.4"/>
      <circle cx={px} cy={py} r="5" fill="#f2d5ff" stroke="#a877fa" strokeWidth="3"/>
      <circle cx="260" cy="73" r="2.7" fill="#e8bc8c"/>
      <circle cx="50" cy="73" r="2.7" fill="#e8bc8c"/>
      <text x="260" y="93" textAnchor="middle" fill="#c8a6e4" fontSize="9">P</text>
      <text x="50" y="93" textAnchor="middle" fill="#c8a6e4" fontSize="9">A</text>
      <text x={focus} y="94" textAnchor="middle" fill="#86d4d5" fontSize="8">EARTH</text>
      <text x="157" y="142" textAnchor="middle" fill="#728da6" fontSize="9">SCHEMATIC · NOT TO SCALE</text>
    </svg>
    <p>Earth occupies one focus, not the ellipse center. The spacecraft moves faster near <b>P</b> (perigee) and slower near <b>A</b> (apogee).</p>
  </div>;
}

export default function OrbitExplorer({ design, onChange, onPreset, preview, currentPreview, loading, error, realAltitude, onRetry }: Props) {
  const synced = !!preview && (Object.keys(design) as (keyof OrbitDesign)[]).every(k => preview.parameters[k] === design[k]);
  const result = synced ? preview : null;
  const derived = result?.derived;
  const anomaly = currentPreview?.true_anomaly_deg ?? result?.state.true_anomaly_deg ?? design.phase_deg_at_epoch;
  return <motion.div className="panel-scroll orbit-lab mission-designer" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .25 }}>
    <div className="lab-intro"><span className="lab-orbit-icon"><Orbit size={24} strokeWidth={1.25}/></span><div><div className="lab-overline">EXPERIMENT / 004</div><h3>Mission Designer<span>.</span></h3><p>Shape an orbit. Watch physics respond.</p></div></div>
    <div className="lab-status"><span className={`lab-status__dot ${loading ? 'lab-status__dot--loading' : ''}`}/><span>{loading || !synced ? 'RECALCULATING ORBIT...' : 'ORBITAL STATE SYNCHRONIZED'}</span><span>2-BODY</span></div>
    <div className="mission-id"><div><Sparkles size={15}/><strong>APHELION–X</strong></div><span>VIRTUAL SPACECRAFT</span></div>
    <div className="lab-presets-label"><Compass size={12}/> EXPERIMENT PRESETS</div>
    <div className="lab-presets mission-presets">{presets.map(p => <button key={p.name} type="button" className={(Object.keys(design) as (keyof OrbitDesign)[]).every(k=>design[k]===p.design[k])?'selected':''} onClick={()=>onPreset(p.design)}><strong>{p.name}</strong><small>{p.note}</small></button>)}</div>
    <div className="mission-section-title"><span><Gauge size={13}/> SHAPE & SIZE</span><span>KEPLERIAN ELEMENTS</span></div>
    <RangeControl id="mission-altitude" label="PERIGEE ALTITUDE" value={design.altitude_km} min={200} max={2000} step={10} unit=" km" onChange={altitude_km=>onChange({altitude_km})} hint="Altitude at the closest approach to Earth's center."/>
    <RangeControl id="mission-eccentricity" label="ECCENTRICITY" value={design.eccentricity} min={0} max={.35} step={.005} digits={3} unit="" onChange={eccentricity=>onChange({eccentricity})} hint="0 is a circle; increasing e makes the orbit more elliptical."/>
    <OrbitAnatomy eccentricity={design.eccentricity} trueAnomaly={anomaly}/>
    <div className="mission-section-title"><span><Crosshair size={13}/> ORIENTATION & PHASE</span><span>INERTIAL FRAME</span></div>
    <RangeControl id="mission-inclination" label="INCLINATION / i" value={design.inclination_deg} min={0} max={180} step={1} unit="°" onChange={inclination_deg=>onChange({inclination_deg})} hint="Orbital plane tilt; above 90° denotes retrograde motion."/>
    <RangeControl id="mission-raan" label="ASCENDING NODE / Ω" value={design.raan_deg} min={0} max={360} step={5} unit="°" onChange={raan_deg=>onChange({raan_deg})} hint="Rotates the orbit plane around Earth's polar axis."/>
    <RangeControl id="mission-arg" label="PERIGEE ARGUMENT / ω" value={design.argument_of_periapsis_deg} min={0} max={360} step={5} unit="°" onChange={argument_of_periapsis_deg=>onChange({argument_of_periapsis_deg})} hint="Rotates the closest approach within the orbital plane."/>
    <RangeControl id="mission-phase" label="TRUE ANOMALY AT EPOCH / ν₀" value={design.phase_deg_at_epoch} min={0} max={360} step={5} unit="°" onChange={phase_deg_at_epoch=>onChange({phase_deg_at_epoch})} hint="Where the spacecraft starts, measured from perigee."/>
    <button className="mission-reset" type="button" onClick={()=>onPreset(presets[1].design)}><RotateCcw size={13}/> RESET TO ELLIPTICAL EXPERIMENT</button>
    <div className="lab-results-title"><span><Activity size={13}/> LIVE PHYSICS</span><span>BACKEND COMPUTED</span></div>
    <div className="lab-results mission-results">
      <div className="lab-result"><span>PERIGEE</span><strong>{derived ? fmt(derived.perigee_altitude_km, 0) : '—'}<small>km</small></strong><span className="lab-result__detail">{derived ? `${fmt(derived.perigee_speed_km_s, 2)} km/s` : 'Closest approach'}</span></div>
      <div className="lab-result"><span>APOGEE</span><strong>{derived ? fmt(derived.apogee_altitude_km, 0) : '—'}<small>km</small></strong><span className="lab-result__detail">{derived ? `${fmt(derived.apogee_speed_km_s, 2)} km/s` : 'Farthest approach'}</span></div>
      <div className="lab-result"><span>ORBITAL PERIOD</span><strong>{derived ? fmt(derived.period_minutes, 1) : '—'}<small>min</small></strong><span className="lab-result__detail">Kepler's third law</span></div>
      <div className="lab-result"><span>INSTANTANEOUS SPEED</span><strong>{currentPreview ? fmt(currentPreview.speed_km_s, 3) : '—'}<small>km/s</small></strong><span className="lab-result__detail">Vis-viva · time-dependent</span></div>
    </div>
    <div className="mission-trace"> <span className="mission-trace__pip"/> <span>VIRTUAL NOW</span> <strong>{currentPreview ? `${fmt(currentPreview.alt_km, 0)} km · ν ${fmt(currentPreview.true_anomaly_deg, 0)}°` : 'WAITING FOR TRACK'}</strong></div>
    <div className="lab-comparison"><div className="lab-comparison__header"><Orbit size={13}/> REFERENCE COMPARISON</div>
      <div className="lab-comparison__row"><span>ISS · REAL SGP4</span><strong>{realAltitude != null ? `${fmt(realAltitude, 0)} km` : 'DATA UNAVAILABLE'}</strong></div>
      <div className="lab-comparison__row lab-comparison__row--virtual"><span>APHELION–X · IDEAL MODEL</span><strong>{currentPreview ? `${fmt(currentPreview.alt_km, 0)} km` : '—'}</strong></div>
      <p>Amber = predicted real ISS. Violet = hypothetical Keplerian ellipse. Orange markers = perigee and apogee.</p>
    </div>
    {error && <div className="lab-error" role="alert"><span>{error}</span><button type="button" onClick={onRetry}><RefreshCw size={13}/> Retry</button></div>}
    <div className="lab-disclaimer"><ArrowRight size={14}/><p><b>Science note</b> — Unperturbed ellipse with fixed orbital elements, Kepler equation and vis-viva speed. Earth is spherical, GMST is approximate; no J₂, drag or maneuvers. Diagram is schematic. Not live telemetry or an operational propagator.</p></div>
  </motion.div>;
}
