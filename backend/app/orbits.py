"""Orbital calculations: Skyfield / SGP4. No synthesized live telemetry."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from threading import Lock
import math
import os
import urllib.request

from skyfield.api import EarthSatellite, load, wgs84

UTC = timezone.utc
DATA_DIRECTORY = Path(os.environ.get("ORBIT_DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
TLE_FILE = DATA_DIRECTORY / "iss_25544.tle"
CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE"
CACHE_TTL = timedelta(hours=6)
_lock = Lock()
_last_fetch_attempt: datetime | None = None


@lru_cache(maxsize=1)
def timescale():
    return load.timescale()


def dt_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def safe_satellite() -> tuple[EarthSatellite, dict]:
    """Fetch at most once per 6 h. Use a clearly flagged local cache if network fails."""
    global _last_fetch_attempt
    with _lock:
        DATA_DIRECTORY.mkdir(parents=True, exist_ok=True)
        now = datetime.now(UTC)
        cache_exists = TLE_FILE.is_file()
        cache_age = (now - datetime.fromtimestamp(TLE_FILE.stat().st_mtime, UTC)) if cache_exists else None
        fresh = cache_age is not None and cache_age < CACHE_TTL
        status = "fresh_cache" if fresh else "updated"
        backoff = (_last_fetch_attempt is not None and (now - _last_fetch_attempt) < timedelta(minutes=15))
        if not fresh and (not backoff or not cache_exists):
            _last_fetch_attempt = now
            try:
                request = urllib.request.Request(
                    CELESTRAK_URL,
                    headers={"User-Agent": "OrbitalDetective/0.1 (educational orbit visualizer)"},
                )
                with urllib.request.urlopen(request, timeout=12) as response:
                    tle = response.read(10_000).decode("utf-8")
                rows = [line.strip() for line in tle.splitlines() if line.strip()]
                if len(rows) < 2 or not rows[-2].startswith("1 ") or not rows[-1].startswith("2 "):
                    raise ValueError("CelesTrak returned invalid TLE data")
                TLE_FILE.with_suffix(".tmp").write_text(tle, encoding="utf-8")
                TLE_FILE.with_suffix(".tmp").replace(TLE_FILE)
            except Exception as exc:
                if not cache_exists:
                    raise RuntimeError(f"Satellite elements unavailable: {exc}") from exc
                status = "stale_cache"
        elif not fresh:
            status = "stale_cache"

        rows = [line.strip() for line in TLE_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]
        line1, line2 = rows[-2:]
        if not line1.startswith("1 ") or not line2.startswith("2 "):
            raise RuntimeError("Cached orbital data is not valid TLE")
        satellite = EarthSatellite(line1, line2, "ISS (ZARYA)", timescale())
        epoch = satellite.epoch.utc_datetime()
        return satellite, {
            "source": "CelesTrak GP orbital elements",
            "source_url": CELESTRAK_URL,
            "propagator": "SGP4 / Skyfield",
            "epoch_utc": dt_iso(epoch),
            "cache_status": status,
            "element_age_days": round((now - epoch).total_seconds() / 86400, 2),
            "telemetry": False,
        }


def point_at(satellite: EarthSatellite, observer, instant: datetime) -> dict:
    t = timescale().from_datetime(instant)
    geocentric = satellite.at(t)
    location = wgs84.geographic_position_of(geocentric)
    elevation, azimuth, slant = (satellite - observer).at(t).altaz()
    speed = math.sqrt(sum(v * v for v in geocentric.velocity.km_per_s))
    return {
        "time": dt_iso(instant),
        "lat": round(location.latitude.degrees, 5),
        "lon": round(location.longitude.degrees, 5),
        "alt_km": round(location.elevation.km, 3),
        "speed_km_s": round(speed, 5),
        "elevation_deg": round(elevation.degrees, 3),
        "azimuth_deg": round(azimuth.degrees % 360, 3),
        "slant_km": round(slant.km, 3),
    }


def upcoming_passes(satellite: EarthSatellite, station, start: datetime, mask: float = 10.0) -> list[dict]:
    """Returns *complete* above-mask passes within the next 24 h."""
    start_ts = timescale().from_datetime(start)
    end_ts = timescale().from_datetime(start + timedelta(hours=24))
    events_t, events = satellite.find_events(station, start_ts, end_ts, altitude_degrees=mask)
    passes: list[dict] = []
    rise = None
    peak = None
    for t, event in zip(events_t, events):
        d = t.utc_datetime()
        if event == 0:
            rise = d
            peak = None
        elif event == 1 and rise is not None:
            peak = d
        elif event == 2:
            if rise is not None and peak is not None and d > rise:
                angle, _, _ = (satellite - station).at(timescale().from_datetime(peak)).altaz()
                passes.append({
                    "start": dt_iso(rise),
                    "peak": dt_iso(peak),
                    "end": dt_iso(d),
                    "max_elevation_deg": round(angle.degrees, 1),
                    "duration_minutes": round((d - rise).total_seconds() / 60, 1),
                })
            rise = None
            peak = None
    return passes[:8]


def build_mission(satellite: EarthSatellite, provenance: dict, at: datetime, station_lat: float, station_lon: float):
    observer = wgs84.latlon(station_lat, station_lon)
    if abs((at - satellite.epoch.utc_datetime()).total_seconds()) > 14 * 86400:
        raise ValueError("Requested time is more than 14 days from the orbital-element epoch. Refusing an unreliable propagation.")
    state = point_at(satellite, observer, at)
    start = at - timedelta(minutes=55)
    track = [point_at(satellite, observer, start + timedelta(seconds=i * 45)) for i in range(148)]
    model = satellite.model
    return {
        "satellite": {
            "name": satellite.name,
            "catalog_number": 25544,
            "inclination_deg": round(math.degrees(model.inclo), 3),
            "period_minutes": round(2 * math.pi / model.no_kozai, 2),
        },
        "station": {"name": "Selected ground station", "lat": station_lat, "lon": station_lon, "minimum_elevation_deg": 10.0},
        "state": state,
        "track": track,
        "passes": upcoming_passes(satellite, observer, at),
        "provenance": provenance,
        "computed_at": dt_iso(datetime.now(UTC)),
    }
