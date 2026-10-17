"""Educational circular two-body orbit laboratory (independent of ISS/SGP4).

The model deliberately uses a spherical 6,371 km Earth and a simplified
UTC-based Greenwich mean sidereal angle. It must not be interpreted as a
high-fidelity propagator or an orbital solution for an operational spacecraft.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math

MU_KM3_S2 = 398600.4418
EARTH_RADIUS_KM = 6371.0
UTC = timezone.utc


def gmst_radians(moment: datetime) -> float:
    """Approximate GMST. UT1≈UTC; ignores polar motion/nutation."""
    if moment.tzinfo is None:
        raise ValueError('A timezone-aware UTC time is required')
    days = moment.timestamp() / 86400.0 + 2440587.5 - 2451545.0
    t = days / 36525.0
    degrees = (280.46061837 + 360.98564736629 * days
               + 0.000387933 * t * t - t * t * t / 38710000.0)
    return math.radians(degrees % 360.0)


def state_at(moment: datetime, epoch: datetime, radius_km: float,
             inclination_deg: float, angular_rate_rad_s: float,
             fixed_gmst: float | None = None) -> dict:
    """Circular ECI orbit rotated about X by inclination; project into ECEF."""
    anomaly = ((moment - epoch).total_seconds() * angular_rate_rad_s) % (2 * math.pi)
    tilt = math.radians(inclination_deg)
    x = radius_km * math.cos(anomaly)
    y = radius_km * math.sin(anomaly) * math.cos(tilt)
    z = radius_km * math.sin(anomaly) * math.sin(tilt)
    theta = gmst_radians(moment) if fixed_gmst is None else fixed_gmst
    # ECI -> Earth-fixed rotation about +z by -theta.
    xe = x * math.cos(theta) + y * math.sin(theta)
    ye = -x * math.sin(theta) + y * math.cos(theta)
    return {
        'time': moment.astimezone(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'lat': round(math.degrees(math.atan2(z, math.hypot(xe, ye))), 6),
        'lon': round((math.degrees(math.atan2(ye, xe)) + 540.0) % 360.0 - 180.0, 6),
        'alt_km': round(radius_km - EARTH_RADIUS_KM, 4),
        'speed_km_s': round(math.sqrt(MU_KM3_S2 / radius_km), 6),
    }


def build_preview(at: datetime, epoch: datetime, altitude_km: float, inclination_deg: float) -> dict:
    """Backend-authoritative state, two-period Earth-fixed track and frozen plane."""
    if at.tzinfo is None or epoch.tzinfo is None:
        raise ValueError('Both at and epoch must include a timezone offset')
    if not (math.isfinite(altitude_km) and math.isfinite(inclination_deg)):
        raise ValueError('Inputs must be finite')
    if not 200 <= altitude_km <= 2000 or not 0 <= inclination_deg <= 180:
        raise ValueError('Supported altitude: 200–2000 km; inclination: 0–180 degrees')
    if abs((at - epoch).total_seconds()) > 30 * 86400:
        raise ValueError('Preview is limited to 30 days from the simulation epoch')
    radius = EARTH_RADIUS_KM + altitude_km
    angular_rate = math.sqrt(MU_KM3_S2 / radius ** 3)
    period_s = 2.0 * math.pi / angular_rate
    span_s = max(period_s, 7200.0)
    at, epoch = at.astimezone(UTC), epoch.astimezone(UTC)
    track = [state_at(at + timedelta(seconds=span_s * (i - 120) / 120),
                      epoch, radius, inclination_deg, angular_rate) for i in range(241)]
    # Reference *orbital plane* in the Earth-fixed frame at the requested instant;
    # unlike the actual ground track, Earth is held fixed for this ring.
    fixed_theta = gmst_radians(at)
    plane_track = [state_at(epoch + timedelta(seconds=period_s * i / 128),
                            epoch, radius, inclination_deg, angular_rate, fixed_theta)
                   for i in range(129)]
    return {
        'kind': 'hypothetical_circular_two_body',
        'name': 'APHELION-X / VIRTUAL',
        'parameters': {'altitude_km': altitude_km, 'inclination_deg': inclination_deg,
                       'eccentricity': 0, 'raan_deg': 0, 'phase_deg_at_epoch': 0},
        'derived': {'orbital_radius_km': round(radius, 3),
                    'semimajor_axis_km': round(radius, 3),
                    'period_minutes': round(period_s / 60, 4),
                    'speed_km_s': round(math.sqrt(MU_KM3_S2 / radius), 5),
                    'angular_rate_rad_s': angular_rate},
        'epoch_utc': epoch.isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'state': state_at(at, epoch, radius, inclination_deg, angular_rate),
        'track': track,
        'plane_track': plane_track,
        'assumptions': [
            'Circular two-body orbit (eccentricity = 0), RAAN = 0° in reference ECI',
            'Spherical Earth, radius 6371 km, μ = 398600.4418 km³/s²',
            'Approximate UTC-based GMST; UT1≈UTC, no precession/nutation/polar motion',
            'Plane ring frozen in Earth-fixed orientation at the requested time; moving trail accounts for Earth rotation',
            'Educational model; not ISS telemetry, SGP4, a maneuver prediction or a flight-dynamics product',
        ],
    }
