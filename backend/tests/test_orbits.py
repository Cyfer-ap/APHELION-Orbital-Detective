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


def test_ground_station_mask_changes_coverage_and_contact_geometry():
    from app.orbits import footprint_angle_deg
    assert 0 < footprint_angle_deg(400, 30) < footprint_angle_deg(400, 10) < footprint_angle_deg(400, 0) < 25
    assert abs(footprint_angle_deg(0, 0)) < 1e-10
    assert footprint_angle_deg(500, 10) > footprint_angle_deg(400, 10)


def test_integrated_mission_obeys_selected_mask():
    sat = EarthSatellite(
        "1 25544U 98067A   20342.59316199  .00001264  00000-0  29669-4 0  9993",
        "2 25544  51.6444 218.7398 0001391  84.8335  30.9623 15.49347317257996",
        "ISS (ZARYA)", timescale()
    )
    at = datetime(2020, 12, 8, 0, 0, tzinfo=timezone.utc)
    at10 = build_mission(sat, {"telemetry": False}, at, 28.6139, 77.2090, mask=10.0)
    at25 = build_mission(sat, {"telemetry": False}, at, 28.6139, 77.2090, mask=25.0)
    assert at25["station"]["minimum_elevation_deg"] == 25
    assert at25["coverage"]["central_angle_deg"] < at10["coverage"]["central_angle_deg"]
    assert at25["state"]["contact_margin_deg"] < at10["state"]["contact_margin_deg"]
    assert at25["state"]["lat"] == at10["state"]["lat"]
    # A stricter mask can make a pass at the start boundary newly complete,
    # so pass *counts* aren't monotone within a fixed 24-hour search interval.
    assert all(p["max_elevation_deg"] >= 25 for p in at25["passes"])
    assert all(p["max_elevation_deg"] >= 10 for p in at10["passes"])


def test_invalid_station_mask_is_rejected():
    from app.orbits import footprint_angle_deg
    import pytest
    with pytest.raises(ValueError):
        footprint_angle_deg(-10, 10)
    with pytest.raises(ValueError):
        footprint_angle_deg(400, -1)
