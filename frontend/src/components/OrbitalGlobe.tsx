import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars, useTexture } from '@react-three/drei';
import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ForensicComparison, LabComparison, Mission, OrbitPreview, Sample, Station } from '../lib/orbit';
import { earthVector, interpolate, interpolateLab, interpolatePreview, surfaceCoordinates } from '../lib/orbit';

type Coordinate = { lat: number; lon: number };

function Earth({ placing, onPlace }: { placing: boolean; onPlace: (coordinate: Coordinate) => void }) {
  const texture = useTexture('/earth-stylized.jpg');
  const [hover, setHover] = useState<Coordinate | null>(null);
  const hoverAt = useRef(0);
  texture.colorSpace = THREE.SRGBColorSpace;
  const onMove = (event: ThreeEvent<PointerEvent>) => {
    if (!placing || event.buttons !== 0 || performance.now() - hoverAt.current < 48) return;
    hoverAt.current = performance.now();
    setHover(surfaceCoordinates(event.point));
  };
  return <group>
    <mesh onPointerMove={onMove} onPointerOut={() => setHover(null)}
      onClick={event => {
        if (!placing || event.delta > 5) return; // Camera drags must never relocate the station.
        event.stopPropagation();
        setHover(null);
        onPlace(surfaceCoordinates(event.point));
      }}>
      <sphereGeometry args={[1.7, 96, 64]} />
      <meshStandardMaterial map={texture} color="#ffffff" metalness={0.04} roughness={0.87} />
    </mesh>
    {hover && placing && <group position={earthVector(hover.lat, hover.lon, 18)}>
      <mesh><sphereGeometry args={[0.043, 16, 16]} /><meshBasicMaterial color="#d7fff5" /></mesh>
      <mesh><sphereGeometry args={[0.094, 24, 24]} /><meshBasicMaterial color="#6df5dc" transparent opacity={0.26} depthWrite={false} /></mesh>
      <Html center distanceFactor={10} position={[0, .13, 0]} className="hover-tag" occlude>
        {Math.abs(hover.lat).toFixed(2)}°{hover.lat >= 0 ? 'N' : 'S'} · {Math.abs(hover.lon).toFixed(2)}°{hover.lon >= 0 ? 'E' : 'W'}
      </Html>
    </group>}
    <mesh scale={1.13} raycast={() => null}>
      <sphereGeometry args={[1.7, 96, 64]} />
      <shaderMaterial transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending}
        vertexShader={`varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vPosition=mv.xyz; gl_Position=projectionMatrix*mv;}`}
        fragmentShader={`varying vec3 vNormal; varying vec3 vPosition; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))), 3.7); gl_FragColor=vec4(0.11, 0.54, 1.0, rim*0.58);}`} />
    </mesh>
  </group>;
}

function DynamicSat({ track, getTime }: { track: Sample[]; getTime: () => number }) {
  const marker = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const value = interpolate(track, getTime());
    if (!value || !marker.current) return;
    marker.current.position.set(...earthVector(value.lat, value.lon, value.alt_km));
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3.8) * .20);
  });
  return <group ref={marker}>
    <mesh><sphereGeometry args={[0.033, 24, 24]} /><meshBasicMaterial color="#fff2d0" /></mesh>
    <mesh ref={halo}><sphereGeometry args={[0.078, 24, 24]} /><meshBasicMaterial color="#faac61" transparent opacity={0.22} depthWrite={false} /></mesh>
    <pointLight color="#ffb064" intensity={0.4} distance={1.15} />
    <Html className="satellite-tag" center distanceFactor={9} position={[0.18, 0.14, 0]} occlude>
      <span className="satellite-tag__pip" /><strong>ISS</strong><span className="satellite-tag__meta">25544</span>
    </Html>
  </group>;
}

