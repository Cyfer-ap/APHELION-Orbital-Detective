from datetime import datetime, timezone
import math
import pytest
from app.perturbations import J2, j2_acceleration, j2_step, raan_degrees, compare_j2
from app.numerical import initial_state, step, norm
from app.explorer import MU_KM3_S2 as MU, EARTH_RADIUS_KM as R

EPOCH=datetime(2026,10,18,tzinfo=timezone.utc)

def test_j2_acceleration_direction_equatorial_and_polar():
    s=(7000.,0.,0.,0.,7.5,0.)
    dx,dy,dz=j2_acceleration(s)
    assert dx < 0 and dy==0 and dz==0
    assert j2_acceleration((0.,0.,7000.,0.,0.,7.5))[2] > 0
    assert j2_acceleration(s,0)==pytest.approx((0,0,0))

def test_zero_coefficient_matches_existing_rk4():
    initial=initial_state(7100,.2,math.radians(55),.2,.3,1.)
    actual=j2_step(initial,60.,0.)
    expected=step(initial,60.,'rk4')
    assert actual == pytest.approx(expected,rel=1e-14,abs=1e-12)

def test_secular_node_regression_and_track_time():
    pro=compare_j2(EPOCH,inclination_deg=51.6,horizon_days=1)
    retro=compare_j2(EPOCH,inclination_deg=120,horizon_days=1)
    polar=compare_j2(EPOCH,inclination_deg=90,horizon_days=1)
    assert pro['summary']['secular_raan_rate_deg_day'] < 0
    assert retro['summary']['secular_raan_rate_deg_day'] > 0
    assert abs(polar['summary']['secular_raan_rate_deg_day'])<1e-10
    assert pro['summary']['final_raan_drift_deg'] < 0
    assert retro['summary']['final_raan_drift_deg'] > 0
    assert pro['diagnostics'][0]['separation_km']==0
    assert len(pro['reference_track'])==len(pro['j2_track'])==181
    assert pro['reference_track'][-1]['time']==pro['window_end_utc']
    assert pro['summary']['max_sampled_separation_km']>0

def test_equatorial_raan_undefined():
    s=initial_state(R+600.,0,0,0,0,0)
    assert raan_degrees(s) is None
    result=compare_j2(EPOCH,inclination_deg=0,horizon_days=1)
    assert result['summary']['final_raan_drift_deg'] is None

@pytest.mark.parametrize('params', [{'horizon_days':2},{'inclination_deg':190},{'eccentricity':.4},
                                    {'altitude_km':100},{'epoch':datetime(2026,10,18)},
                                    {'raan_deg':float('nan')}])
def test_invalid_inputs(params):
    args={'epoch':EPOCH};args.update(params)
    with pytest.raises(ValueError): compare_j2(**args)
