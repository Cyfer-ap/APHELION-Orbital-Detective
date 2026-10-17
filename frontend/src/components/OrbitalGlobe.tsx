import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars, useTexture } from '@react-three/drei';
import { memo, Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Mission, Sample, Station } from '../lib/orbit';
import { earthVector, interpolate } from '../lib/orbit';

function Earth() {
  const texture = useTexture('/earth-stylized.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  return <group>
    <mesh rotation={[0, 0, 0]}>
      <sphereGeometry args={[1.7, 96, 64]} />
      <meshStandardMaterial map={texture} color="#ffffff" metalness={0.04} roughness={0.87} />
    </mesh>
    <mesh scale={1.13}>
      <sphereGeometry args={[1.7, 96, 64]} />
      <shaderMaterial transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}
        vertexShader={`varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vPosition=mv.xyz; gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`varying vec3 vNormal; varying vec3 vPosition; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))), 3.7); gl_FragColor=vec4(0.11, 0.54, 1.0, rim*0.58);}`} />
    </mesh>
  </group>;
}

function DynamicSat({track, getTime}: {track: Sample[]; getTime: ()=>number}) {
  const marker = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({clock}) => {
    const value = interpolate(track, getTime());
    if (!value || !marker.current) return;
    marker.current.position.set(...earthVector(value.lat,value.lon,value.alt_km));
    if (halo.current) {
      const s=1.0+Math.sin(clock.elapsedTime*3.8)*.20;
      halo.current.scale.setScalar(s);
    }
  });
  return <group ref={marker}>
    <mesh>
      <sphereGeometry args={[0.033,24,24]}/>
      <meshBasicMaterial color="#fff2d0" />
    </mesh>
    <mesh ref={halo}>
      <sphereGeometry args={[0.078,24,24]}/>
      <meshBasicMaterial color="#faac61" transparent opacity={0.22} depthWrite={false}/>
    </mesh>
    <pointLight color="#ffb064" intensity={0.4} distance={1.15}/>
    <Html className="satellite-tag" center distanceFactor={9} position={[0.18,0.14,0]} occlude>
      <span className="satellite-tag__pip"/><strong>ISS</strong><span className="satellite-tag__meta">25544</span>
    </Html>
  </group>;
}

function OrbitPath({track, station, current}:{track:Sample[]; station:Station; current: Sample|null}){
  const orbitalPoints=useMemo(()=>track.map(p=>new THREE.Vector3(...earthVector(p.lat,p.lon,p.alt_km))),[track]);
  const groundPoints=useMemo(()=>track.map(p=>new THREE.Vector3(...earthVector(p.lat,p.lon,19))),[track]);
  const stationPos=useMemo(()=>earthVector(station.lat,station.lon,18),[station.lat,station.lon]);
  const inContact = !!current && current.elevation_deg >= 10;
  const satPos=current ? earthVector(current.lat,current.lon,current.alt_km) : stationPos;
  return <>
    <Line points={orbitalPoints} color="#b1c5ff" opacity={0.68} transparent lineWidth={1.3}/>
    <Line points={groundPoints} color="#49adba" opacity={0.53} transparent lineWidth={0.9}/>
    <group position={stationPos}>
      <mesh><sphereGeometry args={[0.024,12,12]}/><meshBasicMaterial color="#74f4d3"/></mesh>
      <mesh><sphereGeometry args={[0.057,18,18]}/><meshBasicMaterial color="#67f7d1" transparent opacity={0.22} depthWrite={false}/></mesh>
      <Html className="station-tag" position={[0.18,-0.14,0]} center distanceFactor={10} occlude>GS-01</Html>
    </group>
    {inContact && <Line points={[stationPos,satPos]} color="#5aefcc" opacity={0.8} transparent lineWidth={1.7} dashed dashSize={0.045} gapSize={0.025}/>}
  </>;
}

function Scene({mission,station,current,getTime}:{mission:Mission; station:Station; current:Sample|null; getTime:()=>number}) {
  return <>
    <ambientLight intensity={1.1}/>
    <directionalLight position={[5,2,6]} intensity={2.5} color="#dceaff" />
    <directionalLight position={[-4,2,-5]} intensity={0.3} color="#0d6dce" />
    <Stars radius={120} depth={80} count={1300} factor={3} fade speed={0.45}/>
    <Suspense fallback={null}><Earth/></Suspense>
    <OrbitPath track={mission.track} station={station} current={current}/>
    <DynamicSat track={mission.track} getTime={getTime}/>
    <OrbitControls enablePan={false} enableDamping dampingFactor={0.06} minDistance={3.7} maxDistance={9} autoRotate autoRotateSpeed={0.24} />
  </>;
}

function Globe({mission,station,current,getTime}:{mission:Mission|null; station:Station; current:Sample|null; getTime:()=>number}) {
  return <div className="globe-container">
    <div className="globe-glow" aria-hidden="true"/>
    <div className="globe-crosshairs" aria-hidden="true"><span/><span/></div>
    {mission ? <Canvas camera={{position:[2.7,1.5,4.7],fov:44}} gl={{antialias:true,alpha:true}} dpr={[1,1.8]}>
      <Scene mission={mission} station={station} current={current} getTime={getTime}/>
    </Canvas> : <div className="globe-placeholder"><span className="placeholder-orb"/></div>}
    <div className="globe-hint">DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM</div>
  </div>;
}
export default memo(Globe);
