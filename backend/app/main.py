"""A small real-data backend paired with a real UI from the first release."""
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .orbits import build_mission, safe_satellite

app = FastAPI(title="Orbital Detective API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "0.1.0", "mode": "predicted_orbit_not_live_telemetry"}


@app.get("/api/mission")
def mission(
    at: datetime | None = None,
    station_lat: float = Query(28.6139, ge=-90, le=90),
    station_lon: float = Query(77.2090, ge=-180, le=180),
):
    moment = (at or datetime.now(timezone.utc))
    if moment.tzinfo is None:
        raise HTTPException(422, "The 'at' query parameter must include a timezone, e.g. Z")
    try:
        sat, provenance = safe_satellite()
        return build_mission(sat, provenance, moment.astimezone(timezone.utc), station_lat, station_lon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Cannot calculate ISS orbit: {exc}") from exc
