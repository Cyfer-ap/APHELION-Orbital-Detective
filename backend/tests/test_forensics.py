"""Targeted scientific tests; no external TLE network required."""
from datetime import datetime, timezone
import math
import pytest
from app.forensics import ric_components, rk4_continue, build_forensics
from app.numerical import initial_state
from app.explorer import EARTH_RADIUS_KM as R, MU_KM3_S2 as MU


def test_ric_basis_signed_components():
    reference=(7000.,0.,0.,0.,7.5,0.)
    candidate=(7012.,-4.,9.)
    radial, along, cross=ric_components(reference,candidate)
    assert (radial,along,cross)==pytest.approx((12,-4,9))
    assert math.sqrt(radial**2+along**2+cross**2)==pytest.approx(math.sqrt(12**2+4**2+9**2))


def test_two_body_rk4_preserves_circular_energy_and_returns_to_start():
    r=R+500; v=math.sqrt(MU/r); initial=(r,0.,0.,0.,v,0.)
    period=2*math.pi*math.sqrt(r**3/MU)
    final=rk4_continue(initial,period)
    assert math.dist(final[:3],initial[:3])<0.02
    assert final[3:]==pytest.approx(initial[3:],abs=5e-5)
    assert rk4_continue(initial,0)==initial


def test_rk4_vs_closed_form_elliptic_period():
    from app.explorer import eccentric_anomaly, anomaly_to_mean
    a=(R+500)/.79;e=.21
    initial=initial_state(a,e,.4,.2,.5,.8)
    period=2*math.pi*math.sqrt(a**3/MU)
    final=rk4_continue(initial,period)
    assert math.dist(final[:3],initial[:3])<0.3


def test_invalid_horizon_without_skyfield():
    for bad in (1,4,25,3.1,True):
        with pytest.raises(ValueError,match='Horizon'):build_forensics(None,{},bad)