function StationMarker({ station }: { station: Station }) {
  const group = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Vector3(...earthVector(station.lat, station.lon, 18)), [station.lat, station.lon]);
  const orientation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), target.clone().normalize()
  ), [target]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    if (group.current.position.length() < 0.1) group.current.position.copy(target);
    else group.current.position.lerp(target, .11).normalize().multiplyScalar(target.length());
    const ring = group.current.getObjectByName('ring') as THREE.Mesh | undefined;
    if (ring) {
      const s = 1.0 + .22 * Math.sin(clock.elapsedTime * 2.2);
      ring.scale.setScalar(s);
    }
  });
  return <group ref={group}>
    <mesh><sphereGeometry args={[0.032, 16, 16]} /><meshBasicMaterial color="#bcffed" /></mesh>
    <mesh name="ring" quaternion={orientation}>
      <torusGeometry args={[.078, .0038, 8, 48]} />
      <meshBasicMaterial color="#73efd3" transparent opacity={.65} depthWrite={false} />
    </mesh>
    <mesh><sphereGeometry args={[0.074, 18, 18]} /><meshBasicMaterial color="#67f7d1" transparent opacity={.18} depthWrite={false} /></mesh>
    <Html className="station-tag" position={[0.19, -.13, 0]} center distanceFactor={10} occlude>GS—01</Html>
  </group>;
}

/** The coverage circle is centered on the sub-satellite point, *not* the station.
 * Every displayed angular radius comes from Skyfield-backed API samples. */
function SurfaceFootprint({ current, mask }: { current: Sample | null; mask: number }) {
  const geometry = useMemo(() => {
    if (!current) return null;
    const latitude = current.lat * Math.PI / 180;
    const longitude = current.lon * Math.PI / 180;
    const psi = current.footprint_deg * Math.PI / 180;
    const edge: THREE.Vector3[] = [];
    const rings: THREE.Vector3[][] = [];
    // Mesh the spherical cap using radial subdivisions so the translucent fill
    // follows Earth curvature instead of disappearing beneath the surface.
    for (let radial = 0; radial <= 8; radial++) {
      const ring: THREE.Vector3[] = [];
      const angularRadius = psi * radial / 8;
      for (let i = 0; i <= 96; i++) {
        const bearing = i * Math.PI * 2 / 96;
        const destLat = Math.asin(Math.sin(latitude) * Math.cos(angularRadius)
          + Math.cos(latitude) * Math.sin(angularRadius) * Math.cos(bearing));
        const destLon = longitude + Math.atan2(
          Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latitude),
          Math.cos(angularRadius) - Math.sin(latitude) * Math.sin(destLat)
        );
        ring.push(new THREE.Vector3(...earthVector(destLat * 180 / Math.PI, destLon * 180 / Math.PI, 18)));
      }
      rings.push(ring);
      if (radial === 8) edge.push(...ring);
    }
    const positions: number[] = [];
    const pushTriangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      positions.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);
    };
    for (let radial = 1; radial <= 8; radial++) for (let i = 0; i < 96; i++) {
      pushTriangle(rings[radial-1][i], rings[radial][i], rings[radial][i+1]);
      pushTriangle(rings[radial-1][i], rings[radial][i+1], rings[radial-1][i+1]);
    }
    const fill = new THREE.BufferGeometry();
    fill.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    fill.computeVertexNormals();
    return { edge, fill };
  }, [current]);
  useEffect(() => () => geometry?.fill.dispose(), [geometry]);
  if (!geometry) return null;
  return <group raycast={() => null}>
    <mesh geometry={geometry.fill} raycast={() => null}>
      <meshBasicMaterial color="#79e8df" side={THREE.DoubleSide} transparent opacity={.11} depthWrite={false} />
    </mesh>
    <Line points={geometry.edge} color="#78eedc" opacity={.82} transparent lineWidth={1.8} raycast={() => null} />
    <Line points={geometry.edge} color="#5bd9e0" opacity={.16} transparent lineWidth={8} raycast={() => null} />
    <Html center distanceFactor={12} position={earthVector(current.lat, current.lon, 15)} occlude className="footprint-tag">
      {mask.toFixed(0)}° FOOTPRINT
    </Html>
  </group>;
}

