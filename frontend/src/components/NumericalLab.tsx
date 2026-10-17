import { useMemo, type CSSProperties } from 'react';
import { motion } from 'motion/react';
import { Activity, ArrowUpRight, BarChart3, Clock3, FlaskConical, Gauge, Info, RefreshCw } from 'lucide-react';
import type { LabComparison, LaboratoryConfig, OrbitDesign } from '../lib/orbit';

type Props={comparison:LabComparison|null;config:LaboratoryConfig;design:OrbitDesign;
  loading:boolean;error:string|null;time:number;onConfig:(p:Partial<LaboratoryConfig>)=>void;
  onRetry:()=>void;onJump:(time:number)=>void;onOpenDesigner:()=>void};
const format=(v:number,d=3)=>!Number.isFinite(v)?'—':(v!==0&&(Math.abs(v)<.001||Math.abs(v)>=100000))?
  v.toExponential(2):v.toLocaleString('en-US',{maximumFractionDigits:d});
const methods=[{id:'euler',title:'EULER',note:'1st order'},{id:'verlet',title:'VELOCITY VERLET',note:'2nd order'},{id:'rk4',title:'RUNGE–KUTTA 4',note:'4th order'}] as const;
const methodIntro={
  euler:'Euler advances along the current tangent. It is simple but accumulates large orbital energy and position errors.',
  verlet:'Velocity Verlet alternates position updates and acceleration kicks. It is second-order; sampling-boundary step adjustment means this implementation is not strictly fixed-step symplectic.',
  rk4:'Fourth-order Runge–Kutta uses four acceleration evaluations per step. Usually much more precise than Euler for smooth two-body trajectories.',
};
function ErrorChart({comparison,selectedTime,onJump}:{comparison:LabComparison;selectedTime:number;onJump:(ms:number)=>void}){
  const {path,cursor,lines}=useMemo(()=>{
    const series=comparison.diagnostics;
    const yMax=Math.max(.2,Math.log10(Math.max(...series.map(x=>x.position_error_km),1e-8))+.3);
    const y=(v:number)=>101-(Math.log10(Math.max(v,1e-8))+8)/(yMax+8)*90;
    const x=(i:number)=>20+298*i/(series.length-1);
    const path=series.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(2)},${y(d.position_error_km).toFixed(2)}`).join(' ');
    const start=Date.parse(comparison.reference_track[0].time);
    const end=Date.parse(comparison.reference_track.at(-1)!.time);
    const cursor=20+298*Math.max(0,Math.min(1,(selectedTime-start)/(end-start)));
    const lines=[-6,-4,-2,0,2,4].filter(v=>v<yMax).map(v=>({label:`10^${v}`,height:y(10**v)}));
    return {path,cursor,lines};
  },[comparison,selectedTime]);
  return <div className="num-chart">
    <div className="num-section-caption"><span><BarChart3 size={14}/> POSITION ERROR / ECI</span><span>LOG SCALE · km</span></div>
    <svg viewBox="0 0 340 118" role="img" aria-label="Numerical position error on a logarithmic scale; click the chart to jump to a time" onClick={e=>{
      const r=e.currentTarget.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width*340;
      const count=comparison.reference_track.length-1;
      const index=Math.max(0,Math.min(count,Math.round((x-20)/298*count)));
      onJump(Date.parse(comparison.reference_track[index].time));
    }}>
      <defs><linearGradient id="numFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#efaf73" stopOpacity=".3"/><stop offset="1" stopColor="#efaf73" stopOpacity="0"/></linearGradient></defs>
      {lines.map(l=><g key={l.label}><line x1="20" x2="318" y1={l.height} y2={l.height} stroke="#96acc0" strokeDasharray="3 5" strokeOpacity=".23"/><text x="0" y={l.height+3} fill="#8ea5b4" fontSize="7">{l.label}</text></g>)}
      <path d={`${path} L318 105 L20 105 Z`} fill="url(#numFill)"/>
      <path d={path} stroke="#f7ba7a" strokeWidth="2" fill="none" strokeLinejoin="round"/>
      <line x1={cursor} x2={cursor} y1="7" y2="104" stroke="#d9baff" strokeWidth="1.1" strokeDasharray="3 4"/>
    </svg>
    <div className="num-chart__legend"><span>START</span><span>CLICK GRAPH TO SCRUB</span><span>{format(comparison.diagnostics.at(-1)!.elapsed_minutes,1)} MIN</span></div>
  </div>;
}

export default function NumericalLab({comparison,config,design,loading,error,time,onConfig,onRetry,onJump,onOpenDesigner}:Props){
  const matches=!!comparison&&(Object.keys(design) as (keyof OrbitDesign)[]).every(k=>comparison.parameters[k]===design[k])&&
    (Object.keys(config) as (keyof LaboratoryConfig)[]).every(k=>comparison.model[k]===config[k]);
  const data=matches?comparison:null;
  const currentIndex=data?Math.max(0,Math.min(data.diagnostics.length-1,Math.round((time-Date.parse(data.reference_track[0].time))/
    (Date.parse(data.reference_track.at(-1)!.time)-Date.parse(data.reference_track[0].time))*(data.diagnostics.length-1)))):0;
  const current=data?.diagnostics[currentIndex];
  return <motion.div className="panel-scroll numerical-lab" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-9}} transition={{duration:.24}}>
    <div className="num-title"><div className="num-symbol"><FlaskConical size={27} strokeWidth={1.4}/></div><div><span>EXPERIMENT / 005</span><h3>Numerical Lab<span>.</span></h3><p>One orbit. Three ways of solving it.</p></div></div>
    <div className={`num-status ${loading?'num-loading':''}`}><span className="num-pulse"/>{loading?'COMPUTING TRAJECTORIES':data?'NUMERICAL MODELS SYNCHRONIZED':'AWAITING COMPUTATION'}<span>ECI · 2-BODY</span></div>
    <div className="num-section-caption"><span><Activity size={14}/> SELECT INTEGRATOR</span><span>ALGORITHM</span></div>
    <div className="num-methods">{methods.map(m=><button type="button" className={config.method===m.id?'active':''} aria-pressed={config.method===m.id} key={m.id} onClick={()=>onConfig({method:m.id})}><b>{m.title}</b><small>{m.note}</small></button>)}</div>
    <p className="num-method-intro">{methodIntro[config.method]}</p>
    <div className="num-step-heading"><label htmlFor="num-step"><Clock3 size={14}/> MAXIMUM SUBSTEP</label><output>{config.step_seconds}<small> seconds</small></output></div>
    <input type="range" id="num-step" className="lab-range num-range" min={10} max={360} step={10} value={config.step_seconds} onChange={e=>onConfig({step_seconds:Number(e.target.value)})} style={{'--lab-progress':`${(config.step_seconds-10)/350*100}%`} as CSSProperties}/>
    <div className="num-range-ticks"><span>10s / FINE</span><span>360s / COARSE</span></div>
    <div className="num-horizon"><span>PROPAGATION HORIZON</span><div>{[1,2,3].map(n=><button type="button" aria-pressed={n===config.duration_orbits} className={config.duration_orbits===n?'active':''} key={n} onClick={()=>onConfig({duration_orbits:n})}>{n}×</button>)}</div></div>
    <div className="num-section-caption num-track-key"><span><i className="num-purple"/> ANALYTIC REFERENCE</span><span><i className="num-orange"/> NUMERICAL</span></div>
    {data?<>
      <div className="num-metrics"><div><span>FINAL SEPARATION</span><strong>{format(data.summary.final_error_km)}<small>km</small></strong></div><div><span>MAX ENERGY DRIFT</span><strong>{format(data.summary.max_energy_drift_pct)}<small>%</small></strong></div><div><span>MAX POSITION ERROR</span><strong>{format(data.summary.max_error_km)}<small>km</small></strong></div><div><span>NUMERICAL SUBSTEPS</span><strong>{data.model.integration_substeps.toLocaleString('en-US')}</strong></div></div>
      <ErrorChart comparison={data} selectedTime={time} onJump={onJump}/>
      <div className="num-at-time"><div><Gauge size={13}/> AT CURSOR</div><strong>{format(current?.position_error_km??0)} <small>km APART</small></strong><p>ENERGY DRIFT {format(current?.relative_energy_drift_pct??0)}%<br/>ANGULAR MOMENTUM DRIFT {format(current?.relative_angular_momentum_drift_pct??0)}%</p></div>
    </>:<div className="num-wait">{error?<><span>{error}</span><button type="button" onClick={onRetry}><RefreshCw size={13}/> RETRY</button></>:<><span className="num-ring"/>{loading?'INTEGRATING THE ORBIT...':'WAITING FOR BACKEND'}</>}</div>}
    <div className="num-notes"><Info size={16}/><p>Both trajectories begin with identical position and velocity. Their separation is <b>numerical error</b>, not a real physical perturbation. Calculations use ECI Cartesian coordinates; the globe shows Earth-fixed positions.</p></div>
    <button className="num-edit" type="button" onClick={onOpenDesigner}>EDIT INITIAL ORBIT IN DESIGNER <ArrowUpRight size={14}/></button>
    <p className="num-disclaimer">Ideal two-body gravity only · educational numerical integration · not a satellite operations system.</p>
  </motion.div>;
}
