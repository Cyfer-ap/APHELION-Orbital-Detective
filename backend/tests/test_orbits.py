from datetime import datetime, timezone
from skyfield.api import EarthSatellite
from app.orbits import build_mission, timescale


def test_physical_ranges_using_historical_element_set():
    # Historical two-line element set used only for the offline mathematical test.
    sat = EarthSatellite(
        "1 25544U 98067A   20342.59316199  .00001264  00000-0  29669-4 0  9993",
        "2 25544  51.6444 218.7398 0001391  84.8335  30.9623 15.49347317257996",
        "ISS (ZARYA)", timescale()
    )
    at = datetime(2020, 12, 8, 0, 0, tzinfo=timezone.utc)
    result = build_mission(sat, {"telemetry": False}, at, 28.6139, 77.209)
    state = result["state"]
    assert -90 <= state["lat"] <= 90
    assert -180 <= state["lon"] <= 180
    assert 300 < state["alt_km"] < 600
    assert 7 < state["speed_km_s"] < 9
    assert len(result["track"]) == 148
    assert result["satellite"]["period_minutes"] > 90
