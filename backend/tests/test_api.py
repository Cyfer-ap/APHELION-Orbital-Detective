"""Offline API contract tests; never fetch from CelesTrak during tests."""
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from skyfield.api import EarthSatellite
from app.orbits import timescale
import app.main as main


ISS_2020 = EarthSatellite(
    "1 25544U 98067A   20342.59316199  .00001264  00000-0  29669-4 0  9993",
    "2 25544  51.6444 218.7398 0001391  84.8335  30.9623 15.49347317257996",
    "ISS (ZARYA)", timescale()
)


def test_station_mask_round_trip(monkeypatch):
    monkeypatch.setattr(main, "safe_satellite", lambda: (ISS_2020, {"source": "offline test TLE"}))
    client = TestClient(main.app)
    res = client.get("/api/mission", params={
        "at": datetime(2020, 12, 8, tzinfo=timezone.utc).isoformat(),
        "station_lat": -33.8688,
        "station_lon": 151.2093,
        "min_elevation_deg": 22,
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["station"] == {
        "name": "Selected ground station",
        "lat": -33.8688,
        "lon": 151.2093,
        "minimum_elevation_deg": 22.0,
    }
    assert len(data["track"]) == 148
    assert len(data["passes"]) <= 8
    assert data["coverage"]["central_angle_deg"] > 0
    assert data["state"]["footprint_deg"] == data["coverage"]["central_angle_deg"]
    assert abs(data["state"]["contact_margin_deg"] - (data["state"]["elevation_deg"] - 22)) < .002


def test_invalid_mask_and_coords_fail_with_422():
    client = TestClient(main.app)
    for params in ({"min_elevation_deg": -1}, {"min_elevation_deg": 31},
                   {"station_lat": 91}, {"station_lon": -181}):
        response = client.get('/api/mission', params=params)
        assert response.status_code == 422
