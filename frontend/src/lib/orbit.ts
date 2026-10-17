export type Sample = {
  time: string; lat: number; lon: number; alt_km: number; speed_km_s: number;
  elevation_deg: number; azimuth_deg: number; slant_km: number;
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
    azimuth_deg:angle(a.azimuth_deg,b.azimuth_deg,t), slant_km:lerp(a.slant_km,b.slant_km,t)
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