function OrbitPath({ track, station, current, mask }: { track: Sample[]; station: Station; current: Sample | null; mask: number }) {
  const orbitalPoints = useMemo(() => track.map(p => new THREE.Vector3(...earthVector(p.lat, p.lon, p.alt_km))), [track]);
  const groundPoints = useMemo(() => track.map(p => new THREE.Vector3(...earthVector(p.lat, p.lon, 19))), [track]);
  const stationPos = useMemo(() => earthVector(station.lat, station.lon, 18), [station.lat, station.lon]);
  const inContact = !!current && current.elevation_deg >= mask;
  const satPos = current ? earthVector(current.lat, current.lon, current.alt_km) : stationPos;
  return <>
    <Line points={orbitalPoints} color="#b1c5ff" opacity={0.68} transparent lineWidth={1.3} raycast={() => null} />
    <Line points={groundPoints} color="#49adba" opacity={0.53} transparent lineWidth={0.9} raycast={() => null} />
    <SurfaceFootprint current={current} mask={mask} />
    <StationMarker station={station} />
    {inContact && <Line points={[stationPos, satPos]} color="#5aefcc" opacity={0.85} transparent lineWidth={2.0}
      dashed dashSize={0.045} gapSize={0.025} raycast={() => null} />}
  </>;
}

/** A frozen-at-instant Keplerian ellipse (violet) and Earth-rotated time trail.
 * Position, apsides and velocity all originate in the Python two-body engine. */
function VirtualOrbit({ preview, getTime }: { preview: OrbitPreview; getTime: () => number }) {
  const marker = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const orbitalPlane = useMemo(
    () => preview.plane_track.map(p => new THREE.Vector3(...earthVector(p.lat, p.lon, p.alt_km))),
    [preview.plane_track]
  );
  const groundTrail = useMemo(
    () => preview.track.map(p => new THREE.Vector3(...earthVector(p.lat, p.lon, 14))),
    [preview.track]
  );
  const perigee = useMemo(() => earthVector(preview.apsides.perigee.lat,
    preview.apsides.perigee.lon, preview.apsides.perigee.alt_km), [preview.apsides.perigee]);
  const apogee = useMemo(() => earthVector(preview.apsides.apogee.lat,
    preview.apsides.apogee.lon, preview.apsides.apogee.alt_km), [preview.apsides.apogee]);
  useFrame(({clock}) => {
    const state = interpolatePreview(preview.track, getTime());
    if(!marker.current)return;
    marker.current.visible=!!state;
    if(!state)return;
    marker.current.position.set(...earthVector(state.lat, state.lon, state.alt_km));
    if(glow.current)glow.current.scale.setScalar(1+Math.sin(clock.elapsedTime * 3.1)*.19);
  });
  return <group raycast={() => null}>
    <Line points={orbitalPlane} color="#c49bff" transparent opacity={.88} lineWidth={2.5} raycast={() => null}/>
    <Line points={orbitalPlane} color="#885dff" transparent opacity={.13} lineWidth={10} raycast={() => null}/>
    <Line points={groundTrail} color="#a976e7" transparent opacity={.48} dashed dashSize={.05} gapSize={.04} lineWidth={1.4} raycast={() => null}/>
    {/* Fixed-frame perigee and apogee annotations reveal how eccentricity and ω change geometry. */}
    <group position={perigee}>
      <mesh><sphereGeometry args={[.044, 16, 16]}/><meshBasicMaterial color="#f5b877"/></mesh>
      <mesh><sphereGeometry args={[.085, 16, 16]}/><meshBasicMaterial color="#f5b877" transparent opacity={.15} depthWrite={false}/></mesh>
      <Html center distanceFactor={9} position={[0, .13, 0]} className="apsis-label" occlude>PERIGEE · {Math.round(preview.derived.perigee_altitude_km).toLocaleString()} km</Html>
    </group>
    {preview.parameters.eccentricity > 0.001 && <group position={apogee}>
      <mesh><sphereGeometry args={[.044, 16, 16]}/><meshBasicMaterial color="#f5b877"/></mesh>
      <mesh><sphereGeometry args={[.085, 16, 16]}/><meshBasicMaterial color="#f5b877" transparent opacity={.15} depthWrite={false}/></mesh>
      <Html center distanceFactor={9} position={[0, .13, 0]} className="apsis-label" occlude>APOGEE · {Math.round(preview.derived.apogee_altitude_km).toLocaleString()} km</Html>
    </group>}
    <group ref={marker}>
      <mesh><sphereGeometry args={[.045, 20, 20]}/><meshBasicMaterial color="#f4dcff"/></mesh>
      <mesh ref={glow}><sphereGeometry args={[.104, 24, 24]}/><meshBasicMaterial color="#bc80ff" transparent opacity={.27} depthWrite={false}/></mesh>
      <pointLight color="#b577ff" intensity={.7} distance={1.2}/>
      <Html position={[.18, .18, 0]} center distanceFactor={8} className="virtual-sat-label" occlude><b>APHELION-X</b><span>KEPLERIAN ELLIPSE</span></Html>
    </group>
  </group>;
}


