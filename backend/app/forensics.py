"""SGP4 versus unperturbed two-body continuation of the SAME epoch state.

This compares models, not two orbit determinations, actual observations, or
collision probabilities. All displacement diagnostics use GCRS Cartesian km.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
from .numerical import norm, step, energy, momentum


def cross(a, b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])


def dot(a, b):
    return sum(x*y for x,y in zip(a,b))


def ric_components(reference, candidate):
    """Signed RIC components (candidate minus reference), both in GCRS.

    Radial: reference position; cross-track: reference r x v;
    along-track: cross-track x radial (right handed).
    """
    r, v = reference[:3], reference[3:]
    delta = [b-a for a,b in zip(r, candidate[:3])]
    nr = norm(r)
    if nr == 0:
        raise ValueError('Cannot construct RIC basis at zero radius')
    radial = [x/nr for x in r]
    h = cross(r,v)
    nh = norm(h)
    if nh == 0:
        raise ValueError('Cannot construct RIC basis without angular momentum')
    cross_track = [x/nh for x in h]
    along_track = cross(cross_track, radial)
    return (dot(delta, radial), dot(delta, along_track), dot(delta, cross_track))


def rk4_continue(initial, seconds, maximum_step_s=45.0):
    """Advance a two-body GCRS Cartesian state from the common epoch state."""
    state = tuple(initial)
    count = int(math.ceil(seconds/maximum_step_s))
    if count < 1:
        return state
    h = seconds/count
    for _ in range(count):
        state = step(state,h,'rk4')
    return state


def build_forensics(satellite, provenance, horizon_hours: int = 6):
    """Compare satellite SGP4 and Keplerian continuation from its element epoch.

    Geocentric samples are converted to geographical WGS84 positions with
    Skyfield's GCRS-to-Earth-fixed transformation for a common display frame.
    """
    if type(horizon_hours) is not int or horizon_hours not in (3,6,12,24):
        raise ValueError('Horizon must be 3, 6, 12, or 24 hours')
    # Imported only on actual comparison: pure RIC/numerical helpers are testable
    # without a Skyfield/CelesTrak network connection.
    import numpy as np
    from skyfield.api import wgs84
    from skyfield.positionlib import Geocentric
    from skyfield.constants import AU_KM
    from .orbits import timescale

    epoch = satellite.epoch.utc_datetime().astimezone(timezone.utc)
    ts = timescale()
    baseline = satellite.at(ts.from_datetime(epoch))
    s0 = tuple(float(x) for x in baseline.position.km) + tuple(float(v) for v in baseline.velocity.km_per_s)
    if not all(math.isfinite(x) for x in s0):
        raise ValueError('SGP4 initial state is not finite')
    if norm(s0[:3]) < 6400 or norm(s0[:3]) > 100000:
        raise ValueError('Initial orbital state outside supported Earth-orbit bounds')
    # Sample every 3 min (3 h) to 12 min (24 h); always include endpoints.
    n_samples = 91 if horizon_hours == 3 else 121
    sample_dt = horizon_hours*3600/(n_samples-1)
    ref_track, two_body_track, diagnostics = [], [], []
    state = s0
    prev_elapsed = 0.0
    initial_energy = energy(s0)

    def point(position, instant, time):
        gcrs = Geocentric(np.array(position[:3], dtype=float)/AU_KM, t=time, center=399)
        geo = wgs84.geographic_position_of(gcrs)
        return {'time':instant.isoformat(timespec='milliseconds').replace('+00:00','Z'),
                'lat':round(geo.latitude.degrees,6), 'lon':round(geo.longitude.degrees,6),
                'alt_km':round(geo.elevation.km,4), 'speed_km_s':round(norm(position[3:]),6)}

    for idx in range(n_samples):
        elapsed = idx*sample_dt
        instant = epoch+timedelta(seconds=elapsed)
        t = ts.from_datetime(instant)
        predicted = satellite.at(t)
        ref = tuple(float(x) for x in predicted.position.km) + tuple(float(v) for v in predicted.velocity.km_per_s)
        if idx:
            state = rk4_continue(state,elapsed-prev_elapsed)
        prev_elapsed = elapsed
        if not all(math.isfinite(x) for x in (*ref,*state)):
            raise ValueError('Nonfinite orbital state during model comparison')
        radial, along, cross_component = ric_components(ref,state)
        difference = norm([state[k]-ref[k] for k in range(3)])
        diagnostics.append({'elapsed_minutes':round(elapsed/60,4),
                            'separation_km':round(difference,7),
                            'radial_km':round(radial,7),
                            'along_track_km':round(along,7),
                            'cross_track_km':round(cross_component,7)})
        ref_track.append(point(ref,instant,t))
        two_body_track.append(point(state,instant,t))
    peak=max(diagnostics,key=lambda d:d['separation_km'])
    return {
        'kind':'sgp4_vs_two_body_epoch_comparison',
        'satellite':{'name':satellite.name,'catalog_number':25544},
        'epoch_utc':epoch.isoformat(timespec='milliseconds').replace('+00:00','Z'),
        'provenance':provenance,
        'model':{'horizon_hours':horizon_hours,'sampling_interval_minutes':sample_dt/60,
                 'integration_method':'rk4','maximum_integration_step_s':45},
        'reference_track':ref_track,'numerical_track':two_body_track,
        'diagnostics':diagnostics,
        'summary':{'final_separation_km':diagnostics[-1]['separation_km'],
                   'max_separation_km':peak['separation_km'],
                   'max_separation_at_minutes':peak['elapsed_minutes'],
                   'initial_specific_energy_km2_s2':round(initial_energy,6)},
        'assumptions':[
            'Both trajectories start from the same GCRS state at the published TLE epoch.',
            'Reference: SGP4 propagated from CelesTrak orbital elements.',
            'Comparison: unperturbed Newtonian two-body orbit integrated with RK4.',
            'RIC components and norms use unrounded GCRS positions, not display coordinates.',
            'Difference measures model disagreement, not observation error or maneuver detection.',
            'Predictions become less reliable as element sets age; no uncertainty estimates.',
        ]}
