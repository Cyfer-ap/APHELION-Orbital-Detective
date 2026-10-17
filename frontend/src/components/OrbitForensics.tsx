import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertCircle, ArrowUpRight, Crosshair, GitCompareArrows, RefreshCw, ScanSearch } from 'lucide-react';
import type { ForensicComparison } from '../lib/orbit';

type Props={data:ForensicComparison|null;loading:boolean;error:string|null;horizon:number;
  time:number;onHorizon:(h:number)=>void;onJump:(ms:number)=>void;onRetry:()=>void};
const fmt=(x:number,n=2)=>x.toLocaleString('en-US',{maximumFractionDigits:n});

function SeparationChart({data,time,onJump}:{data:ForensicComparison;time:number;onJump:(ms:number)=>void}){
  const {curve,area,ticks,cursor}=useMemo(()=>{
    const values=data.diagnostics;
    const max=Math.max(.001,data.summary.max_separation_km*1.12);
    const x=(i:number)=>19+i*300/(values.length-1);
    const y=(v:number)=>105-Math.min(1,v/max)*91;
    const curve=values.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d.separation_km).toFixed(2)}`).join(' ');
    const start=Date.parse(data.reference_track[0].time);
    const end=Date.parse(data.reference_track.at(-1)!.time);
    const cursor=x(Math.max(0,Math.min(values.length-1,(time-start)/(end-start)*(values.length-1))));
    return {curve,area:`${curve} L319,105 L19,105 Z`,cursor,ticks:[0,.25,.5,.75,1].map(f=>({label:fmt(max*f,1),y:y(max*f)}))};
  },[data,time]);
  const seek=(ratio:number)=>{
    const samples=data.reference_track;
    const index=Math.max(0,Math.min(samples.length-1,Math.round(ratio*(samples.length-1))));
    onJump(Date.parse(samples[index].time));
  };
  return <section className="forensic-chart">
    <div className="forensic-label"><span><Activity size={14}/> MODEL SEPARATION</span><span>GCRS / km</span></div>
    <svg role="img" aria-label="Difference between SGP4 and two-body predictions. Click to select an epoch." viewBox="0 0 340 122"
      onClick={e=>{const r=e.currentTarget.getBoundingClientRect();seek(((e.clientX-r.left)/r.width*340-19)/300)}}>
      <defs><linearGradient id="forensic-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#73ddeb" stopOpacity=".28"/><stop offset="1" stopColor="#73ddeb" stopOpacity="0"/></linearGradient></defs>
      {ticks.map(t=><g key={t.label+t.y}><line x1="19" x2="319" y1={t.y} y2={t.y} stroke="#9abacd" strokeDasharray="3 5" strokeOpacity=".25"/><text x="2" y={t.y-2} fontSize="6.6" fill="#9fb2c7">{t.label}</text></g>)}
      <path d={area} fill="url(#forensic-area)"/><path d={curve} fill="none" stroke="#81eeef" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={cursor} x2={cursor} y1="8" y2="105" stroke="#f0b774" strokeWidth="1.4" strokeDasharray="4 4"/>
      <circle cx={cursor} cy="105" r="3" fill="#f4c18c"/>
    </svg>
    <input type="range" aria-label="Model separation time selection" min={0} max={data.reference_track.length-1} step={1}
      value={Math.max(0,Math.min(data.reference_track.length-1,Math.round((time-Date.parse(data.reference_track[0].time)) /
        (Date.parse(data.reference_track.at(-1)!.time)-Date.parse(data.reference_track[0].time))*(data.reference_track.length-1))))}
      onChange={e=>seek(Number(e.target.value)/(data.reference_track.length-1))}/>
    <div className="forensic-chart-legend"><span>ELEMENT EPOCH</span><span>CLICK OR SCRUB TO INSPECT</span><span>+{data.model.horizon_hours} H</span></div>
  </section>;
}

export default function OrbitForensics({data,loading,error,horizon,time,onHorizon,onJump,onRetry}:Props){
  const active=data?.model.horizon_hours===horizon?data:null;
  const idx=active?Math.max(0,Math.min(active.diagnostics.length-1,Math.round(
    (time-Date.parse(active.reference_track[0].time)) /
    (Date.parse(active.reference_track.at(-1)!.time)-Date.parse(active.reference_track[0].time))*(active.diagnostics.length-1)))):0;
  const cursor=active?.diagnostics[idx];
  const maxRIC=cursor?Math.max(0.00001,Math.abs(cursor.radial_km),Math.abs(cursor.along_track_km),Math.abs(cursor.cross_track_km)):1;
  return <motion.div className="panel-scroll orbit-forensics" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:.23}}>
    <div className="forensic-hero"><div className="forensic-hero-icon"><ScanSearch size={29} strokeWidth={1.4}/></div><div><span>EXPERIMENT / 006</span><h3>Orbit Forensics<span>.</span></h3><p>One real ISS epoch. Two different physical models.</p></div></div>
    <div className={`forensic-status ${loading?'is-busy':''}`}><span className="forensic-pulse"/>{loading?'PROPAGATING MODELS':active?'EPOCH STATES SYNCHRONIZED':'AWAITING SATELLITE DATA'}<span>ISS / 25544</span></div>
    <div className="forensic-label"><span><Crosshair size={14}/> INVESTIGATION HORIZON</span><span>FROM ELEMENT EPOCH</span></div>
    <div className="forensic-horizon">{[3,6,12,24].map(h=><button key={h} type="button" aria-pressed={horizon===h} className={h===horizon?'active':''} onClick={()=>onHorizon(h)}>{h}<small>H</small></button>)}</div>
    <p className="forensic-method">Begin at the ISS element epoch with identical GCRS position and velocity. Compare published-element SGP4 predictions against an unperturbed RK4 two-body continuation.</p>
    <div className="forensic-key"><span><i className="sgp4"/> SGP4 · ELEMENTS</span><span><i className="kepler"/> KEPLER · TWO BODY</span></div>
    {active ? <>
      <div className="forensic-major"><div><span>FINAL MODEL SEPARATION</span><strong>{fmt(active.summary.final_separation_km,3)}<small>km</small></strong></div><div><span>PEAK / {fmt(active.summary.max_separation_at_minutes/60,1)} h</span><b>{fmt(active.summary.max_separation_km,3)} km</b></div></div>
      <SeparationChart data={active} time={time} onJump={onJump}/>
      <div className="forensic-label"><span><GitCompareArrows size={14}/> RELATIVE ORBITAL FRAME</span><span>AT PLAYHEAD</span></div>
      <div className="forensic-ric">{[
        {name:'RADIAL',value:cursor?.radial_km??0,desc:'OUT / IN'},
        {name:'ALONG TRACK',value:cursor?.along_track_km??0,desc:'LEAD / LAG'},
        {name:'CROSS TRACK',value:cursor?.cross_track_km??0,desc:'PLANE OFFSET'},
      ].map(row=><div className="forensic-ric-row" key={row.name}><div><span>{row.name}</span><b>{row.value>=0?'+':''}{fmt(row.value,3)} <small>km</small></b></div><div className="forensic-ric-track"><span style={{width:`${Math.abs(row.value)/maxRIC*100}%`,marginLeft:row.value<0?'auto':0}}/></div><small>{row.desc}</small></div>)}</div>
      <div className="forensic-provenance"><span>ELEMENT EPOCH <b>{new Date(active.epoch_utc).toLocaleString('en-GB',{timeZone:'UTC',hour12:false})} UTC</b></span><span>ELEMENT AGE <b>{fmt(active.provenance.element_age_days,2)} d</b></span><span>CACHE <b>{active.provenance.cache_status.replaceAll('_',' ').toUpperCase()}</b></span></div>
    </> : <div className="forensic-wait"><div className="forensic-loader"><ScanSearch size={28}/></div><strong>{error?'INVESTIGATION UNAVAILABLE':'ACQUIRING REAL ORBITAL DATA'}</strong><p>{error||'Requires CelesTrak ISS elements; no simulated satellite data will be substituted.'}</p>{error&&<button type="button" onClick={onRetry}><RefreshCw size={14}/> RETRY</button>}</div>}
    <div className="forensic-caution"><AlertCircle size={17}/><p><b>Model disagreement is not position error against observations.</b> It does not establish a maneuver or collision risk. Both curves share the same initial state; SGP4 includes perturbation effects absent from the two-body comparator. Estimates depend on orbital-element age.</p></div>
    <div className="forensic-footer"><span>GCRS DIFFERENCES · WGS84 GLOBE</span><ArrowUpRight size={14}/></div>
  </motion.div>;
}