/** Independent numerical and analytic trajectories in the SAME Earth-fixed frame.
 * The animated separation is computed by the backend in inertial coordinates;
 * line and markers here only depict their locations without exaggerating error. */
function NumericalOrbit({ result, getTime }: { result: LabComparison | ForensicComparison; getTime: () => number }) {
  const forensic = result.kind === 'sgp4_vs_two_body_epoch_comparison';
  const reference = useRef<THREE.Group>(null);
  const numerical = useRef<THREE.Group>(null);
  const errorLine = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.BufferGeometry>(null);
  const analyticPoints = useMemo(() => result.reference_track.map(s => new THREE.Vector3(...earthVector(s.lat,s.lon,s.alt_km))), [result.reference_track]);
  const numericPoints = useMemo(() => result.numerical_track.map(s => new THREE.Vector3(...earthVector(s.lat,s.lon,s.alt_km))), [result.numerical_track]);
  const errorPoints = useMemo(() => new Float32Array(6), []);
  useFrame(() => {
    const when = getTime();
    const a = interpolateLab(result.reference_track,when);
    const b = interpolateLab(result.numerical_track,when);
    const visible = !!a && !!b;
    if (reference.current) reference.current.visible = visible;
    if (numerical.current) numerical.current.visible = visible;
    if (errorLine.current) errorLine.current.visible = visible;
    if(!a||!b)return;
    const av=earthVector(a.lat,a.lon,a.alt_km);
    const bv=earthVector(b.lat,b.lon,b.alt_km);
    reference.current?.position.set(...av);
    numerical.current?.position.set(...bv);
    if(lineRef.current){
      errorPoints.set([...av,...bv]);
      const attr=lineRef.current.getAttribute('position') as THREE.BufferAttribute;
      attr.needsUpdate=true;
      lineRef.current.computeBoundingSphere();
    }
  });
  return <group raycast={() => null}>
    <Line points={analyticPoints} color="#c39cff" lineWidth={2.3} opacity={.9} transparent raycast={() => null}/>
    <Line points={numericPoints} color="#f2aa70" lineWidth={2} opacity={.83} transparent dashed dashSize={.035} gapSize={.024} raycast={() => null}/>
    <group ref={errorLine}>
      <line raycast={() => null}>
        <bufferGeometry ref={lineRef}><bufferAttribute attach="attributes-position" args={[errorPoints,3]}/></bufferGeometry>
        <lineBasicMaterial color="#f7ddb9" transparent opacity={.8} depthTest={false}/>
      </line>
    </group>
    <group ref={reference}>
      <mesh><sphereGeometry args={[.045,18,18]}/><meshBasicMaterial color="#dfc7ff"/></mesh>
      <mesh><sphereGeometry args={[.083,16,16]}/><meshBasicMaterial color="#b47eff" transparent opacity={.17} depthWrite={false}/></mesh>
      <Html distanceFactor={9} center position={[0,.15,0]} className="virtual-sat-label" occlude><b>{forensic?'SGP4 · ISS':'REFERENCE'}</b><span>{forensic?'PUBLISHED ELEMENTS':'ANALYTIC KEPLER'}</span></Html>
    </group>
    <group ref={numerical}>
      <mesh><sphereGeometry args={[.047,18,18]}/><meshBasicMaterial color="#ffd3a2"/></mesh>
      <mesh><sphereGeometry args={[.105,18,18]}/><meshBasicMaterial color="#f8ad71" transparent opacity={.23} depthWrite={false}/></mesh>
      <pointLight color="#f0a16d" intensity={.65} distance={1.3}/>
      <Html distanceFactor={9} center position={[0,-.16,0]} className="numerical-marker-label" occlude><b>{forensic?'TWO BODY':'NUMERICAL'}</b><span>{forensic?'RK4 · SAME EPOCH':result.kind === 'two_body_numerical_comparison'?result.model.method.toUpperCase():''}</span></Html>
    </group>
  </group>;
}

