# APHELION — Orbital Detective

**An interactive orbital mechanics laboratory with an animated 3D mission-control interface and a real Python computation backend.**

> **Project rule:** Every new scientific/backend capability ships in the same vertical slice as its polished, interactive UI. We will not build the entire backend first and add a frontend later.

## What exists in v0.3

- **Orbit Explorer v0.3:** Adjust hypothetical circular-orbit altitude (200–2000 km) and inclination (0°–180°), select presets, and immediately compare live backend-computed Keplerian speed and period with the ISS. A violet orbit-plane ring, rotating-Earth ground trail, and moving virtual spacecraft appear alongside the real ISS.
- Interactive, stylized **3D Earth** with orbit/ground-track visualization and a predicted ISS position marker.
- Real **ISS orbital propagation** via Skyfield/SGP4 using CelesTrak orbital elements (not live telemetry).
- **Simulation controls** for pausing, scrubbing, stepping and accelerating time.
- Ground-station selector: **New Delhi, Tokyo, Oslo and San Francisco**.
- Backend-computed **azimuth, elevation, slant range, altitude, and orbital speed**.
- Upcoming **satellite passes** over a selected ground station with a configurable **0°–30° elevation mask**.
- **Ground Control v0.2**: Click **PLACE ON 3D EARTH**, choose any location, and watch ground station, pointing telemetry, contact margin, and 24-hour passes recalculate together.
- **Elevation-mask explorer** with a responsive slider, dynamic SVG threshold, animated contact indicator, and a glowing reference-footprint circle on the globe.
- Click a predicted pass to jump to its peak and pause the timeline.
- Telemetry, passes, and science/provenance views, with clear data-source and cache status.

The Earth texture, star field, atmosphere, visual glow, and animation styling are illustrative; calculated spacecraft states are model predictions. This application is for exploration and education, not satellite operations or collision avoidance.

Full scope, release roadmap, scientific assumptions, and the UI/backend development contract: **[guides/PROJECT_PLAN.md](guides/PROJECT_PLAN.md)**.

## Prerequisites

- **Git**
- **Node.js 20.19+** (Node 22 recommended) and npm
- **Python 3.11+** and pip
- A browser with **WebGL** enabled
- Internet access on first run to retrieve ISS data from CelesTrak. **The virtual Orbit Explorer operates without CelesTrak data.**

## Clone the repository

Clone the official repository:

```bash
git clone https://github.com/Cyfer-ap/APHELION-Orbital-Detective.git
cd APHELION-Orbital-Detective
```

After cloning, run **two terminals** from the repository root, one for the backend and one for the frontend.

## Terminal 1 — Python backend

**Windows PowerShell:**

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks virtual-environment activation, use `.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` instead.

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep the backend running. Check:

- Health: http://127.0.0.1:8000/api/health
- Interactive API reference: http://127.0.0.1:8000/docs

The first mission request retrieves ISS orbital elements and caches them under `backend/data/`. By default, the cache is refreshed every six hours. If the network fails but a cache exists, the API flags it as `stale_cache`. Without usable elements, the mission endpoint responds with an error rather than producing fabricated data.

## Terminal 2 — React frontend

Open a **new terminal at the cloned repository root**:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. Keep both terminal processes running. The Vite development server forwards `/api` requests to `http://127.0.0.1:8000`.

## Try it out

1. **Rotate and zoom** the Earth; inspect the ISS marker and track.
2. **Pause, scrub, and accelerate time**; watch the predicted location and telemetry follow the same computed data.
3. **Change ground stations**; check how elevation, azimuth, range, and contact windows change.
4. Click **PLACE ON 3D EARTH** in the floating Ground Control panel, then click any point on the planet to move the virtual station.
5. Drag the **MIN. ELEVATION** slider from 0° to 30° and watch the footprint, contact margin, elevation graph, and passes respond.
6. Open **Passes**, then click a pass card to jump to the predicted peak.
7. Open **Science** to inspect propagation, orbital-element epoch, cache provenance, and footprint assumptions.

## Tests and validation

Backend unit checks (from the repository root):

```bash
cd backend
python -m pytest -q
```

Frontend production/type check (from the repository root):

```bash
cd frontend
npm run build
```

**Current verification:** Initial source files have passed basic Python and TypeScript syntax-level checks. A full dependency-installed runtime and integration validation is still required on a local machine. If something fails, report the console output and we will fix it before expanding scope.

## Project structure

