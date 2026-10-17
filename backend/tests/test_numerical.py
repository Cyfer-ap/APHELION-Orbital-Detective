from datetime import datetime, timezone
import math
import pytest
from app.numerical import compare_propagators,initial_state,energy,momentum
from app.explorer import EARTH_RADIUS_KM as R, MU_KM3_S2 as MU
EPOCH=datetime(2026,10,18,tzinfo=timezone.utc)

def solve(method='rk4',step=120,**kwargs):
    return compare_propagators(EPOCH,method=method,step_seconds=step,**kwargs)

def test_initial_states_and_sampling():
    r=solve()
    assert len(r['reference_track'])==len(r['numerical_track'])==len(r['diagnostics'])
    assert 13 <= len(r['diagnostics']) <= 181
    assert r['diagnostics'][0]['position_error_km']<1e-8
    assert r['reference_track'][0]==r['numerical_track'][0]
    assert r['model']['integration_substeps']>=len(r['diagnostics'])-1
    assert r['reference_track'][-1]['time']==r['numerical_track'][-1]['time']

def test_accuracy_order_and_convergence():
    errors={m:solve(method=m,eccentricity=0)['summary']['final_error_km'] for m in ('euler','verlet','rk4')}
    assert errors['euler']>errors['verlet']>errors['rk4']
    assert errors['euler']>100 and errors['rk4']<2
    assert solve(step=60)['summary']['final_error_km']<solve(step=240)['summary']['final_error_km']/10

def test_invariants_and_general_elements():
    e=.3;a=(R+450)/(1-e)
    state=initial_state(a,e,math.radians(60),math.radians(35),math.radians(42),0)
    assert math.sqrt(sum(x*x for x in state[:3]))==pytest.approx(R+450)
    assert energy(state)==pytest.approx(-MU/(2*a))
    assert momentum(state)==pytest.approx(math.sqrt(MU*a*(1-e*e)))
    result=solve(method='verlet',step=30,inclination_deg=125,raan_deg=240,argument_of_periapsis_deg=175,phase_deg_at_epoch=220)
    assert all(math.isfinite(d['position_error_km']) for d in result['diagnostics'])

@pytest.mark.parametrize('kw',[{'step_seconds':0},{'step_seconds':400},{'method':'bad'},
                                {'duration_orbits':4},{'eccentricity':.5},{'epoch':datetime(2026,10,18)}])
def test_invalid_values(kw):
    args={'epoch':EPOCH};args.update(kw)
    with pytest.raises(ValueError):compare_propagators(**args)

def test_endpoint_validation():
    pytest.importorskip('skyfield')
    from fastapi.testclient import TestClient
    from app.main import app
    client=TestClient(app)
    params={'epoch':'2026-10-18T00:00:00Z','step_seconds':60}
    r=client.get('/api/orbit/compare',params=params)
    assert r.status_code==200,r.text
    assert r.json()['kind']=='two_body_numerical_comparison'
    for patch in ({'step_seconds':-1},{'method':'other'},{'epoch':'2026-10-18T00:00:00'}):
        assert client.get('/api/orbit/compare',params={**params,**patch}).status_code==422


def test_coarse_step_is_not_silently_limited_by_render_sampling():
    r240=solve(method='rk4',step=240,duration_orbits=3)
    r360=solve(method='rk4',step=360,duration_orbits=3)
    assert r240['model']['integration_substeps']>r360['model']['integration_substeps']
    assert r240['summary']['final_error_km']!=r360['summary']['final_error_km']
