"""Recorded ISS TLE snapshot comparisons. No synthetic historical elements.

Archive a newly observed current CelesTrak TLE or validate an operator-provided
historical TLE. Two different element epochs are propagated to *common instants*
by Skyfield/SGP4. Separation is model-prediction disagreement, not ground truth.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from threading import Lock
import json
import math

from . import orbits
from .forensics import norm, ric_components
from .tle_validation import validate_tle_lines

HISTORY_FILE = orbits.DATA_DIRECTORY / 'iss_tle_history.json'
_LOCK = Lock()
UTC = timezone.utc


def parse_iss_tle(raw: str):
    """Validate a two- or three-line ISS TLE, including NORAD checksums."""
    lines = validate_tle_lines(raw)
    satellite = orbits.EarthSatellite(*lines, 'ISS (ZARYA)', orbits.timescale())
    epoch = satellite.epoch.utc_datetime().astimezone(UTC)
    if not 1998 <= epoch.year <= datetime.now(UTC).year + 1:
        raise ValueError('ISS element epoch outside plausible range')
    return lines, satellite, epoch


def _read_archive() -> list[dict]:
    if not HISTORY_FILE.is_file():
        return []
    try:
        records = json.loads(HISTORY_FILE.read_text(encoding='utf-8'))
        if not isinstance(records, list):
            raise ValueError('Archive is not a list')
        return records
    except (ValueError, OSError) as exc:
        raise ValueError(f'Historical element archive cannot be read: {exc}') from exc


def _public(record: dict) -> dict:
    return {k: record[k] for k in ('id', 'epoch_utc', 'recorded_at_utc', 'source')}


def _add_snapshot(raw: str, source: str):
    lines, _, epoch = parse_iss_tle(raw)
    canonical = '\n'.join(lines)
    identity = sha256(canonical.encode('ascii')).hexdigest()[:16]
    with _LOCK:
        archive = _read_archive()
        for record in archive:
            if record['id'] == identity:
                return _public(record)
        record = {
            'id': identity,
            'tle': canonical,
            'epoch_utc': orbits.dt_iso(epoch),
            'recorded_at_utc': orbits.dt_iso(datetime.now(UTC)),
            'source': source,
        }
        archive.append(record)
        archive.sort(key=lambda item: item['epoch_utc'], reverse=True)
        HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp = HISTORY_FILE.with_suffix('.tmp')
        temp.write_text(json.dumps(archive, indent=2) + '\n', encoding='utf-8')
        temp.replace(HISTORY_FILE)
        return _public(record)


def record_latest():
    """Archive current locally cached elements after the ordinary fetch logic runs."""
    _, provenance = orbits.safe_satellite()
    if orbits.TLE_FILE.is_file():
        return _add_snapshot(orbits.TLE_FILE.read_text(encoding='utf-8'), 'CelesTrak GP / local cache')
    raise ValueError('No ISS TLE in local cache')


def import_snapshot(raw: str) -> dict:
    return _add_snapshot(raw, 'User-supplied ISS TLE; source unverified')


def list_snapshots() -> list[dict]:
    with _LOCK:
        return [_public(record) for record in _read_archive()]


def compare_history(reference_id: str, candidate_id: str, horizon_hours: int = 6) -> dict:
    if horizon_hours not in (3, 6, 12, 24):
        raise ValueError('Horizon must be 3, 6, 12, or 24 hours')
    with _LOCK:
        available = {record['id']: record for record in _read_archive()}
    if reference_id == candidate_id:
        raise ValueError('Choose two different recorded element sets')
    if reference_id not in available or candidate_id not in available:
        raise ValueError('Snapshot not found in local ISS archive')
    first = available[reference_id]
    second = available[candidate_id]
    # Comparisons must meaningfully distinguish different element epochs.
    _, sat1, epoch1 = parse_iss_tle(first['tle'])
    _, sat2, epoch2 = parse_iss_tle(second['tle'])
    if epoch1 == epoch2:
        raise ValueError('Select element sets with distinct epochs')
    if abs((epoch1 - epoch2).total_seconds()) > 5 * 86400:
        raise ValueError('Element epochs are more than five days apart; select a closer pair')
    # Common prediction window begins at the later element epoch. Neither
    # trajectory is treated as observed ground truth.
    start = max(epoch1, epoch2)
    from skyfield.api import wgs84
    from skyfield.positionlib import Geocentric
    from skyfield.constants import AU_KM
    import numpy as np
    ts = orbits.timescale()
    n = 91
    interval = horizon_hours * 3600 / (n - 1)
    a_track, b_track, diagnostics = [], [], []
    for index in range(n):
        elapsed = index * interval
        instant = start + timedelta(seconds=elapsed)
        t = ts.from_datetime(instant)
        a = sat1.at(t)
        b = sat2.at(t)
        va = tuple(float(x) for x in a.position.km) + tuple(float(x) for x in a.velocity.km_per_s)
        vb = tuple(float(x) for x in b.position.km) + tuple(float(x) for x in b.velocity.km_per_s)
        if not all(math.isfinite(x) for x in (*va, *vb)):
            raise ValueError('Nonfinite SGP4 trajectory sample')
        r, along, cross = ric_components(va, vb)
        sep = norm([vb[k] - va[k] for k in range(3)])
        diagnostics.append({
            'elapsed_minutes': round(elapsed / 60, 4), 'separation_km': round(sep, 7),
            'radial_km': round(r, 7), 'along_track_km': round(along, 7),
            'cross_track_km': round(cross, 7),
        })
        def convert(state):
            # Reuse Skyfield's Earth-orientation machinery: both GCRS states
            # map to WGS84 at exactly the same timestamp.
            geocentric = Geocentric(np.array(state[:3], dtype=float) / AU_KM, t=t, center=399)
            point = wgs84.geographic_position_of(geocentric)
            return {'time': orbits.dt_iso(instant),
                    'lat': round(point.latitude.degrees, 6),
                    'lon': round(point.longitude.degrees, 6),
                    'alt_km': round(point.elevation.km, 4),
                    'speed_km_s': round(norm(state[3:]), 6)}
        a_track.append(convert(va))
        b_track.append(convert(vb))
    peak = max(diagnostics, key=lambda item: item['separation_km'])
    return {
        'kind': 'sgp4_historical_snapshot_comparison',
        'satellite': {'name': 'ISS (ZARYA)', 'catalog_number': 25544},
        'epoch_utc': orbits.dt_iso(start),
        'reference': _public(first), 'candidate': _public(second),
        'model': {'horizon_hours': horizon_hours, 'sampling_interval_minutes': interval / 60,
                  'integration_method': 'sgp4', 'maximum_integration_step_s': 0},
        'reference_track': a_track, 'numerical_track': b_track,
        'diagnostics': diagnostics,
        'summary': {'final_separation_km': diagnostics[-1]['separation_km'],
                    'max_separation_km': peak['separation_km'],
                    'max_separation_at_minutes': peak['elapsed_minutes']},
        'assumptions': [
            'Both predictions use SGP4 and distinct, recorded ISS TLEs.',
            'Both GCRS trajectories are compared at identical UTC instants, starting at the newer element epoch.',
            'Signed RIC components use the reference element set at each common timestamp.',
            'User-supplied TLE provenance is not independently authenticated.',
            'Separation is prediction disagreement, not observed error, maneuver evidence or collision risk.',
        ],
    }
