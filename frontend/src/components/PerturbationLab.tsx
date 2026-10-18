import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, AlertTriangle, ArrowUpRight, Atom, Compass, Gauge, RefreshCw } from 'lucide-react';
import type { J2Comparison, OrbitDesign } from '../lib/orbit';

type Props = {
  data:J2Comparison|null; loading:boolean; error:string|null; days:number;
  onDays:(d:number)=>void; design:OrbitDesign; onInclination:(i:number)=>void;
  onRetry:()=>void; onDesigner:()=>void;
};
const fmt=(v:number,d=3)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
const signed=(v:number|null,d=3)=>v===null?'UNDEFINED':`${v>=0?'+':''}${fmt(v,d)}°`;

function NodeDriftChart({data}:{data:J2Comparison}){
  const [index,setIndex]=useState(0);
  useEffect(()=>setIndex(data.diagnostics.length-1),[data]);
  const curve=useMemo(()=>{
    const series=data.diagnostics;
    const magnitude=Math.max(.02,...series.map(row=>Math.abs(row.raan_drift_deg??0)))*1.2;
    const x=(i:number)=>22+295*i/(series.length-1);
    const y=(v:number)=>62-(v/magnitude)*43;
    return {x,y,magnitude,points:series.map((row,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(row.raan_drift_deg??0).toFixed(2)}`).join(' ')};
  },[data]);
  const chosen=data.diagnostics[Math.min(index,data.diagnostics.length-1)];
  if(data.diagnostics.every(row=>row.raan_drift_deg===null))
    return <div className="j2-graph" role="status">Ascending-node longitude is undefined for an exactly equatorial orbit. Select a non-equatorial inclination to inspect nodal precession.</div>;
  const seek=(clientX:number,bounds:DOMRect)=>{
    const fraction=Math.max(0,Math.min(1,((clientX-bounds.left)/bounds.width*340-22)/295));
    setIndex(Math.round(fraction*(data.diagnostics.length-1)));
  };
  return <div className="j2-graph">
    <div className="j2-graph-head"><span><Activity size={13}/> OSCULATING ASCENDING NODE</span><small>ΔΩ / degrees</small></div>
    <svg role="img" aria-label="Change in osculating right ascension of ascending node over the selected time horizon" viewBox="0 0 340 128"
      onPointerMove={e=>{if(e.pointerType!=='touch')seek(e.clientX,e.currentTarget.getBoundingClientRect());}}
      onClick={e=>seek(e.clientX,e.currentTarget.getBoundingClientRect())}>
      <defs><linearGradient id="j2-glow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#93f2df" stopOpacity=".19"/><stop offset="1" stopColor="#93f2df" stopOpacity="0"/></linearGradient></defs>
      <line x1="22" x2="317" y1="62" y2="62" stroke="#789ca8" strokeWidth="1" strokeDasharray="3 5" opacity=".6"/>
      <text x="1" y="18" fontSize="8" fill="#8faaba">+{fmt(curve.magnitude,1)}</text>
      <text x="4" y="65" fontSize="8" fill="#8faaba">0°</text>
      <text x="1" y="109" fontSize="8" fill="#8faaba">−{fmt(curve.magnitude,1)}</text>
      <path d={`${curve.points} L317,62 L22,62 Z`} fill="url(#j2-glow)"/>
      <path d={curve.points} fill="none" stroke="#8df5db" strokeWidth="2.2" strokeLinejoin="round"/>
      <line x1={curve.x(index)} x2={curve.x(index)} y1="11" y2="110" stroke="#fdc78c" strokeDasharray="4 4" strokeWidth="1.4"/>
      <circle cx={curve.x(index)} cy={curve.y(chosen.raan_drift_deg??0)} r="4.3" fill="#ffe0b1" stroke="#162637" strokeWidth="2"/>
    </svg>
    <input aria-label="Inspect nodal precession at an elapsed hour" type="range" min={0} max={data.diagnostics.length-1} value={index}
      onChange={e=>setIndex(Number(e.target.value))}/>
    <div className="j2-graph-times"><span>T + 0 H</span><span>HOVER / SLIDE TO INSPECT</span><span>T + {data.model.horizon_days} D</span></div>
    <div className="j2-inspection"><span>AT +{fmt(chosen.elapsed_hours,1)} H</span><strong>{signed(chosen.raan_drift_deg,4)}</strong><small>{fmt(chosen.separation_km,2)} km separation</small></div>
    <p className="j2-graph-caveat">History graph spans the full horizon; the globe animates only the <b>final three hours</b>.</p>
  </div>;
}

export default function PerturbationLab({data,loading,error,days,onDays,design,onInclination,onRetry,onDesigner}:Props){
  return <motion.div className="panel-scroll j2-lab" initial={{opacity:0,y:13}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-9}} transition={{duration:.22}}>
    <div className="j2-hero"><span className="j2-hero-icon"><Atom size={26}/></span><div><small>EXPERIMENT / 008</small><h3>Earth's hidden bulge<span>.</span></h3><p>One spacecraft. Two gravity models.</p></div></div>
    <div className={`j2-status ${loading?'busy':''}`}><span className="j2-pulse"/>{loading?'INTEGRATING ORBITS':data?'GRAVITY MODELS READY':'AWAITING BACKEND'}<small>ECI / RK4</small></div>
    <p className="j2-description">Earth's equatorial bulge changes the orbital plane. Compare point-mass gravity with a physical J₂ acceleration, starting from the exact same state.</p>
    <div className="j2-section"><span><Compass size={14}/> INCLINATION</span><strong>{fmt(design.inclination_deg,1)}°</strong></div>
    <input className="j2-range" type="range" aria-label="Orbital inclination degrees" min={0} max={180} step={1} value={design.inclination_deg} onChange={e=>onInclination(Number(e.target.value))}/>
    <div className="j2-ticks"><span>0° · EQUATORIAL</span><span>90° · POLAR</span><span>180° · RETROGRADE</span></div>
    <div className="j2-section"><span><Gauge size={14}/> PROPAGATION HORIZON</span><span>REAL J₂</span></div>
    <div className="j2-horizons">{[1,3,7].map(n=><button type="button" key={n} className={days===n?'active':''} aria-pressed={days===n} onClick={()=>onDays(n)}>{n}<small>DAY{n>1?'S':''}</small></button>)}</div>
    <div className="j2-key"><span><i className="j2-purple"/> POINT MASS</span><span><i className="j2-amber"/> EARTH + J₂</span></div>
    {data&&!loading ? <>
      <div className="j2-summary"><div><span>SECULAR NODE RATE / THEORY</span><strong>{signed(data.summary.secular_raan_rate_deg_day,4)}<small>/ day</small></strong></div><div><span>ENDPOINT OSCULATING ΔΩ</span><strong>{signed(data.summary.final_raan_drift_deg,4)}</strong></div></div>
      <div className="j2-separation"><span>FINAL POSITION DISPLACEMENT</span><strong>{fmt(data.summary.final_separation_km,2)} <small>km</small></strong><p>Difference between paired ECI trajectories at T + {days} day{days>1?'s':''}.</p></div>
      <NodeDriftChart data={data}/>
      <div className="j2-equation"><span>AVERAGED FIRST-ORDER J₂ THEORY</span><code>Ω̇ = −(3/2) n J₂ (Rₑ/p)² cos(i)</code></div>
    </> : <div className="j2-loading" role="status"><Atom size={24}/><p>{error||'Integrating both trajectories with the same RK4 timestep...'}</p>{error&&<button type="button" onClick={onRetry}><RefreshCw size={14}/> RETRY</button>}</div>}
    <div className="j2-warning"><AlertTriangle size={16}/><span>RAAN is undefined for exactly equatorial orbits. Short-period osculating variations differ from the averaged rate. This is a hypothetical model, not ISS tracking.</span></div>
    <button className="j2-designer" type="button" onClick={onDesigner}>EDIT ALL ORBITAL ELEMENTS IN DESIGNER <ArrowUpRight size={14}/></button>
  </motion.div>;
}
