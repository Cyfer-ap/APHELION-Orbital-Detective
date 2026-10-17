# APHELION — Orbital Detective

**An interactive orbital mechanics laboratory with an animated 3D mission-control interface and a real Python computation backend.**

> **Project rule:** Every new scientific/backend capability ships in the same vertical slice as its polished, interactive UI. We will not build the entire backend first and add a frontend later.

## What exists in v0.1

- Interactive, stylized **3D Earth** with orbit/ground-track visualization and a predicted ISS position marker.
- Real **ISS orbital propagation** via Skyfield/SGP4 using CelesTrak orbital elements (not live telemetry).
- **Simulation controls** for pausing, scrubbing, stepping and accelerating time.
- Ground-station selector: **New Delhi, Tokyo, Oslo and San Francisco**.
- Backend-computed **azimuth, elevation, slant range, altitude, and orbital speed**.
- Upcoming **satellite passes** over a configurable location using the current fixed **10° minimum elevation mask**.
- Telemetry, passes, and science/provenance views, with clear data-source and cache status.

The Earth texture, star field, atmosphere, visual glow, and animation styling are illustrative; calculated spacecraft states are model predictions. This application is for exploration and education, not satellite operations or collision avoidance.

Full scope, release roadmap, scientific assumptions, and the UI/backend development contract: **[guides/PROJECT_PLAN.md](guides/PROJECT_PLAN.md)**.

## Prerequisites

- **Git**
- **Node.js 20.19+** (Node 22 recommended) and npm
- **Python 3.11+** and pip
- A browser with **WebGL** enabled
- Internet access on first run so the backend can retrieve an ISS TLE from CelesTrak

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

1. **Rotate and zoom** the Earth; select the ISS marker and inspect its track.
2. **Pause, scrub, and accelerate time**; watch the predicted location and telemetry follow the same computed data.
3. **Change ground stations**; check how elevation, azimuth, range, and contact windows change.
4. Open **Passes** for predicted above-10° windows over the selected station.
5. Open **Science** to inspect the propagator, orbital-element epoch, and cache provenance.

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

**Current verification:** Initial source files have passed basic Python and TypeScript syntax-level checks. A full dependency-installed runtime and integration validation is still required on a local machine. If something fails, report the console output and we will fix it as part of the next integrated UI + backend slice.

## Project structure

```text
.
├── README.md                    # Clone, run, test, and troubleshooting
├── guides/
│   └── PROJECT_PLAN.md         # The vision, architecture, theory, roadmap, rules
├── backend/
│   ├── app/main.py              # FastAPI endpoints
│   ├── app/orbits.py            # Real SGP4 propagation and visibility calculations
│   ├── tests/test_orbits.py     # Mathematical sanity checks
│   └── requirements.txt
├── frontend/
│   ├── src/App.tsx              # Mission-control app and interactions
│   ├── src/components/OrbitalGlobe.tsx
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

This is a personal scientific playground, **not a SaaS**. No authentication, payment features, accounts, or production infrastructure unless they become essential to a specific experiment. The next planned slice is an **interactive ground-station placement + elevation-mask explorer**, with backend visibility calculations and corresponding visual feedback delivered together.

## Scientific limitations

Orbital positions are **SGP4 predictions**, not live satellite telemetry. Observer geometry uses WGS84 and a simplified horizon elevation threshold, not terrain, weather, optical brightness, or actual radio link budgets. The visualization interpolates between backend-computed time samples for smooth animation. The ±14-day TLE epoch guard is only a conservative UI limit, **not** a guarantee of prediction accuracy anywhere inside that window. Time and frame conventions must be checked whenever orbital models or UI controls change.