function Scene({ mission, preview, comparison, forensics, station, current, getTime, placing, onPlace, mask }: {
  mission: Mission | null; preview: OrbitPreview | null; comparison: LabComparison | null; forensics: ForensicComparison | null; station: Station; current: Sample | null; getTime: () => number;
  placing: boolean; onPlace: (coordinates: Coordinate) => void; mask: number;
}) {
  return <>
    <ambientLight intensity={1.1} />
    <directionalLight position={[5, 2, 6]} intensity={2.5} color="#dceaff" />
    <directionalLight position={[-4, 2, -5]} intensity={0.3} color="#0d6dce" />
    <Stars radius={120} depth={80} count={1300} factor={3} fade speed={0.45} />
    <Suspense fallback={null}><Earth placing={placing} onPlace={onPlace} /></Suspense>
    {mission && <OrbitPath track={mission.track} station={station} current={current} mask={mask} />}
    {mission && <DynamicSat track={mission.track} getTime={getTime} />}
    {preview && <VirtualOrbit preview={preview} getTime={getTime} />}
    {comparison && <NumericalOrbit result={comparison} getTime={getTime} />}
    {forensics && <NumericalOrbit result={forensics} getTime={getTime} />}
    <OrbitControls enablePan={false} enableDamping dampingFactor={0.06}
      minDistance={3.7} maxDistance={13} autoRotate={!placing} autoRotateSpeed={0.24} />
  </>;
}

function Globe({ mission, preview, comparison, forensics, station, current, getTime, placing, onPlace, mask }: {
  mission: Mission | null; preview: OrbitPreview | null; comparison: LabComparison | null; forensics: ForensicComparison | null; station: Station; current: Sample | null; getTime: () => number;
  placing: boolean; onPlace: (coordinate: Coordinate) => void; mask: number;
}) {
  return <div className={`globe-container ${placing ? 'globe-is-placing' : ''}`}>
    <div className="globe-glow" aria-hidden="true" />
    <div className="globe-crosshairs" aria-hidden="true"><span /><span /></div>
    {mission || preview || comparison || forensics ? <Canvas camera={{ position: [2.7, 1.5, 4.7], fov: 44 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.8]}>
      <Scene mission={mission} preview={preview} comparison={comparison} forensics={forensics} station={station} current={current} getTime={getTime} placing={placing} onPlace={onPlace} mask={mask} />
    </Canvas> : <div className="globe-placeholder"><span className="placeholder-orb" /></div>}
    <div className="globe-hint">{placing ? 'CLICK THE PLANET TO POSITION GS—01' : 'DRAG TO ROTATE'} <span>·</span> SCROLL TO ZOOM</div>
  </div>;
}
export default memo(Globe);
