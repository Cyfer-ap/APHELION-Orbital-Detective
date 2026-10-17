"""Numerical and API checks for independently reproducible Orbit Explorer."""
from datetime import datetime, timedelta, timezone
import math

import pytest
from fastapi.testclient import TestClient
from app.explorer import EARTH_RADIUS_KM, MU_KM3_S2, build_preview, gmst_radians
from app.main import app

EPOCH = datetime(2026, 10, 18, tzinfo=timezone.utc)
client = TestClient(app)


def test_circular_orbit_kepler_law_and_radius():
    result = build_preview(EPOCH, EPOCH, 550, 51.6)
    a = 550 + EARTH_RADIUS_KM
    assert result['derived']['period_minutes'] == pytest.approx(
        2 * math.pi * math.sqrt(a**3 / MU_KM3_S2) / 60, abs=0.00006)
    assert result['derived']['speed_km_s'] == pytest.approx(math.sqrt(MU_KM3_S2 / a), abs=0.00001)
    assert len(result['track']) == 241
    assert len(result['plane_track']) == 193
    assert all(math.isfinite(sample['lat']) and math.isfinite(sample['lon']) for sample in result['track'])
    assert all(sample['alt_km'] == 550 for sample in result['track'])


def test_higher_altitude_longer_period_but_lower_orbital_speed():
    low = build_preview(EPOCH, EPOCH, 250, 51.6)
    high = build_preview(EPOCH, EPOCH, 1500, 51.6)
    assert high['derived']['period_minutes'] > low['derived']['period_minutes']
    assert high['derived']['speed_km_s'] < low['derived']['speed_km_s']


def test_inclination_limits_latitude_reach():
    equatorial = build_preview(EPOCH, EPOCH, 500, 0)
    inclined = build_preview(EPOCH, EPOCH, 500, 60)
    assert max(abs(p['lat']) for p in equatorial['track']) < 1e-5
    assert max(abs(p['lat']) for p in inclined['track']) == pytest.approx(60, abs=0.1)


def test_gmst_rotates_with_earth_and_track_is_not_frozen_plane():
    change = (gmst_radians(EPOCH + timedelta(hours=6)) - gmst_radians(EPOCH)) % (2*math.pi)
    assert math.degrees(change) == pytest.approx(90.25, abs=0.1)
    example = build_preview(EPOCH, EPOCH, 550, 30)
    assert example['track'][120] == example['state']
    assert example['plane_track'][0]['lat'] == pytest.approx(example['state']['lat'], abs=1e-5)


def test_validation_and_timezone():
    with pytest.raises(ValueError):
        build_preview(EPOCH, EPOCH, float('nan'), 30)
    with pytest.raises(ValueError):
        build_preview(EPOCH, EPOCH, 100, 30)
    with pytest.raises(ValueError):
        build_preview(EPOCH, EPOCH, 550, 185)
    with pytest.raises(ValueError):
        build_preview(EPOCH.replace(tzinfo=None), EPOCH, 550, 45)
    with pytest.raises(ValueError):
        build_preview(EPOCH + timedelta(days=31), EPOCH, 550, 45)


def test_api_preview_and_validation_without_iss():
    response = client.get('/api/orbit/preview', params={
        'at': EPOCH.isoformat(), 'epoch': EPOCH.isoformat(),
        'altitude_km': 680, 'inclination_deg': 98,
    })
    assert response.status_code == 200
    data = response.json()
    assert data['kind'] == 'hypothetical_elliptical_two_body'
    assert data['parameters']['altitude_km'] == 680
    assert data['parameters']['inclination_deg'] == 98
    assert data['state']['alt_km'] == 680
    assert client.get('/api/orbit/preview', params={'inclination_deg': 181}).status_code == 422
    assert client.get('/api/orbit/preview', params={'at': '2026-10-18T00:00:00'}).status_code == 422


def test_api_elliptical_design_and_invalid_elements():
    response = client.get('/api/orbit/preview', params={
        'at': EPOCH.isoformat(), 'epoch': EPOCH.isoformat(),
        'altitude_km': 450, 'inclination_deg': 52,
        'eccentricity': .24, 'raan_deg': 35,
        'argument_of_periapsis_deg': 60, 'phase_deg_at_epoch': 0,
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['parameters']['eccentricity'] == .24
    assert data['parameters']['raan_deg'] == 35
    assert data['derived']['apogee_altitude_km'] > 450
    assert data['apsides']['perigee']['alt_km'] == pytest.approx(450)
    assert data['state']['speed_km_s'] == pytest.approx(data['derived']['perigee_speed_km_s'])
    assert client.get('/api/orbit/preview', params={'eccentricity': .36}).status_code == 422
    assert client.get('/api/orbit/preview', params={'raan_deg': 361}).status_code == 422
    assert client.get('/api/orbit/preview', params={'phase_deg_at_epoch': -1}).status_code == 422