```text
.
├── README.md                    # Clone, run, test, and troubleshooting
├── guides/
│   └── PROJECT_PLAN.md         # The vision, architecture, theory, roadmap, rules
├── backend/
│   ├── app/main.py              # FastAPI endpoints
│   ├── app/orbits.py            # Real SGP4 propagation and visibility calculations
│   ├── app/explorer.py          # Independently computed circular two-body preview
│   ├── tests/                  # Mathematical and offline API contract checks
│   └── requirements.txt
├── frontend/
│   ├── src/App.tsx              # Mission-control app and interactions
│   ├── src/components/OrbitalGlobe.tsx
│   ├── src/components/GroundControl.tsx
│   ├── src/components/OrbitExplorer.tsx
│   ├── src/lib/orbit.ts         # Typed API models and display interpolation
│   └── package.json
└── generate_earth_texture.py   # Optional image asset regeneration script
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| UI shows a connection or loading error | Start backend on port `8000`; visit `/api/health` to verify. |
| Backend returns `503` | Internet/DNS access to CelesTrak may be unavailable and there may be no cached elements yet. |
| Backend returns `422` for historical/future time | Requested propagation time is outside the imposed ±14-day orbital-element epoch window. Reset to current time and refresh orbital elements. |
| Empty/black 3D canvas | Confirm WebGL/browser GPU acceleration is enabled; check browser console for errors. |
| `npm run dev` fails | Verify Node `node --version` is at least 20.19 and `npm install` completed. |
| Windows venv activation is blocked | Invoke `.venv\Scripts\python.exe` directly rather than changing system-wide execution policy. |

## Scope discipline

This is a personal scientific playground, **not a SaaS**. No authentication, payment features, accounts, or production infrastructure unless they become essential to a specific experiment. v0.3 adds the **virtual circular-orbit explorer and animated comparison** alongside v0.2 Ground Control. Next proposed slice: mission design, after local verification of this release.

## Scientific limitations

Orbital positions are **SGP4 predictions**, not live satellite telemetry. Observer geometry uses WGS84 and a simplified horizon elevation threshold, not terrain, weather, optical brightness, or actual radio link budgets. **The luminous footprint is calculated using a spherical Earth of radius 6,371 km**, centered on the sub-satellite point: its edge is explanatory rather than an exact WGS84 coverage boundary. The visualization interpolates between backend-computed time samples for smooth animation. The ±14-day TLE epoch guard is only a conservative UI limit, **not** a guarantee of prediction accuracy anywhere inside that window. Time and frame conventions must be checked whenever orbital models or UI controls change.

### Ground Control API (v0.2)

`GET /api/mission?station_lat=28.6139&station_lon=77.209&min_elevation_deg=10`

Optional `at=` must be timezone-aware ISO 8601. Input coordinates are validated and the minimum elevation must be in **[0°, 30°]**. Each sampled state supplies `contact_margin_deg` and `footprint_deg`. The response's `coverage` metadata identifies the spherical-reference model; only observer azimuth/elevation and pass predictions use the WGS84 Skyfield geometry. Rapid slider changes are debounced; superseded HTTP requests are aborted.

**Windows note:** If you already created a virtual environment in the repository root, you may continue using it: `python -m pip install -r .\backend\requirements.txt`, then `cd backend` and start Uvicorn as above.


## Orbit Explorer v0.3 — a complete backend + animated UI slice

In the right panel, choose **EXPLORER** (or click **OPEN ORBIT EXPLORER** over the globe). Drag the altitude and inclination sliders or select a preset. The browser requests an orbit computation from Python, then updates the violet orbital plane, dashed Earth-fixed ground trail, animated APHELION-X satellite, period and speed metrics, and comparison against the independently propagated ISS. The real ISS is **never** modified by changing the virtual orbit.

- **Violet solid circle:** The circular orbital-plane reference with Earth held fixed at the calculation instant.
- **Violet dashed line:** Earth-fixed sub-satellite ground track, accounting for Earth's rotation.
- **Amber spacecraft:** Real ISS / published CelesTrak elements / SGP4.
- **Kepler panel:** Idealized 2-body orbit (eccentricity=0, RAAN=0, initial anomaly=0 at a fixed experiment epoch), with `μ=398600.4418 km³/s²`, spherical Earth radius `6371 km`.

**Endpoint:** `GET /api/orbit/preview?altitude_km=550&inclination_deg=51.6&at=2026-10-18T00:00:00Z&epoch=2026-10-18T00:00:00Z`. `at` and `epoch` are optional, but any provided value must be timezone-aware. The chosen epoch is held constant in the client so time navigation does not reset the virtual spacecraft's phase. The default orbit returns a state, Kepler-derived period/speed, 241 trajectory samples, a 129-point frozen-instant plane, and explicit scientific assumptions. Input limits are validated by FastAPI and the engine; times may be at most 30 days from the experiment epoch.

**Limitations:** This circular model is **not** SGP4, an orbital maneuver calculator, or a precision Earth-orientation model. The conversion from the model's inertial frame to Earth-fixed latitude/longitude uses a simplified sidereal rotation (UTC approximates UT1; precession, nutation and polar motion ignored). Earth is taken to be spherical; the real ISS uses Skyfield's WGS84-based geodetic observations. The 3D scene projects geographic positions onto a stylized globe; visual interpolation is not numerical propagation.

Run backend tests with `cd backend && python -m pytest -q`, and build-check the frontend with `cd frontend && npm run build`.
