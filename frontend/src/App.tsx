import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, ArrowDownRight, ArrowUpRight, ChevronDown, CircleDot, Clock3,
  Crosshair, Globe2, Info, LocateFixed, Pause, Play, Radio,
  RefreshCw, Satellite, ShieldCheck, Signal, StepBack, StepForward, Waves, Orbit,
} from 'lucide-react';
import Globe from './components/OrbitalGlobe';
import GroundControl from './components/GroundControl';
import OrbitExplorer from './components/OrbitExplorer';
import { coord, interpolate, prettyTime, STATIONS } from './lib/orbit';
import type { Mission, OrbitPreview, Sample, Station } from './lib/orbit';
import './style.css';

type ClockState={anchor:number; wall:number; speed:number};
const speeds=[1,30,120];
const fmt=(n:number,d=1)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});

function ElevationGraph({track,currentTime,mask}:{track:Sample[];currentTime:number;mask:number}) {
  const {points,fill,yLine,cursorX}=useMemo(()=>{
    if(!track.length)return {points:'',fill:'',yLine:0,cursorX:0};
    const w=330, h=100;
    const max=90,min=-90;
    const convertY=(v:number)=>h-(v-min)/(max-min)*h;
    const points=track.map((p,i)=>`${i===0?'M':'L'} ${(i/(track.length-1)*w).toFixed(2)} ${convertY(p.elevation_deg).toFixed(2)}`).join(' ');
    const fill=`${points} L ${w} ${h} L 0 ${h} Z`;
    const first=Date.parse(track[0].time), last=Date.parse(track[track.length-1].time);
    return {points, fill, yLine:convertY(mask), cursorX:Math.min(w,Math.max(0,(currentTime-first)/(last-first)*w))};
  },[track,currentTime,mask]);
  return <div className="chart-panel">
    <div className="chart-head"><span>ELEVATION PROFILE</span><span>±55 MIN WINDOW</span></div>
    <svg viewBox="0 0 330 100" role="img" aria-label="Ground station elevation graph for the current orbital track" preserveAspectRatio="none">
      <defs><linearGradient id="lineShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#62ead8" stopOpacity=".3"/><stop offset="100%" stopColor="#62ead8" stopOpacity="0"/></linearGradient></defs>
      <line x1="0" x2="330" y1={yLine} y2={yLine} stroke="#96a9be" strokeDasharray="3 6" strokeOpacity=".4"/>
      <path d={fill} fill="url(#lineShade)"/>
      <path d={points} fill="none" stroke="#62e3cf" strokeWidth="2" strokeLinejoin="round"/>
      <line x1={cursorX} x2={cursorX} y1="0" y2="100" stroke="#e7b06b" strokeWidth="1" strokeDasharray="3 4"/>
      <circle cx={cursorX} cy={Math.max(0, Math.min(100, 100-((interpolate(track,currentTime)?.elevation_deg ?? -90)+90)/180*100))} r="4" fill="#e8ad67" stroke="#071b29" strokeWidth="2" />
    </svg>
    <div className="chart-axis"><span>{track.length?prettyTime(track[0].time):'--:--'}</span><span>{mask}° MINIMUM</span><span>{track.length?prettyTime(track[track.length-1].time):'--:--'}</span></div>
  </div>;
}

function Stat({label,value,unit,trend}:{label:string;value:string;unit?:string;trend?:'up'|'down'}) {
  return <div className="telemetry-stat">
    <div className="stat-label">{label} {trend==='up'?<ArrowUpRight size={13}/>:trend==='down'?<ArrowDownRight size={13}/>:null}</div>
    <div className="stat-number">{value}<span>{unit}</span></div>
  </div>;
}

