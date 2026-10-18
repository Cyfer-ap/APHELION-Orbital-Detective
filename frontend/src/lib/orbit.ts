export type Sample = {
  time: string; lat: number; lon: number; alt_km: number; speed_km_s: number;
  elevation_deg: number; azimuth_deg: number; slant_km: number;
  contact_margin_deg: number; footprint_deg: number;
};
export type PredictedPass = {
  start: string; peak: string; end: string; max_elevation_deg: number; duration_minutes: number;
};
export type Mission = {
  satellite: { name: string; catalog_number: number; inclination_deg: number; period_minutes: number };
  station: { name: string; lat: number; lon: number; minimum_elevation_deg: number };
  state: Sample;
  track: Sample[];
  passes: PredictedPass[];
  provenance: { source: string; epoch_utc: string; cache_status: string; element_age_days: number; propagator: string; telemetry: boolean };
  coverage: { model: 'spherical_reference'; earth_radius_km: number; central_angle_deg: number; surface_radius_km: number; description: string };
  computed_at: string;
};
export type Station = { id: string; name: string; lat: number; lon: number };
export const STATIONS: Station[] = [
  { id: 'delhi', name: 'New Delhi, India', lat: 28.6139, lon: 77.2090 },
  { id: 'tokyo', name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
  { id: 'oslo', name: 'Oslo, Norway', lat: 59.9139, lon: 10.7522 },
  { id: 'sf', name: 'San Francisco, USA', lat: 37.7749, lon: -122.4194 }
];

const lerp = (a: number, b: number, t: number) => a + (b-a)*t;
const angle = (a: number, b: number, t: number) => (a + (((b-a+540)%360)-180)*t + 360)%360;
export function interpolate(track: Sample[], ms: number): Sample | null {
  if (!track.length) return null;
  if (ms <= Date.parse(track[0].time)) return track[0];
  if (ms >= Date.parse(track[track.length-1].time)) return track[track.length-1];
  let lo=0, hi=track.length-1;
  while (hi-lo>1) {
    const mid = (lo+hi)>>1;
    if (Date.parse(track[mid].time) <= ms) lo=mid; else hi=mid;
  }
  const a=track[lo], b=track[hi];
  const t=(ms-Date.parse(a.time))/(Date.parse(b.time)-Date.parse(a.time));
  const shortestLon = angle(a.lon+180, b.lon+180, t)-180;
  return {
    time: new Date(ms).toISOString(),
    lat: lerp(a.lat,b.lat,t), lon: shortestLon,
    alt_km:lerp(a.alt_km,b.alt_km,t), speed_km_s:lerp(a.speed_km_s,b.speed_km_s,t),
    elevation_deg:lerp(a.elevation_deg,b.elevation_deg,t),
    azimuth_deg:angle(a.azimuth_deg,b.azimuth_deg,t), slant_km:lerp(a.slant_km,b.slant_km,t),
    contact_margin_deg: lerp(a.contact_margin_deg,b.contact_margin_deg,t), footprint_deg:lerp(a.footprint_deg,b.footprint_deg,t)
  };
}
export const earthVector = (lat: number, lon: number, altKm=0): [number,number,number] => {
  const phi = lat*Math.PI/180, lambda=lon*Math.PI/180;
  const r=1.7*(1+altKm/6371);
  return [r*Math.cos(phi)*Math.cos(lambda), r*Math.sin(phi), -r*Math.cos(phi)*Math.sin(lambda)];
};
export const prettyTime = (iso: string, withSeconds=false) => new Date(iso).toLocaleTimeString('en-GB', {
  hour:'2-digit', minute:'2-digit', ...(withSeconds ? {second:'2-digit'} : {}), timeZone:'UTC'
});
export const coord = (value: number, northSouth: boolean) => `${Math.abs(value).toFixed(2)}° ${northSouth ? (value>=0?'N':'S') : (value>=0?'E':'W')}`;

/** Inverse of earthVector, for raycast clicks on the Earth-fixed globe. */
export function surfaceCoordinates(point: { x: number; y: number; z: number }): { lat: number; lon: number } {
  const r = Math.hypot(point.x, point.y, point.z);
  return {lat: Math.asin(point.y / r) * 180 / Math.PI, lon: Math.atan2(-point.z, point.x) * 180 / Math.PI};
}

/** Keplerian mission designer; altitude_km is the PERIGEE altitude. */
export type OrbitDesign = {
  altitude_km: number;
  inclination_deg: number;
  eccentricity: number;
  raan_deg: number;
  argument_of_periapsis_deg: number;
  phase_deg_at_epoch: number;
};
export type PreviewSample = {
  time: string; lat: number; lon: number; alt_km: number; radius_km: number;
  speed_km_s: number; true_anomaly_deg: number;
};
export type OrbitPreview = {
  kind: 'hypothetical_elliptical_two_body'; name: string;
  epoch_utc: string;
  parameters: OrbitDesign;
  derived: {
    orbital_radius_km: number; semimajor_axis_km: number; period_minutes: number;
    speed_km_s: number; angular_rate_rad_s: number;
    perigee_altitude_km: number; apogee_altitude_km: number;
    perigee_speed_km_s: number; apogee_speed_km_s: number;
    specific_energy_km2_s2: number;
  };
  state: PreviewSample;
  apsides: { perigee: PreviewSample; apogee: PreviewSample };
  track: PreviewSample[]; plane_track: PreviewSample[]; assumptions: string[];
};

/** Time-interpolated display samples, with wrapped longitudes and anomalies.
 * Outside the backend coverage window, return null rather than freezing.
 */
export function interpolatePreview(track: PreviewSample[], ms: number): PreviewSample | null {
  if (!track.length || ms < Date.parse(track[0].time) || ms > Date.parse(track[track.length-1].time)) return null;
  let low = 0, high = track.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (Date.parse(track[mid].time) <= ms) low = mid; else high = mid;
  }
  const a = track[low], b = track[high];
  const span = Date.parse(b.time) - Date.parse(a.time);
  const t = span > 0 ? (ms - Date.parse(a.time)) / span : 0;
  const anomaly = angle(a.true_anomaly_deg, b.true_anomaly_deg, t);
  return {
    time: new Date(ms).toISOString(),
    lat: lerp(a.lat,b.lat,t), lon: angle(a.lon+180,b.lon+180,t)-180,
    alt_km: lerp(a.alt_km,b.alt_km,t), radius_km: lerp(a.radius_km,b.radius_km,t),
    speed_km_s: lerp(a.speed_km_s,b.speed_km_s,t), true_anomaly_deg: anomaly,
  };
}

