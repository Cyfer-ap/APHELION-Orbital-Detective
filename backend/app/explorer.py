"""Educational, **Keplerian elliptical** two-body mission designer.

The satellite orbit is idealized (not an ISS orbit, telemetry, maneuver analysis or
flight-dynamics product). A reference spherical Earth and approximate UTC-based GMST
are used for the virtual spacecraft's 3D illustration. Inertial orbital elements
are constant; the displayed Earth-fixed track accounts for Earth's rotation.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math

MU_KM3_S2 = 398600.4418
EARTH_RADIUS_KM = 6371.0
UTC = timezone.utc


def gmst_radians(moment: datetime) -> float:
    """Approximate Greenwich mean sidereal angle: UT1≈UTC; no polar motion."""
    if moment.tzinfo is None:
        raise ValueError('A timezone-aware time is required')
    days = moment.timestamp() / 86400.0 + 2440587.5 - 2451545.0
    t = days / 36525.0
    degrees = (280.46061837 + 360.98564736629 * days
               + 0.000387933 * t * t - t * t * t / 38710000.0)
    return math.radians(degrees % 360.0)


def eccentric_anomaly(mean_anomaly_rad: float, eccentricity: float) -> float:
    """Solve Kepler's equation M=E-e sin(E) by Newton's method for 0≤e≤0.35."""
    m = (mean_anomaly_rad + math.pi) % (2 * math.pi) - math.pi
    e_anomaly = m if eccentricity < 0.2 else math.pi if m >= 0 else -math.pi
    for _ in range(20):
        residue = e_anomaly - eccentricity * math.sin(e_anomaly) - m
        step = residue / (1.0 - eccentricity * math.cos(e_anomaly))
        e_anomaly -= step
        if abs(step) < 1e-13:
            return e_anomaly
    raise ArithmeticError('Kepler equation did not converge')


def anomaly_to_mean(true_anomaly_rad: float, eccentricity: float) -> float:
    e_anomaly = math.atan2(
        math.sqrt(1-eccentricity*eccentricity)*math.sin(true_anomaly_rad),
        eccentricity + math.cos(true_anomaly_rad),
    )
    return e_anomaly - eccentricity * math.sin(e_anomaly)


def _state_from_true_anomaly(
    moment: datetime, true_anomaly_rad: float, semi_major_axis_km: float,
    eccentricity: float, inclination_deg: float, raan_deg: float,
    argument_of_periapsis_deg: float, *, frozen_gmst: float | None = None,
) -> dict:
    """Perifocal -> ECI via R3(Ω)R1(i)R3(ω) -> ECEF via R3(-GMST)."""
    p = semi_major_axis_km * (1 - eccentricity**2)
    r = p / (1 + eccentricity * math.cos(true_anomaly_rad))
    arg = math.radians(argument_of_periapsis_deg) + true_anomaly_rad
    node = math.radians(raan_deg)
    inc = math.radians(inclination_deg)
    x = r * (math.cos(node)*math.cos(arg) - math.sin(node)*math.sin(arg)*math.cos(inc))
    y = r * (math.sin(node)*math.cos(arg) + math.cos(node)*math.sin(arg)*math.cos(inc))
    z = r * math.sin(arg)*math.sin(inc)
    theta = gmst_radians(moment) if frozen_gmst is None else frozen_gmst
    xe = x * math.cos(theta) + y * math.sin(theta)
    ye = -x * math.sin(theta) + y * math.cos(theta)
    speed = math.sqrt(MU_KM3_S2 * (2.0 / r - 1.0 / semi_major_axis_km))
    return {
        'time': moment.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'lat': round(math.degrees(math.atan2(z, math.hypot(xe, ye))), 6),
        'lon': round((math.degrees(math.atan2(ye, xe)) + 540.0) % 360.0 - 180.0, 6),
        'alt_km': round(r - EARTH_RADIUS_KM, 4),
        'radius_km': round(r, 4),
        'speed_km_s': round(speed, 6),
        'true_anomaly_deg': round(math.degrees(true_anomaly_rad) % 360.0, 6),
    }


def build_preview(
    at: datetime, epoch: datetime, altitude_km: float, inclination_deg: float,
    eccentricity: float = 0.0, raan_deg: float = 0.0,
    argument_of_periapsis_deg: float = 0.0, phase_deg_at_epoch: float = 0.0,
) -> dict:
    """Generate a two-period trajectory plus a frozen ECEF osculating ellipse.

    `altitude_km` is the **perigee altitude** in v0.4, equal to circular
    altitude when e=0. The epoch phase is a *true anomaly*, not mean anomaly.
    """
    if at.tzinfo is None or epoch.tzinfo is None:
        raise ValueError('Both at and epoch must include a timezone offset')
    params = (altitude_km, inclination_deg, eccentricity, raan_deg,
              argument_of_periapsis_deg, phase_deg_at_epoch)
    if not all(math.isfinite(v) for v in params):
        raise ValueError('All orbital elements must be finite')
    if not (200 <= altitude_km <= 2000 and 0 <= inclination_deg <= 180
            and 0 <= eccentricity <= 0.35 and 0 <= raan_deg <= 360
            and 0 <= argument_of_periapsis_deg <= 360
            and 0 <= phase_deg_at_epoch <= 360):
        raise ValueError('Bounds: perigee 200–2000 km, inclination 0–180°, '
                         'eccentricity 0–0.35, and angles 0–360°')
    if abs((at - epoch).total_seconds()) > 30 * 86400:
        raise ValueError('Preview is limited to 30 days from the simulation epoch')

    at, epoch = at.astimezone(UTC), epoch.astimezone(UTC)
    perigee_radius = EARTH_RADIUS_KM + altitude_km
    a = perigee_radius / (1 - eccentricity)
    apogee_radius = a * (1 + eccentricity)
    mean_motion = math.sqrt(MU_KM3_S2 / a ** 3)
    period_s = 2 * math.pi / mean_motion
    m_at_epoch = anomaly_to_mean(math.radians(phase_deg_at_epoch), eccentricity)

    def state(moment: datetime) -> dict:
        mean_anomaly = m_at_epoch + (moment - epoch).total_seconds() * mean_motion
        e_anomaly = eccentric_anomaly(mean_anomaly, eccentricity)
        true_anomaly = math.atan2(
            math.sqrt(1 - eccentricity**2) * math.sin(e_anomaly),
            math.cos(e_anomaly) - eccentricity,
        )
        return _state_from_true_anomaly(
            moment, true_anomaly, a, eccentricity, inclination_deg,
            raan_deg, argument_of_periapsis_deg,
        )

    # Sample around the selected time to support fluid scrubbing and playback.
    half_span_s = max(period_s, 7200.0)
    track = [state(at + timedelta(seconds=half_span_s * (i - 120) / 120))
             for i in range(241)]
    frozen_theta = gmst_radians(at)

    def frozen_anomaly(true_anomaly: float) -> dict:
        return _state_from_true_anomaly(
            at, true_anomaly, a, eccentricity, inclination_deg,
            raan_deg, argument_of_periapsis_deg, frozen_gmst=frozen_theta,
        )

    # Uniform true-anomaly sampling gives an accurate geometric ellipse (not
    # uniform-speed playback; the time samples above use Kepler's equation).
    plane_track = [frozen_anomaly(2 * math.pi * i / 192) for i in range(193)]
    current = state(at)
    derived = {
        'orbital_radius_km': current['radius_km'],
        'semimajor_axis_km': round(a, 4),
        'period_minutes': round(period_s / 60, 4),
        'speed_km_s': current['speed_km_s'],
        'angular_rate_rad_s': mean_motion,
        'perigee_altitude_km': round(altitude_km, 4),
        'apogee_altitude_km': round(apogee_radius - EARTH_RADIUS_KM, 4),
        'perigee_speed_km_s': round(math.sqrt(MU_KM3_S2 * (2/perigee_radius - 1/a)), 6),
        'apogee_speed_km_s': round(math.sqrt(MU_KM3_S2 * (2/apogee_radius - 1/a)), 6),
        'specific_energy_km2_s2': round(-MU_KM3_S2 / (2*a), 6),
    }
    return {
        'kind': 'hypothetical_elliptical_two_body',
        'name': 'APHELION-X / MISSION DESIGNER',
        'parameters': {
            'altitude_km': altitude_km, 'inclination_deg': inclination_deg,
            'eccentricity': eccentricity, 'raan_deg': raan_deg,
            'argument_of_periapsis_deg': argument_of_periapsis_deg,
            'phase_deg_at_epoch': phase_deg_at_epoch,
        },
        'derived': derived,
        'epoch_utc': epoch.isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'state': current,
        'track': track,
        'plane_track': plane_track,
        'apsides': {'perigee': frozen_anomaly(0), 'apogee': frozen_anomaly(math.pi)},
        'assumptions': [
            'Ideal unperturbed elliptic two-body orbit with fixed classical orbital elements',
            'Input altitude is altitude at PERIGEE; orbital phase is TRUE anomaly at epoch',
            'Spherical Earth, radius 6371 km, μ = 398600.4418 km³/s²',
            'ECI to ECEF uses approximate UTC-based GMST; no precession, nutation or polar motion',
            'Ellipse/apsides frozen in Earth-fixed orientation at sample time; trail includes Earth rotation',
            'No J2, drag or orbital maneuvers; NOT SGP4, operational tracking or live telemetry',
        ],
    }