function StationSelector({station,onChange,disabled}:{station:Station;onChange:(s:Station)=>void;disabled:boolean}) {
  return <div className="station-select-wrap">
    <LocateFixed size={15}/>
    <select aria-label="Ground station" value={station.id} onChange={e=>onChange(STATIONS.find(s=>s.id===e.target.value)??STATIONS[0])} disabled={disabled}>
      {station.id==='custom'&&<option value="custom">Custom location</option>}
      {STATIONS.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
    </select>
    <ChevronDown size={14}/>
  </div>;
}

export default function App(){
  const [station,setStation]=useState<Station>(STATIONS[0]);
  const [mask,setMask]=useState(10);
  const [placing,setPlacing]=useState(false);
  const requestRef=useRef<AbortController|null>(null);
  const [mission,setMission]=useState<Mission|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [pane,setPane]=useState<'orbit'|'passes'|'science'|'explore'>('orbit');
  const [altitude,setAltitude]=useState(550);
  const [inclination,setInclination]=useState(51.6);
  const [preview,setPreview]=useState<OrbitPreview|null>(null);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [previewError,setPreviewError]=useState<string|null>(null);
  const previewRequest=useRef<AbortController|null>(null);
  const previewEpoch=useRef(Date.now());

  const [clock,setClock]=useState<ClockState>({anchor:Date.now(),wall:Date.now(),speed:1});
  const [tick,setTick]=useState(Date.now());

  const getTime=useCallback(()=>clock.anchor+(Date.now()-clock.wall)*clock.speed,[clock]);
  useEffect(()=>{const id=window.setInterval(()=>setTick(Date.now()),250);return ()=>window.clearInterval(id);},[]);
  const simulatedTime=clock.anchor+(tick-clock.wall)*clock.speed;
  // Never present readings from an old station or mask as if they are current.
  const synced=!!mission&&Math.abs(mission.station.lat-station.lat)<1e-7
    &&Math.abs(mission.station.lon-station.lon)<1e-7&&mission.station.minimum_elevation_deg===mask;
  const current=useMemo(()=>mission&&synced?interpolate(mission.track,simulatedTime):null,[mission,synced,simulatedTime]);
  const isNearLive=Math.abs(simulatedTime-Date.now())<10000&&clock.speed===1;
  const isContact=!!current&&current.elevation_deg>=mask;
  const previewSynced=!!preview&&preview.parameters.altitude_km===altitude
    &&preview.parameters.inclination_deg===inclination;
  const visiblePreview=pane==='explore'&&previewSynced ? preview : null;

  const fetchPreview=useCallback(async (at:number, h:number, inc:number)=>{
    previewRequest.current?.abort();
    const controller=new AbortController();
    previewRequest.current=controller;
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const params=new URLSearchParams({
        at:new Date(at).toISOString(),epoch:new Date(previewEpoch.current).toISOString(),
        altitude_km:String(h),inclination_deg:String(inc)
      });
      const response=await fetch(`/api/orbit/preview?${params.toString()}`,{signal:controller.signal});
      if(!response.ok) {
        const body=await response.json().catch(()=>({}));
        throw new Error(typeof body.detail==='string'?body.detail:`Preview error ${response.status}`);
      }
      const data:OrbitPreview=await response.json();
      if(!controller.signal.aborted)setPreview(data);
    } catch(e) {
      if(!controller.signal.aborted)setPreviewError(e instanceof Error?e.message:String(e));
    } finally {
      if(previewRequest.current===controller){previewRequest.current=null;setPreviewLoading(false);}
    }
  },[]);

  useEffect(()=>{
    if(pane!=='explore')return;
    const timer=window.setTimeout(()=>void fetchPreview(getTime(),altitude,inclination),230);
    return ()=>window.clearTimeout(timer);
    // getTime changes each clock control; change in time alone is handled by interpolation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pane,altitude,inclination,fetchPreview]);
  useEffect(()=>()=>previewRequest.current?.abort(),[]);
  useEffect(()=>{
    if(pane!=='explore')return;
    const timer=window.setInterval(()=>{
      if(!preview||previewLoading||!previewSynced)return;
      const start=Date.parse(preview.track[0].time),end=Date.parse(preview.track[preview.track.length-1].time);
      const now=getTime();
      if(now<start+12*60000||now>end-12*60000)void fetchPreview(now,altitude,inclination);
    },5000);
    return ()=>window.clearInterval(timer);
  },[pane,preview,previewLoading,previewSynced,getTime,fetchPreview,altitude,inclination]);


  const fetchMission=useCallback(async (when:number,s:Station,minimum:number)=>{
    requestRef.current?.abort();
    const controller=new AbortController();
    requestRef.current=controller;
    setError(null);
    setLoading(true);
    try {
      const q=new URLSearchParams({
        at:new Date(when).toISOString(),station_lat:String(s.lat),station_lon:String(s.lon),
        min_elevation_deg:String(minimum)
      });
      const response=await fetch(`/api/mission?${q.toString()}`,{signal:controller.signal});
      if (!response.ok) {
        const payload=await response.json().catch(()=>({}));
        throw new Error(payload.detail??`Backend error: ${response.status}`);
      }
      const data:Mission=await response.json();
      if(!controller.signal.aborted)setMission(data);
    } catch (e) {
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));
    } finally {
      if(requestRef.current===controller){requestRef.current=null;setLoading(false);}
    }
  },[]);

  useEffect(()=>{
    // Debounce mask slider drags and coalesce rapid station changes.
    const timer=window.setTimeout(()=>void fetchMission(getTime(),station,mask),170);
    return ()=>window.clearTimeout(timer);
    // clock changes are intentionally not a dependency: playback is handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[station,mask,fetchMission]);

  useEffect(()=>()=>requestRef.current?.abort(),[]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{
      if(!mission||loading)return;
      const time=getTime();
      const end=Date.parse(mission.track[mission.track.length-1].time);
      const start=Date.parse(mission.track[0].time);
      const sinceComputed=Date.now()-Date.parse(mission.computed_at);
      if(time> end-8*60000 || time<start+8*60000 || (isNearLive&&sinceComputed>10*60000)) {
        void fetchMission(time,station,mask);
      }
    },5000);
    return ()=>window.clearInterval(timer);
  },[mission,loading,fetchMission,getTime,station,mask,isNearLive]);

  const setSpeed=(speed:number)=>setClock({anchor:getTime(),wall:Date.now(),speed});
  const step=(deltaMs:number)=>{
    const target=getTime()+deltaMs;
    setClock({anchor:target,wall:Date.now(),speed:0});
    if (mission&&(target<Date.parse(mission.track[0].time)+5*60000||target>Date.parse(mission.track[mission.track.length-1].time)-5*60000)) void fetchMission(target,station,mask);
  };
  const returnToLive=()=>{
    const target=Date.now();
    setClock({anchor:target,wall:target,speed:1});
    void fetchMission(target,station,mask);
  };
  const updateStation=(s:Station)=>{setStation(s);setPlacing(false);};
  const handlePlace=(point:{lat:number;lon:number})=>{
    updateStation({id:'custom',name:'Custom location',lat:Math.round(point.lat*10000)/10000,lon:Math.round(point.lon*10000)/10000});
    setPane('orbit');
  };
  const selectPass=(peak:string)=>{
    const target=Date.parse(peak);
    setClock({anchor:target,wall:Date.now(),speed:0});
    if(!mission||target<Date.parse(mission.track[0].time)||target>Date.parse(mission.track[mission.track.length-1].time))
      void fetchMission(target,station,mask);
    setPane('orbit');
  };
  const trackStart=mission?Date.parse(mission.track[0].time):0;
  const trackEnd=mission?Date.parse(mission.track[mission.track.length-1].time):0;
  const sliderValue=Math.min(trackEnd,Math.max(trackStart,simulatedTime));
  const progress=mission?Math.min(100,Math.max(0,(sliderValue-trackStart)/(trackEnd-trackStart)*100)):50;

  return <div className="app-root">
    <div className="backdrop-grain" aria-hidden="true" />
    <aside className="rail" aria-label="Main navigation">
      <div className="rail-logo"><CircleDot size={25} strokeWidth={1.5}/></div>
      <div className="rail-links">
        <button aria-label="Orbit overview" title="Orbit overview" className={`rail-item ${pane==='orbit'?'active':''}`} onClick={()=>setPane('orbit')}><Globe2 size={21}/></button>
        <button aria-label="Pass predictions" title="Pass predictions" className={`rail-item ${pane==='passes'?'active':''}`} onClick={()=>setPane('passes')}><Radio size={20}/></button>
        <button aria-label="Science details" title="Science details" className={`rail-item ${pane==='science'?'active':''}`} onClick={()=>setPane('science')}><Activity size={20}/></button>
        <button aria-label="Virtual orbit explorer" title="Orbit explorer" className={`rail-item ${pane==='explore'?'active':''}`} onClick={()=>setPane('explore')}><Orbit size={20}/></button>
      </div>
      <div className="rail-bottom"><div className="rail-separator"/><div className="rail-version">V 0.3</div></div>
    </aside>

    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-name">APHELION<span className="brand-period">.</span></span><span className="brand-divider"/><span className="brand-sub">ORBITAL DETECTIVE</span></div>
        <div className="topbar-right">
          <span className="environment-label">EXPERIMENT 003 <span className="small-dot">/</span> ORBIT EXPLORER</span>
          <span className={`realtime-badge ${isNearLive?'is-live':''}`}><span className="realtime-pulse"/>{isNearLive?'REAL-TIME PREDICTION':'SIMULATION TIME'}</span>
          <span className="utc-time"><Clock3 size={13}/> {new Date(simulatedTime).toISOString().slice(11,19)} <small>UTC</small></span>
        </div>
      </header>

      <div className="dashboard">
        <main className="primary-stage">
          <div className="hero-heading">
            <div className="hero-eyebrow"><span className="teal-line"/> EXPLORATION / 003 <span className="hero-eyebrow-muted">— ORBIT EXPLORER</span></div>
            <h1>{pane==='explore'?'Shape the orbit':'Earth, in motion'}<span>.</span></h1>
            <p>{pane==='explore'?'Real spacecraft. Hypothetical physics. One interactive Earth.':'Move your ground station. See the geometry respond.'}</p>
          </div>
          <div className="stage-canvas">
            <Globe mission={mission} preview={visiblePreview} station={station} current={current} getTime={getTime} placing={placing}
              onPlace={handlePlace} mask={mask}/>
            {pane!=='explore'&&<GroundControl station={station} mask={mask} placing={placing} calculating={loading||!synced}
              footprintKm={current ? mission!.coverage.earth_radius_km * current.footprint_deg * Math.PI/180 : null}
              onTogglePlacing={()=>setPlacing(previous=>!previous)} onMaskChange={setMask}/>}
            <button className={`stage-lab-toggle ${pane==='explore'?'active':''}`} onClick={()=>{setPane(pane==='explore'?'orbit':'explore');setPlacing(false);}} type="button"><Orbit size={16}/>{pane==='explore'?'EXIT ORBIT LAB':'OPEN ORBIT EXPLORER'} <span>↗</span></button>
            {pane==='explore'&&<div className="stage-lab-legend"><span className="stage-lab-legend__virtual"/> APHELION-X · TWO-BODY <span className="stage-lab-legend__real"/> ISS · SGP4</div>}
            <div className="stage-overlay top-left"><span className="holo-label">{mission ? 'TARGET ACQUIRED' : 'ISS SIGNAL UNAVAILABLE'}</span><div className="holo-title"><Satellite size={15}/> ISS <span>/ ZARYA</span></div><span className="holo-secondary">NORAD 25544 <span className="holo-sep">·</span> LOW EARTH ORBIT</span></div>
            <div className="stage-overlay bottom-left"><div className="coordinate-title">SUBSATELLITE POINT</div><strong>{current?coord(current.lat,true):'— — —'} <span>/</span> {current?coord(current.lon,false):'— — —'}</strong><div className="coordinates-caption">Earth-fixed geographic coordinates</div></div>
            <div className="stage-overlay bottom-right"><div className="hud-target"><Crosshair size={24} strokeWidth={1.1}/></div><span>{pane==='explore'?'KEPLER TWO-BODY / VIRTUAL':'SGP4 PROPAGATION / ISS'}<br/>REAL ELEMENTS REMAIN UNCHANGED</span></div>
            {error && pane!=='explore' && <div className="error-overlay" role="alert"><Info size={24}/><strong>Orbital data unavailable</strong><p>{error}</p><p>Start the Python backend and ensure CelesTrak is reachable. We never fabricate telemetry.</p><button onClick={()=>void fetchMission(getTime(),station,mask)}><RefreshCw size={14}/> Retry connection</button></div>}
            {loading && !mission&&!error && pane!=='explore' && <div className="loading-overlay"><div className="loading-orbit"/><span>ACQUIRING ORBITAL ELEMENTS</span></div>}
          </div>

          <section className="timeline" aria-label="Simulation controls">
            <div className="timeline-top"><span className="section-micro">TEMPORAL NAVIGATION</span><span className="timeline-time">{new Date(simulatedTime).toISOString().slice(0,10)} <b>{new Date(simulatedTime).toISOString().slice(11,19)}</b> UTC</span></div>
            <div className="timeline-controls">
              <div className="play-buttons"><button aria-label="Back ten minutes" title="Back ten minutes" onClick={()=>step(-600000)}><StepBack size={18}/></button><button className="play-pause" aria-label={clock.speed===0?'Play':'Pause'} onClick={()=>setSpeed(clock.speed===0?1:0)}>{clock.speed===0?<Play size={17} fill="currentColor"/>:<Pause size={17} fill="currentColor"/>}</button><button aria-label="Forward ten minutes" title="Forward ten minutes" onClick={()=>step(600000)}><StepForward size={18}/></button></div>
              <div className="scrubber"><div className="scrubber-top"><span>{mission?prettyTime(mission.track[0].time):'—'}</span><span>TRAJECTORY WINDOW</span><span>{mission?prettyTime(mission.track[mission.track.length-1].time):'—'}</span></div><div className="scrubber-track"><div className="scrubber-progress" style={{width:`${progress}%`}}/><input aria-label="Orbital simulation time" type="range" min={trackStart} max={trackEnd} step="1000" value={sliderValue} disabled={!mission} onChange={e=>setClock({anchor:Number(e.target.value),wall:Date.now(),speed:0})}/></div></div>
              <div className="speed-controls">{speeds.map(s=><button key={s} className={clock.speed===s?'active':''} onClick={()=>setSpeed(s)}>{s}×</button>)}<button className={`live-btn ${isNearLive?'live-active':''}`} onClick={returnToLive}><span/> NOW</button></div>
            </div>
          </section>
        </main>

        <aside className="data-panel" aria-label="Orbital measurements">
          <div className="panel-top">
            <div className="panel-kicker"><span className="teal-dot"/> MISSION CONTROL <span className="panel-serial">001 / ISS</span></div>
            <div className="panel-sat-heading"><div><small>{pane==='explore'?'VIRTUAL ORBITAL LAB':'ACTIVE SPACECRAFT'}</small><h2>{pane==='explore'?<>APHELION <span>—</span> X</>:<>ISS <span>—</span> ZARYA</>}</h2></div><span className="sat-icon">{pane==='explore'?<Orbit size={23} strokeWidth={1.35}/>:<Satellite size={23} strokeWidth={1.35}/>}</span></div>
            <div className="sat-id">{pane==='explore'?<><span className="mini-chip">IDEAL 2-BODY</span><span className="mini-chip">e = 0</span><span className="mini-chip amber">VIRTUAL</span></>:<><span className="mini-chip">NORAD 25544</span><span className="mini-chip">LEO</span><span className="mini-chip amber">PREDICTED</span></>}</div>
          </div>
          <div className="panel-tabs" role="tablist" aria-label="Data panels">
            <button role="tab" aria-selected={pane==='orbit'} className={pane==='orbit'?'active':''} onClick={()=>setPane('orbit')}>TELEMETRY</button>
            <button role="tab" aria-selected={pane==='passes'} className={pane==='passes'?'active':''} onClick={()=>setPane('passes')}>PASSES</button>
            <button role="tab" aria-selected={pane==='science'} className={pane==='science'?'active':''} onClick={()=>setPane('science')}>SCIENCE</button>
            <button role="tab" aria-selected={pane==='explore'} className={pane==='explore'?'active':''} onClick={()=>{setPane('explore');setPlacing(false);}}>EXPLORER</button>
          </div>
          <AnimatePresence mode="wait">
            {pane==='explore'&&<OrbitExplorer key="explore" altitude={altitude} inclination={inclination}
              onAltitude={setAltitude} onInclination={setInclination}
              onPreset={(h,i)=>{setAltitude(h);setInclination(i);}}
              preview={preview} loading={previewLoading||!previewSynced} error={previewError}
              realAltitude={current?.alt_km??null} realPeriod={mission?.satellite.period_minutes??null}
              onRetry={()=>void fetchPreview(getTime(),altitude,inclination)} />}
            {pane==='orbit'&&<motion.div key="orbit" className="panel-scroll" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2}}>
              <div className="measurements-head"><span>ORBITAL TELEMETRY</span><span><span className="green-pip"/> ESTIMATED</span></div>
              <div className="telemetry-grid">
                <Stat label="ALTITUDE" value={current?fmt(current.alt_km,1):'—'} unit="km" trend="up"/>
                <Stat label="VELOCITY" value={current?fmt(current.speed_km_s,2):'—'} unit="km/s"/>
                <Stat label="INCLINATION" value={mission?fmt(mission.satellite.inclination_deg,2):'—'} unit="deg"/>
                <Stat label="ORBITAL PERIOD" value={mission?fmt(mission.satellite.period_minutes,1):'—'} unit="min"/>
              </div>
              <div className="panel-divider"/>
              <div className="station-heading"><span>GROUND STATION</span><span>GS—01</span></div>
              <StationSelector station={station} onChange={updateStation} disabled={false}/>
              <div className="station-coordinates">{coord(station.lat,true)} <span>/</span> {coord(station.lon,false)} <span>·</span> MIN {mask}°</div>
              <div className="station-angles"><div><span>AZIMUTH</span><strong>{current?fmt(current.azimuth_deg,1):'—'}°</strong></div><div><span>ELEVATION</span><strong>{current?fmt(current.elevation_deg,1):'—'}°</strong></div><div><span>SLANT RANGE</span><strong>{current?fmt(current.slant_km,0):'—'} <small>km</small></strong></div></div>
              <div className="contact-margin"><span>CONTACT MARGIN</span>
                <strong className={current && current.contact_margin_deg>=0 ? 'positive' : 'negative'}>
                  {current ? `${current.contact_margin_deg>=0?'+':''}${fmt(current.contact_margin_deg,1)}°` : '—'}
                </strong>
                <div className="contact-margin__scale"><span className="contact-margin__zero"/>
                  {current&&<span className="contact-margin__needle" style={{left:`${(Math.max(-30,Math.min(30,current.contact_margin_deg))+30)/60*100}%`}}/>}
                </div>
              </div>
              <div className={`contact-card ${isContact?'contact-on':''}`}><div className="contact-indicator"><Signal size={20}/></div><div><strong>{!current?'RECALCULATING':isContact?'ABOVE ELEVATION MASK':'BELOW CONTACT MASK'}</strong><span>{!current?'Waiting for updated station geometry':isContact?`Elevation above ${mask}° threshold`:`Elevation below ${mask}° threshold`}</span></div><div className="contact-led"/></div>
              <ElevationGraph track={synced ? mission?.track??[] : []} currentTime={simulatedTime} mask={mask}/>
            </motion.div>}
            {pane==='passes'&&<motion.div key="passes" className="panel-scroll" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2}}>
              <div className="measurements-head"><span>UPCOMING CONTACT WINDOWS</span><span>NEXT 24 HOURS</span></div>
              <StationSelector station={station} onChange={updateStation} disabled={false}/>
              <div className="passes-intro">Predicted complete passes above a <b>{mask}°</b> elevation mask. Select a pass to jump to its peak. Times UTC.</div>
              {(synced ? mission?.passes??[] : []).length ? mission!.passes.map((p,i)=><button type="button" key={p.start} className="pass-card" onClick={()=>selectPass(p.peak)} aria-label={`Jump to peak of pass ${i+1} at ${prettyTime(p.peak)} UTC`}><div className="pass-number">PASS {String(i+1).padStart(2,'0')} <span>{p.max_elevation_deg.toFixed(1)}° PEAK</span></div><div className="pass-time"><span>{prettyTime(p.start)}</span><div className="pass-time-bar"><span/></div><span>{prettyTime(p.end)}</span></div><div className="pass-bottom"><span>RISE → SET</span><span>{p.duration_minutes.toFixed(1)} MIN · VIEW PEAK ↗</span></div></button>) : <div className="empty-state">{synced?'No complete passes found in this 24-hour window.':'Recalculating station visibility...'}</div>}
              <div className="panel-footnote">Predictions are based on orbital elements, not an operational radio connection. The footprint circle is a spherical approximation.</div>
            </motion.div>}
            {pane==='science'&&<motion.div key="science" className="panel-scroll" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.2}}>
              <div className="measurements-head"><span>SCIENTIFIC PROVENANCE</span><span>OPEN DATA</span></div>
              <div className="science-row"><span>STATION LAT / LON (WGS84)</span><strong>{coord(station.lat,true)} / {coord(station.lon,false)}</strong></div>
              <div className="science-row"><span>ELEVATION MASK</span><strong>{mask}° above local horizon</strong></div>
              <div className="science-row"><span>REFERENCE FOOTPRINT RADIUS</span><strong>{current ? `${fmt(6371*Math.PI/180*current.footprint_deg,0)} km` : '—'} (spherical model)</strong></div>
              <div className="science-row"><span>PROPAGATION MODEL</span><strong>SGP4 via Skyfield</strong></div>
              <div className="science-row"><span>ELEMENT SOURCE</span><strong>CelesTrak GP / TLE</strong></div>
              <div className="science-row"><span>ELEMENT EPOCH</span><strong>{mission?mission.provenance.epoch_utc:'—'}</strong></div>
              <div className="science-row"><span>ELEMENT AGE</span><strong>{mission?`${fmt(mission.provenance.element_age_days,2)} days`:'—'}</strong></div>
              <div className="science-row"><span>DATA CACHE</span><strong>{mission?mission.provenance.cache_status.replace('_',' ').toUpperCase():'—'}</strong></div>
              <div className="science-note"><ShieldCheck size={21}/><p>Positions shown are <b>predictions</b> from orbital elements, not real-time telemetry. Predictions can become unreliable as elements age.</p></div>
              <div className="science-note amber-note"><Info size={21}/><p>3D planet texture is stylized for visualization. Ground-station angles use Skyfield/WGS84 on the backend. The glowing footprint uses idealized spherical geometry, so its boundary may differ slightly from the WGS84 elevation test.</p></div>
              <a className="science-link" href="https://celestrak.org/NORAD/documentation/gp-data-formats.php" target="_blank" rel="noreferrer">ABOUT THE DATA SOURCE <ArrowUpRight size={16}/></a>
            </motion.div>}
          </AnimatePresence>
          <div className="panel-end"><Waves size={15}/><span>APHELION SCIENCE ENGINE</span><span className="engine-ping"/></div>
        </aside>
      </div>
      <footer className="bottom-bar"><span>APHELION / EXPERIMENT 003</span><span><span className="small-dot">●</span> REFERENCE FRAME: EARTH FIXED GEOCOORDINATES</span><span><Info size={13}/> EDUCATIONAL ORBITAL PREDICTIONS <span className="bottom-extra">— NOT FLIGHT TELEMETRY</span></span></footer>
    </div>
  </div>;
}
