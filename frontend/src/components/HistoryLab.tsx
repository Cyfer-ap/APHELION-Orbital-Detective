import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertCircle, Archive, ArrowUpRight, Clock3, RefreshCw, UploadCloud } from 'lucide-react';
import { SeparationChart } from './OrbitForensics';
import type { HistorySnapshot, HistoryComparison } from '../lib/orbit';

type Props = {
  snapshots: HistorySnapshot[]; referenceId: string; candidateId: string;
  onReference: (id: string) => void; onCandidate: (id: string) => void;
  data: HistoryComparison | null; loading: boolean; error: string | null; sourceStatus: string;
  horizon: number; onHorizon: (h: number) => void; time: number; onJump: (ms: number) => void;
  onImport: (text: string) => Promise<boolean>; onRefresh: () => void;
};
const num = (n: number) => n.toLocaleString('en-US', {maximumFractionDigits: 3});
const epoch = (iso: string) => new Date(iso).toLocaleString('en-GB', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'}) + ' UTC';

export default function HistoryLab({snapshots, referenceId, candidateId, onReference, onCandidate, data, loading, error,
  sourceStatus, horizon, onHorizon, time, onJump, onImport, onRefresh}: Props) {
  const [tle, setTle] = useState('');
  const [importing, setImporting] = useState(false);
  const active = data && data.reference.id === referenceId && data.candidate.id === candidateId && data.model.horizon_hours === horizon ? data : null;
  const index = active ? Math.max(0, Math.min(active.diagnostics.length - 1, Math.round((time - Date.parse(active.reference_track[0].time)) /
    (Date.parse(active.reference_track.at(-1)!.time) - Date.parse(active.reference_track[0].time)) * (active.diagnostics.length - 1)))) : 0;
  const metric = active?.diagnostics[index];
  const maxComponent = useMemo(() => metric ? Math.max(0.001, Math.abs(metric.radial_km), Math.abs(metric.along_track_km), Math.abs(metric.cross_track_km)) : 1, [metric]);
  const submit = async () => {
    if (!tle.trim() || importing) return;
    setImporting(true);
    try { if (await onImport(tle)) setTle(''); } finally { setImporting(false); }
  };
  const ready = snapshots.length >= 2;
  return <motion.div className="panel-scroll orbit-forensics archive-lab" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.24}}>
    <div className="forensic-hero"><div className="forensic-hero-icon"><Archive size={26}/></div><div><span>EXPERIMENT / 007</span><h3>Epoch Archive<span>.</span></h3><p>Different ISS element epochs. Same SGP4 model.</p></div></div>
    <div className={`forensic-status ${loading?'is-busy':''}`}><span className="forensic-pulse"/>{loading?'COMPUTING SNAPSHOT DRIFT':active?'TWO REAL ELEMENT SETS COMPARED':'ELEMENT ARCHIVE'}<span>{snapshots.length} SAVED</span></div>
    <div className="archive-toolbar"><span><Clock3 size={13}/> RECORDED TLE SNAPSHOTS</span><button onClick={onRefresh} type="button" aria-label="Refresh orbital archive"><RefreshCw size={14}/></button></div>
    <p className="forensic-method">APHELION retains distinct locally retrieved CelesTrak TLEs. Compare two recorded element sets or paste a historical ISS TLE from a source you trust. Nothing is generated to fill gaps.</p>
    <label className="archive-select-label" htmlFor="older-snapshot">REFERENCE / SNAPSHOT A</label>
    <select id="older-snapshot" value={referenceId} onChange={e=>onReference(e.target.value)}>
      <option value="">Select an element set</option>
      {snapshots.map(s=><option key={s.id} value={s.id}>{epoch(s.epoch_utc)} · {s.id.slice(0,7)}</option>)}
    </select>
    <label className="archive-select-label" htmlFor="newer-snapshot">COMPARATOR / SNAPSHOT B</label>
    <select id="newer-snapshot" value={candidateId} onChange={e=>onCandidate(e.target.value)}>
      <option value="">Select another element set</option>
      {snapshots.map(s=><option key={s.id} value={s.id}>{epoch(s.epoch_utc)} · {s.id.slice(0,7)}</option>)}
    </select>
    <div className="forensic-label"><span><Activity size={14}/> SHARED PREDICTION WINDOW</span><span>FROM NEWER EPOCH</span></div>
    <div className="forensic-horizon">{[3,6,12,24].map(h=><button key={h} type="button" className={horizon===h?'active':''} aria-pressed={horizon===h} onClick={()=>onHorizon(h)}>{h}<small>H</small></button>)}</div>
    {active ? <>
      <div className="forensic-key"><span><i className="sgp4"/> SNAPSHOT A · SGP4</span><span><i className="kepler"/> SNAPSHOT B · SGP4</span></div>
      <div className="forensic-major"><div><span>FINAL PREDICTION SEPARATION</span><strong>{num(active.summary.final_separation_km)}<small>km</small></strong></div><div><span>PEAK / {num(active.summary.max_separation_at_minutes / 60)} h</span><b>{num(active.summary.max_separation_km)} km</b></div></div>
      <SeparationChart data={active} time={time} onJump={onJump}/>
      <div className="forensic-label"><span>RIC / SIGNED DIFFERENCE</span><span>AT PLAYHEAD</span></div>
      <div className="forensic-ric">{[
        {name:'RADIAL',value:metric?.radial_km ?? 0},
        {name:'ALONG TRACK',value:metric?.along_track_km ?? 0},
        {name:'CROSS TRACK',value:metric?.cross_track_km ?? 0},
      ].map(row=><div key={row.name} className="forensic-ric-row"><div><span>{row.name}</span><b>{row.value>=0?'+':''}{num(row.value)} <small>km</small></b></div><div className="forensic-ric-track"><span style={{width:`${100*Math.abs(row.value)/maxComponent}%`, marginLeft:row.value<0?'auto':0}}/></div></div>)}</div>
      <div className="forensic-provenance"><span>SNAPSHOT A <b>{epoch(active.reference.epoch_utc)}</b></span><span>SOURCE <b>{active.reference.source}</b></span><span>SNAPSHOT B <b>{epoch(active.candidate.epoch_utc)}</b></span><span>SOURCE <b>{active.candidate.source}</b></span></div>
    </> : <div className="forensic-wait"><Archive size={29} className="forensic-loader"/><strong>{error?'CANNOT COMPARE':ready?'SELECT DISTINCT ELEMENT EPOCHS':'AWAITING TWO HISTORICAL ELEMENT SETS'}</strong><p>{error || (ready?'Choose two records above. Their epochs must differ by at most five days.':'A single current TLE cannot establish historical prediction divergence. Import an authentic earlier ISS TLE or revisit after CelesTrak publishes an updated set.')}</p></div>}
    <div className="archive-import"><div className="archive-toolbar"><span><UploadCloud size={14}/> IMPORT HISTORICAL ISS TLE</span></div>
      <textarea aria-label="Paste a complete two-line ISS TLE" placeholder={'ISS (ZARYA)\n1 25544U ...\n2 25544 ...'} value={tle} maxLength={512} onChange={e=>setTle(e.target.value)}/>
      <button disabled={!tle.trim() || importing} onClick={()=>void submit()} type="button"><UploadCloud size={14}/>{importing?'VALIDATING…':'VALIDATE & SAVE SNAPSHOT'}</button>
      <p>Checksums and NORAD 25544 are validated. Imported records are marked unverified; the source is not authenticated.</p>
    </div>
    {sourceStatus!=='ok' && <div className="archive-alert" role="status">{sourceStatus}</div>}
    <div className="forensic-caution"><AlertCircle size={17}/><p><b>Model-to-model comparison, not measured trajectory error.</b> Two different SGP4 fits can disagree due to estimation and epoch age. Separation alone proves neither a maneuver nor a change in true position.</p></div>
    <div className="forensic-footer"><span>GCRS DIFFERENCES · WGS84 GLOBE</span><ArrowUpRight size={14}/></div>
  </motion.div>;
}
