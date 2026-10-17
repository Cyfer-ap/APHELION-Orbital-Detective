"""A small real-data backend paired with a real UI from the first release."""
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .orbits import build_mission, safe_satellite
from .explorer import build_preview

app = FastAPI(title="Orbital Detective API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.4.0", "mode": "predicted_orbit_not_live_telemetry"}


@app.get("/api/mission")
def mission(
    at: datetime | None = None,
    station_lat: float = Query(28.6139, ge=-90, le=90),
    station_lon: float = Query(77.2090, ge=-180, le=180),
    min_elevation_deg: float = Query(10.0, ge=0, le=30),
):
    moment = (at or datetime.now(timezone.utc))
    if moment.tzinfo is None:
        raise HTTPException(422, "The 'at' query parameter must include a timezone, e.g. Z")
    try:
        sat, provenance = safe_satellite()
        return build_mission(sat, provenance, moment.astimezone(timezone.utc), station_lat, station_lon, min_elevation_deg)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Cannot calculate ISS orbit: {exc}") from exc


@app.get("/api/orbit/preview")
def preview_orbit(
    at: datetime | None = None,
    epoch: datetime | None = None,
    altitude_km: float = Query(550, ge=200, le=2000),
    inclination_deg: float = Query(51.6, ge=0, le=180),
    eccentricity: float = Query(0.0, ge=0, le=0.35),
    raan_deg: float = Query(0.0, ge=0, le=360),
    argument_of_periapsis_deg: float = Query(0.0, ge=0, le=360),
    phase_deg_at_epoch: float = Query(0.0, ge=0, le=360),
):
    """Preview an ideal *elliptical two-body* orbit alongside the real ISS.

    Independent of ISS element data: works while CelesTrak is unavailable.
    """
    moment = at or datetime.now(timezone.utc)
    reference_epoch = epoch or moment
    try:
        return build_preview(moment, reference_epoch, altitude_km, inclination_deg,
                             eccentricity, raan_deg, argument_of_periapsis_deg,
                             phase_deg_at_epoch)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