export type Integrator = 'rk4'|'verlet'|'euler';
export type LaboratoryConfig = { method:Integrator; step_seconds:number; duration_orbits:number };
export type LabSample = {time:string;lat:number;lon:number;alt_km:number;speed_km_s:number};
export type LabDiagnostic = {elapsed_minutes:number;position_error_km:number;relative_energy_drift_pct:number;relative_angular_momentum_drift_pct:number};
export type LabComparison = {
  kind:'two_body_numerical_comparison';epoch_utc:string;parameters:OrbitDesign;
  model:LaboratoryConfig & {period_minutes:number;max_substep_seconds:number;integration_substeps:number};
  reference_track:LabSample[];numerical_track:LabSample[];diagnostics:LabDiagnostic[];
  summary:{final_error_km:number;max_error_km:number;max_energy_drift_pct:number;max_angular_momentum_drift_pct:number};
  assumptions:string[];
};
export function interpolateLab(track:LabSample[],ms:number):LabSample|null{
  if(!track.length||ms<Date.parse(track[0].time)||ms>Date.parse(track[track.length-1].time))return null;
  let l=0,r=track.length-1;
  while(r-l>1){const m=(l+r)>>1;if(Date.parse(track[m].time)<=ms)l=m;else r=m;}
  const a=track[l],b=track[r];const width=Date.parse(b.time)-Date.parse(a.time);
  const t=width>0?(ms-Date.parse(a.time))/width:0;
  return {time:new Date(ms).toISOString(),lat:lerp(a.lat,b.lat,t),lon:angle(a.lon+180,b.lon+180,t)-180,
    alt_km:lerp(a.alt_km,b.alt_km,t),speed_km_s:lerp(a.speed_km_s,b.speed_km_s,t)};
}


/** Real ISS elements: SGP4 versus two-body RK4 from one identical epoch state. */
export type ForensicDiagnostic = {elapsed_minutes:number;separation_km:number;radial_km:number;along_track_km:number;cross_track_km:number};
export type ForensicComparison = {
  kind:'sgp4_vs_two_body_epoch_comparison';
  satellite:{name:string;catalog_number:number};epoch_utc:string;
  provenance:{source:string;epoch_utc:string;cache_status:string;element_age_days:number;propagator:string;telemetry:boolean};
  model:{horizon_hours:number;sampling_interval_minutes:number;integration_method:'rk4';maximum_integration_step_s:number};
  reference_track:LabSample[];numerical_track:LabSample[];diagnostics:ForensicDiagnostic[];
  summary:{final_separation_km:number;max_separation_km:number;max_separation_at_minutes:number;initial_specific_energy_km2_s2:number};
  assumptions:string[];
};

/** Two independently recorded ISS TLE element sets, propagated with the same SGP4 model. */
export type HistorySnapshot = {id:string;epoch_utc:string;recorded_at_utc:string;source:string};
export type HistoryComparison = {
  kind:'sgp4_historical_snapshot_comparison';
  satellite:{name:string;catalog_number:number};epoch_utc:string;
  reference:HistorySnapshot;candidate:HistorySnapshot;
  model:{horizon_hours:number;sampling_interval_minutes:number;integration_method:'sgp4';maximum_integration_step_s:number};
  reference_track:LabSample[];numerical_track:LabSample[];diagnostics:ForensicDiagnostic[];
  summary:{final_separation_km:number;max_separation_km:number;max_separation_at_minutes:number};
  assumptions:string[];
};


/** Hypothetical J₂ versus central-gravity comparison; same initial ECI state. */
export type J2Diagnostic = { elapsed_hours:number; raan_drift_deg:number|null; separation_km:number };
export type J2Comparison = {
  kind:'j2_vs_two_body'; epoch_utc:string; parameters:OrbitDesign;
  model:{horizon_days:number;step_seconds:number;earth_equatorial_radius_km:number;j2:number;comparison:string};
  window_start_utc:string;window_end_utc:string;
  reference_track:LabSample[];j2_track:LabSample[];diagnostics:J2Diagnostic[];
  summary:{secular_raan_rate_deg_day:number;final_raan_drift_deg:number|null;
    final_separation_km:number;max_sampled_separation_km:number};
  assumptions:string[];
};
