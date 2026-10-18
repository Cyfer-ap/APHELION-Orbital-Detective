"""J2 zonal gravity versus two-body RK4, in one defined inertial frame.

Educational osculating-element experiment. Both trajectories start from precisely
identical Cartesian states and use the same fixed RK4 step to isolate J2's effect.
ECI->globe coordinates reuse the existing approximate GMST visual transform.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math

from .explorer import EARTH_RADIUS_KM as R, MU_KM3_S2 as MU
from .numerical import added, globe_state, initial_state, norm, rhs, step

J2 = 1.08262668e-3
EQUATORIAL_RADIUS_KM = 6378.137  # WGS84 equatorial reference radius
STEP_SECONDS = 60


def j2_acceleration(state: tuple[float, ...], coefficient: float = J2) -> tuple[float, float, float]:
    """Physical J2 acceleration on top of central gravity; inertial z = spin axis.

    a_J2 = 3 J2 μ R_e²/(2 r⁵) * (x(5 z²/r²-1), y(5 z²/r²-1), z(5 z²/r²-3)).
    """
    x, y, z = state[:3]
    r2 = x*x + y*y + z*z
    if r2 < (R/2)**2:
        raise ValueError('Trajectory inside invalid central region')
    z2 = z*z/r2
    factor = 1.5 * coefficient * MU * EQUATORIAL_RADIUS_KM**2 / (r2**2.5)
    return (factor*x*(5*z2-1), factor*y*(5*z2-1), factor*z*(5*z2-3))


def j2_rhs(state: tuple[float, ...], coefficient: float = J2) -> tuple[float, ...]:
    ordinary = rhs(state)
    dx, dy, dz = j2_acceleration(state, coefficient)
    return (*ordinary[:3], ordinary[3]+dx, ordinary[4]+dy, ordinary[5]+dz)


def j2_step(state: tuple[float, ...], seconds: float, coefficient: float = J2) -> tuple[float, ...]:
    k1 = j2_rhs(state, coefficient)
    k2 = j2_rhs(added(state, k1, seconds/2), coefficient)
    k3 = j2_rhs(added(state, k2, seconds/2), coefficient)
    k4 = j2_rhs(added(state, k3, seconds), coefficient)
    return tuple(v + seconds*(a+2*b+2*c+d)/6 for v, a, b, c, d in zip(state, k1, k2, k3, k4))


def raan_degrees(state: tuple[float, ...]) -> float | None:
    """Ascending-node longitude of an osculating inertial Cartesian state.

    Undefined for equatorial planes (zero node vector). No fake zero is returned.
    """
    x,y,z,vx,vy,vz = state
    hx, hy = y*vz-z*vy, z*vx-x*vz
    n_x, n_y = -hy, hx
    h = norm((hx, hy, x*vy-y*vx))
    if math.hypot(n_x, n_y) < h*1e-10:
        return None
    return math.degrees(math.atan2(n_y,n_x)) % 360


def signed_delta_deg(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return (left-right+180)%360-180


def compare_j2(
    epoch: datetime, altitude_km: float = 450., inclination_deg: float = 51.6,
    eccentricity: float = .1, raan_deg: float = 35.,
    argument_of_periapsis_deg: float = 60., phase_deg_at_epoch: float = 0.,
    horizon_days: int = 3,
) -> dict:
    if epoch.tzinfo is None:
        raise ValueError('Epoch must include a timezone')
    values = (altitude_km, inclination_deg, eccentricity, raan_deg,
              argument_of_periapsis_deg, phase_deg_at_epoch)
    if not all(math.isfinite(v) for v in values):
        raise ValueError('Parameters must be finite')
    if not (200 <= altitude_km <= 2000 and 0 <= inclination_deg <= 180
            and 0 <= eccentricity <= .35 and 0 <= raan_deg <= 360
            and 0 <= argument_of_periapsis_deg <= 360 and 0 <= phase_deg_at_epoch <= 360
            and type(horizon_days) is int and horizon_days in (1, 3, 7)):
        raise ValueError('Parameter or horizon outside supported bounds')
    epoch = epoch.astimezone(timezone.utc)
    a = (R + altitude_km)/(1-eccentricity)
    inc, node, peri, anomaly = map(math.radians, (inclination_deg, raan_deg,
                                                  argument_of_periapsis_deg, phase_deg_at_epoch))
    base = initial_state(a, eccentricity, inc, node, peri, anomaly)
    ref = base
    perturbed = base
    # Leading-order secular regression, not a fitted numerical measurement.
    p = a*(1-eccentricity**2)
    mean_motion = math.sqrt(MU/a**3)
    predicted_rate = math.degrees(-1.5*J2*mean_motion*(EQUATORIAL_RADIUS_KM/p)**2*math.cos(inc))*86400
    steps_total = horizon_days*86400//STEP_SECONDS
    window_steps = min(180, steps_total)
    reference_track, j2_track, diagnostics = [], [], []
    max_separation = 0.
    baseline_raan = raan_degrees(base)
    for index in range(steps_total+1):
        if index:
            ref = step(ref, STEP_SECONDS, 'rk4')
            perturbed = j2_step(perturbed, STEP_SECONDS)
        if index % 60 == 0 or index == steps_total:
            sep = norm([perturbed[k]-ref[k] for k in range(3)])
            max_separation = max(sep, max_separation)
            observed = signed_delta_deg(raan_degrees(perturbed), baseline_raan)
            diagnostics.append({'elapsed_hours':round(index*STEP_SECONDS/3600,3),
                                'raan_drift_deg':round(observed,6) if observed is not None else None,
                                'separation_km':round(sep,5)})
        if index >= steps_total-window_steps:
            when = epoch+timedelta(seconds=index*STEP_SECONDS)
            reference_track.append(globe_state(ref, when))
            j2_track.append(globe_state(perturbed, when))
        if not all(math.isfinite(x) for x in (*ref, *perturbed)):
            raise ValueError('Orbit propagation produced a nonfinite state')
    return {
        'kind':'j2_vs_two_body',
        'epoch_utc':epoch.isoformat(timespec='seconds').replace('+00:00','Z'),
        'parameters':{'altitude_km':altitude_km, 'inclination_deg':inclination_deg,
                      'eccentricity':eccentricity, 'raan_deg':raan_deg,
                      'argument_of_periapsis_deg':argument_of_periapsis_deg,
                      'phase_deg_at_epoch':phase_deg_at_epoch},
        'model':{'horizon_days':horizon_days,'step_seconds':STEP_SECONDS,
                 'earth_equatorial_radius_km':EQUATORIAL_RADIUS_KM, 'j2':J2,
                 'comparison':'identical RK4 integrators, central gravity versus central + J2'},
        'window_start_utc':reference_track[0]['time'],
        'window_end_utc':reference_track[-1]['time'],
        'reference_track':reference_track, 'j2_track':j2_track,
        'diagnostics':diagnostics,
        'summary':{'secular_raan_rate_deg_day':round(predicted_rate,6),
                   'final_raan_drift_deg':diagnostics[-1]['raan_drift_deg'],
                   'final_separation_km':diagnostics[-1]['separation_km'],
                   'max_sampled_separation_km':round(max_separation,5)},
        'assumptions':[
            'Both integrations use 60-second fixed-step RK4 and the same initial ECI Cartesian state.',
            'J2=0.00108262668, WGS84 equatorial radius 6378.137 km, μ=398600.4418 km³/s².',
            'The secular RAAN rate is first-order averaged J2 theory; numerical drift uses osculating nodes.',
            'RAAN is undefined for equatorial orbits; osculating node angles exhibit short-period variation.',
            '3D playback shows only the final three hours, not the entire multiday history.',
            'Spherical initial altitude reference 6371 km; display uses approximate Earth rotation.',
            'No drag, higher zonal harmonics, luni-solar effects, or operational orbit accuracy.',
        ],
    }
