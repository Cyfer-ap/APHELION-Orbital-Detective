"""Keplerian geometry, phase, energy and HTTP-contract regression checks."""
from datetime import datetime, timedelta, timezone
import math

import pytest
from app.explorer import (EARTH_RADIUS_KM, MU_KM3_S2, anomaly_to_mean,
                          build_preview, eccentric_anomaly)

EPOCH = datetime(2026, 10, 18, tzinfo=timezone.utc)


def preview(e=.25, phase=0, at=EPOCH, **kwargs):
    return build_preview(at, EPOCH, 500, 55, e, 42,
                         kwargs.get('argument_of_periapsis_deg', 60), phase)


def test_kepler_equation_residual_across_phases():
    for e in (0, .01, .25, .35):
        for phase in range(-720, 721, 11):
            m = math.radians(phase)
            E = eccentric_anomaly(m, e)
            wrapped_m = (m + math.pi) % (2*math.pi) - math.pi
            assert E - e*math.sin(E) == pytest.approx(wrapped_m, abs=2e-13)


def test_apsides_vis_viva_and_kinetic_energy():
    p = preview(e=.3)
    d = p['derived']
    rp = EARTH_RADIUS_KM + 500
    ra = d['semimajor_axis_km'] * 2 - rp
    assert d['perigee_altitude_km'] == pytest.approx(500)
    assert d['apogee_altitude_km'] == pytest.approx(ra - EARTH_RADIUS_KM, abs=.0001)
    assert d['perigee_speed_km_s'] > d['apogee_speed_km_s']
    assert d['period_minutes'] == pytest.approx(
        2*math.pi*math.sqrt(d['semimajor_axis_km']**3/MU_KM3_S2)/60, abs=.0001)
    assert p['state']['alt_km'] == pytest.approx(500, abs=.0001)
    assert p['apsides']['perigee']['alt_km'] == pytest.approx(500, abs=.0001)
    assert p['apsides']['apogee']['alt_km'] == pytest.approx(d['apogee_altitude_km'], abs=.0001)
    for row in p['track']:
        r = row['radius_km']
        v = row['speed_km_s']
        specific = v*v/2 - MU_KM3_S2/r
        assert specific == pytest.approx(-MU_KM3_S2/(2*d['semimajor_axis_km']), abs=0.001)
        assert row['alt_km'] >= 500 - .001
        assert row['alt_km'] <= d['apogee_altitude_km'] + .001


def test_ellipse_time_periodicity_and_speed_change():
    p = preview()
    period_s = p['derived']['period_minutes']*60
    at = EPOCH + timedelta(seconds=period_s)
    shifted = preview(at=at)
    assert shifted['state']['alt_km'] == pytest.approx(p['state']['alt_km'], abs=.001)
    assert shifted['state']['speed_km_s'] == pytest.approx(p['state']['speed_km_s'], abs=.001)
    assert any(abs(s['alt_km'] - p['state']['alt_km']) > 100 for s in p['track'])
    assert p['state']['speed_km_s'] == pytest.approx(p['derived']['perigee_speed_km_s'], abs=.0001)
    assert shifted['state']['lon'] != p['state']['lon']  # Earth rotated during orbit


def test_angles_and_phase_affect_geometry_not_energy():
    base = preview(phase=0)
    phase90 = preview(phase=90)
    rotated_peri = preview(argument_of_periapsis_deg=150)
    assert phase90['state']['alt_km'] > base['state']['alt_km']
    assert rotated_peri['state']['lat'] != base['state']['lat']
    assert rotated_peri['derived']['period_minutes'] == base['derived']['period_minutes']
    assert rotated_peri['derived']['perigee_speed_km_s'] == base['derived']['perigee_speed_km_s']
    e = .25
    for nu in (0, .1, 1.2, 3.0, 5.8):
        E = eccentric_anomaly(anomaly_to_mean(nu, e), e)
        recovered = math.atan2(math.sqrt(1-e*e)*math.sin(E), math.cos(E)-e)
        assert math.sin(recovered) == pytest.approx(math.sin(nu), abs=1e-12)
        assert math.cos(recovered) == pytest.approx(math.cos(nu), abs=1e-12)


def test_circular_regression_and_invalid_elements():
    p = preview(e=0)
    assert p['derived']['perigee_altitude_km'] == p['derived']['apogee_altitude_km']
    assert p['derived']['perigee_speed_km_s'] == p['derived']['apogee_speed_km_s']
    assert all(row['alt_km'] == pytest.approx(500, abs=.0001) for row in p['track'])
    assert len(p['track']) == 241
    assert len(p['plane_track']) == 193
    for e in (-.1, .351, math.nan):
        with pytest.raises(ValueError):
            preview(e=e)
    with pytest.raises(ValueError):
        build_preview(EPOCH, EPOCH, 500, 55, .1, -10)
    with pytest.raises(ValueError):
        preview(at=EPOCH + timedelta(days=31))
