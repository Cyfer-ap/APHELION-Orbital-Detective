import { Crosshair, LocateFixed, MousePointer2, SlidersHorizontal } from 'lucide-react';
import type { CSSProperties } from 'react';
import { coord } from '../lib/orbit';
import type { Station } from '../lib/orbit';

type Props = {
  station: Station;
  mask: number;
  placing: boolean;
  calculating: boolean;
  footprintKm: number | null;
  onTogglePlacing: () => void;
  onMaskChange: (value: number) => void;
};

/** A visible, immediately usable control panel paired with the orbital API.
 * The displayed coverage comes from the backend, never a cosmetic random value. */
export default function GroundControl({ station, mask, placing, calculating, footprintKm, onTogglePlacing, onMaskChange }: Props) {
  return <section className={`ground-console ${placing ? 'ground-console--placing' : ''}`} aria-label="Interactive ground station control">
    <div className="ground-console__top">
      <span className="ground-console__label"><LocateFixed size={13}/> GROUND CONTROL</span>
      <span className={`ground-console__sync ${calculating ? 'is-calculating' : ''}`}>
        <span/>{calculating ? 'SYNCING' : 'MODEL READY'}
      </span>
    </div>
    <div className="ground-console__station">GS—01 <span>/</span> {station.name}</div>
    <div className="ground-console__coords"><span>{coord(station.lat, true)}</span><span>{coord(station.lon, false)}</span></div>
    <button className={`ground-console__place ${placing ? 'is-placing' : ''}`} type="button" onClick={onTogglePlacing}>
      {placing ? <Crosshair size={15}/> : <MousePointer2 size={15}/>}
      <span>{placing ? 'CANCEL PLACEMENT' : 'PLACE ON 3D EARTH'}</span>
      <span className="ground-console__button-end">↗</span>
    </button>
    {placing && <div className="ground-console__instruction" role="status">Choose a point on Earth. Dragging still rotates the globe.</div>}
    <div className="ground-console__rule" />
    <div className="ground-console__mask-label"><span><SlidersHorizontal size={12}/> MIN. ELEVATION</span><strong>{mask}°</strong></div>
    <input className="ground-console__mask" type="range" min="0" max="30" step="1" value={mask}
      style={{ '--mask-progress': `${mask / 30 * 100}%` } as CSSProperties}
      aria-label="Minimum ground station elevation in degrees" aria-valuetext={`${mask} degrees`}
      onChange={e => onMaskChange(Number(e.target.value))} />
    <div className="ground-console__scale"><span>0° HORIZON</span><span>30° STRICT</span></div>
    <div className="ground-console__footprint"><span className="ground-console__footprint-dot"/>
      <span>REFERENCE FOOTPRINT</span>
      <strong>{footprintKm === null ? '—' : `${Math.round(footprintKm).toLocaleString('en-US')} km`}</strong>
    </div>
    <div className="ground-console__note">Spherical-Earth surface radius · predicted, not live telemetry</div>
  </section>;
}
