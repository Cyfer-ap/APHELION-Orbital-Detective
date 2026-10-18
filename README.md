# APHELION — Orbital Detective

**An interactive orbital mechanics laboratory with an animated 3D mission-control interface and a real Python computation backend.**

> **Project rule:** Every new scientific/backend capability ships in the same vertical slice as its polished, interactive UI. We will not build the entire backend first and add a frontend later.

## What exists in v0.5

- **Numerical Lab v0.5:** Compare Python-computed analytic Kepler states with three independent numerical integrators (**forward Euler**, **velocity Verlet**, **RK4**) for the *same virtual satellite and initial ECI state*. Adjust maximum substep (10–360 seconds) and propagation horizon (1–3 orbits), and inspect animated 3D path overlays, numerical separation markers, energy-drift metrics, and a clickable logarithmic position-error graph. The laboratory works independently of ISS data.
- **Mission Designer v0.4:** Design a virtual **elliptical** satellite trajectory by changing perigee altitude (200–2000 km), eccentricity (0–0.35), inclination (0–180°), right ascension of ascending node Ω (0–360°), argument of periapsis ω (0–360°), and initial true anomaly ν₀ (0–360°). The Python backend solves Kepler's equation and computes vis-viva speed, apogee/perigee, period, and Earth-fixed trajectories.
- **Integrated UI:** Violet 3D ellipse, illuminated perigee/apogee markers, moving satellite, synchronized telemetry, eccentricity-sensitive orbit schematic, four presets and time scrubbing even if ISS data is unavailable.
- **Previous v0.3 circular Orbit Explorer** remains a preset (set eccentricity to zero). Earlier ISS and ground-control visualizations are preserved.
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

The Earth texture, star field, atmosphere, visual glow, and animation styling are illustrative; calculated spacecraft states are model predictions. The virtual orbit is an ideal unperturbed Keplerian model with a spherical Earth and approximate Greenwich sidereal angle. This application is for exploration and education, not satellite operations or collision avoidance.

Full scope, release roadmap, scientific assumptions, and the UI/backend development contract: **[guides/PROJECT_PLAN.md](guides/PROJECT_PLAN.md)**.

## Prerequisites

- **Git**
- **Node.js 20.19+** (Node 22 recommended) and npm
- **Python 3.11+** and pip
- A browser with **WebGL** enabled
- Internet access on first run to retrieve ISS data from CelesTrak. **The virtual Mission Designer operates without CelesTrak data.**

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
7. Open **Mission Designer** to see a virtual elliptical orbit. Choose ELLIPTICAL, move the eccentricity slider, and inspect the violet ellipse and perigee/apogee markers.
8. Change Ω and ω; watch the orientation and apsides rotate. Set ν₀ to change the starting spacecraft position. Scrub time to watch speed and altitude vary between perigee and apogee.
9. Select **CIRCULAR** and verify that perigee and apogee coincide and the speed becomes constant.
10. Open **LAB** or **OPEN NUMERICAL LAB**. Try Euler at 240–360 seconds and 3 orbits, then select RK4: the amber trajectory should track the purple analytic orbit far more closely, and the error curve should drop. Reduce the step toward 10 seconds and watch errors decrease. Click the logarithmic error chart to scrub to that instant.
11. Change the starting orbit in **DESIGNER**, then return to **LAB** to compare the same modified orbit.
12. Open **Science** to inspect ISS propagation, orbital-element epoch, cache provenance, and footprint assumptions.

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

**Current verification:** v0.5 numerical-integration tests, including method ordering and RK4 step convergence, run without Skyfield or network access. Other existing scientific tests may need the full installed dependencies. Full integration (`pytest`, React production build, and browser testing) should be verified locally after installing dependencies. If something fails, report the console output and we will fix it before expanding scope.

## Project structure

```text
.
├── README.md                    # Clone, run, test, and troubleshooting
├── guides/
│   └── PROJECT_PLAN.md         # The vision, architecture, theory, roadmap, rules
├── backend/
│   ├── app/main.py              # FastAPI endpoints
│   ├── app/orbits.py            # Real SGP4 propagation and visibility calculations
│   ├── app/explorer.py          # Independently computed elliptical two-body preview
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

This is a personal scientific playground, **not a SaaS**. No authentication, payment features, accounts, or production infrastructure unless they become essential to a specific experiment. v0.5 compares that **elliptical Mission Designer** with three numerical integrators and synchronized animations. The next potential experiment is investigating prediction divergence from distinct element epochs, after local verification.

## Scientific limitations

Orbital positions are **SGP4 predictions**, not live satellite telemetry. Observer geometry uses WGS84 and a simplified horizon elevation threshold, not terrain, weather, optical brightness, or actual radio link budgets. **The luminous footprint is calculated using a spherical Earth of radius 6,371 km**, centered on the sub-satellite point: its edge is explanatory rather than an exact WGS84 coverage boundary. The visualization interpolates between backend-computed time samples for smooth animation. The ±14-day TLE epoch guard is only a conservative UI limit, **not** a guarantee of prediction accuracy anywhere inside that window. Time and frame conventions must be checked whenever orbital models or UI controls change.

### Ground Control API (v0.2)

`GET /api/mission?station_lat=28.6139&station_lon=77.209&min_elevation_deg=10`

Optional `at=` must be timezone-aware ISO 8601. Input coordinates are validated and the minimum elevation must be in **[0°, 30°]**. Each sampled state supplies `contact_margin_deg` and `footprint_deg`. The response's `coverage` metadata identifies the spherical-reference model; only observer azimuth/elevation and pass predictions use the WGS84 Skyfield geometry. Rapid slider changes are debounced; superseded HTTP requests are aborted.

**Windows note:** If you already created a virtual environment in the repository root, you may continue using it: `python -m pip install -r .\backend\requirements.txt`, then `cd backend` and start Uvicorn as above.


## Orbit Explorer v0.3 — a complete backend + animated UI slice

For the original circular v0.3 experiment, open **DESIGNER** (or click **OPEN MISSION DESIGNER** over the globe), choose **CIRCULAR**, and keep eccentricity at zero. Drag the altitude and inclination sliders or select a preset. The browser requests an orbit computation from Python, then updates the violet reference ellipse (circular when e=0), dashed Earth-fixed ground trail, animated APHELION-X satellite, period and speed metrics, and comparison against the independently propagated ISS. The real ISS is **never** modified by changing the virtual orbit.

- **Violet solid orbit:** The circular orbital-plane reference in the e=0 preset with Earth held fixed at the calculation instant.
- **Violet dashed line:** Earth-fixed sub-satellite ground track, accounting for Earth's rotation.
- **Amber spacecraft:** Real ISS / published CelesTrak elements / SGP4.
- **Kepler panel:** Idealized 2-body orbit (eccentricity=0, RAAN=0, initial anomaly=0 at a fixed experiment epoch), with `μ=398600.4418 km³/s²`, spherical Earth radius `6371 km`.

**Endpoint:** `GET /api/orbit/preview?altitude_km=550&inclination_deg=51.6&at=2026-10-18T00:00:00Z&epoch=2026-10-18T00:00:00Z`. `at` and `epoch` are optional, but any provided value must be timezone-aware. The chosen epoch is held constant in the client so time navigation does not reset the virtual spacecraft's phase. The default orbit returns a state, Kepler-derived period/speed, 241 trajectory samples, a 193-point frozen-instant reference ellipse, and explicit scientific assumptions. Input limits are validated by FastAPI and the engine; times may be at most 30 days from the experiment epoch.

**Limitations:** This circular model is **not** SGP4, an orbital maneuver calculator, or a precision Earth-orientation model. The conversion from the model's inertial frame to Earth-fixed latitude/longitude uses a simplified sidereal rotation (UTC approximates UT1; precession, nutation and polar motion ignored). Earth is taken to be spherical; the real ISS uses Skyfield's WGS84-based geodetic observations. The 3D scene projects geographic positions onto a stylized globe; visual interpolation is not numerical propagation.

Run backend tests with `cd backend && python -m pytest -q`, and build-check the frontend with `cd frontend && npm run build`.

## Mission Designer v0.4 — mathematical contract

For a perigee altitude `h_p`, Earth's **reference spherical** radius `R=6371 km`, and eccentricity `0≤e≤0.35`, the virtual orbit has

`r_p = R + h_p`, `a = r_p/(1-e)`, `r_a = a(1+e)`, `n=√(μ/a³)`, `T=2π/n`,

where `μ = 398600.4418 km³/s²`. The initial phase is the true anomaly ν₀ at a fixed experiment epoch (it is **not** the mean anomaly). We convert ν₀ to a mean anomaly M₀, evolve `M(t)=M₀+n(t−epoch)`, solve `M=E−e sin(E)` by Newton iteration and recover ν(t). We compute `r=a(1−e cos(E))` and `v=√(μ(2/r−1/a))`, with inertial orientation specified by Ω, i, ω.

The 3D **ellipse and apsides are a geometric snapshot**, frozen in the Earth-fixed orientation at the request time, while the ground track changes with Earth's rotation. Display-state animation interpolates backend time samples. This is a visualization of a two-body model, not a propagation model for the real ISS; it omits J₂, drag, maneuvers, nutation and polar motion.

API example (UTC times must include Z or a timezone):

```text
GET /api/orbit/preview?altitude_km=450&inclination_deg=51.6&eccentricity=0.24&raan_deg=35&argument_of_periapsis_deg=60&phase_deg_at_epoch=0
```

To run mathematical tests independent of external orbital-element downloads:

```bash
cd backend
python -m pytest -q tests/test_mission_designer.py
```

Run the complete backend suite after installing `backend/requirements.txt`.


## Numerical Lab v0.5 — equations, limits, and endpoint

The independent *analytic reference* solves Kepler’s equation for the same eccentricity and epoch used by the numerical calculation. The numerical state is a Cartesian 6-vector `y=(r,v)` integrated forward under

`dr/dt = v`, `dv/dt = -μ r / |r|³`, `μ=398600.4418 km³/s²`.

Available methods are first-order **forward Euler**, second-order **velocity Verlet** (kick–drift–kick), and fourth-order **RK4**. Both tracks start with identical ECI positions and velocities generated from the Mission Designer elements `(a, e, i, Ω, ω, ν₀)`. The error at each sample is `||r_numeric−r_analytic||₂` *in km* in the same inertial frame. Energy drift uses `ε=|v|²/2−μ/|r|` and angular-momentum drift uses `h=|r×v|`, both expressed as absolute percent changes from the initial value. The error plot is logarithmic to distinguish very small RK4 errors from Euler-scale drift.

**Step-size semantics:** The selected step is a *maximum*. A shorter integration substep may be needed to align with the output-sampling timeline. The output grid contains 13–181 samples and becomes intentionally sparser at coarse timesteps, so settings of 240s and 360s have measurably different effects. Therefore the Verlet implementation is not strictly fixed-step symplectic. Earth-fixed visualization uses the same approximate UTC/GMST rotation as the Mission Designer; measurement errors are calculated before this display conversion.

**Endpoint:** `GET /api/orbit/compare?epoch=2026-10-18T00:00:00Z&method=rk4&step_seconds=120&duration_orbits=2&altitude_km=450&inclination_deg=51.6&eccentricity=0.24&raan_deg=35&argument_of_periapsis_deg=60&phase_deg_at_epoch=0`

**Tests:** From `backend/`, run `python -m pytest -q tests/test_numerical.py` to verify the engine, invariants, method ranking, convergence, and invalid parameter rejection. The API-contract test requires the installed backend dependencies. Run `npm run build` inside `frontend/` to verify frontend typing/bundling.

The lab is ideal two-body mechanics—not SGP4, a perturbation model, operational orbit determination, or real satellite tracking. No collision safety conclusions should be drawn from it.

## Epoch Archive v0.7 — two recorded ISS element epochs

Open **ARCHIVE** (experiment 007) to inspect historically recorded **ISS (NORAD 25544)** orbital-element sets. The app archives each distinct CelesTrak TLE it encounters when the archive is opened; it cannot retroactively recreate old observations that were never saved. Paste a complete historical 2LE/3LE from a source you trust to make an immediate comparison with the current cached ISS TLE. Imported sources are explicitly flagged **unverified**.

The backend verifies each element line length, NORAD catalog ID, and TLE checksum, deduplicates snapshots by SHA-256 content hash, and writes the local archive into `backend/data/iss_tle_history.json` (ignored by Git). Select distinct records with epochs within five days and choose a 3–24 hour horizon. Both models use **SGP4**, each at exactly the same UTC sample instants beginning at the newer element epoch. The backend computes GCRS position separation and signed radial/along-track/cross-track components. Two animated globe trajectories, shared playhead, scrollable separation chart and provenance labels provide the paired visualization. Neither curve is observational truth; the difference is not evidence of a maneuver.

**Endpoints:** `GET /api/orbit/history` (archives current cached TLE and lists records), `POST /api/orbit/history/import` with JSON `{"tle": "ISS ...\n1 25544...\n2 25544..."}`, and `GET /api/orbit/history/compare?reference_id=<id>&candidate_id=<id>&horizon_hours=6`. When no second snapshot exists, the interface offers a truthful empty state instead of manufactured data. Snapshots are stored **locally** by the backend and are not uploaded or published.

**Targeted tests:** `cd backend && python -m pytest -q tests/test_history.py`, then `cd frontend && npm run build` (using existing local dependencies).

## Orbit Forensics v0.6 — SGP4 versus two-body physics

Select **DETECTIVE** or **OPEN ORBIT FORENSICS**. APHELION acquires real ISS orbital elements (CelesTrak), takes one SGP4 GCRS epoch state, and propagates it twice: SGP4 vs an unperturbed two-body RK4 solution. Select 3, 6, 12, or 24 hours; inspect both moving trajectories and click/scrub the model-separation chart to jump to any sample. Read the signed Radial / Along-track / Cross-track differences and the original element epoch/age. Backend API: `GET /api/orbit/forensics?horizon_hours=6`.

**Interpretation:** Model separation is **not** observational error, a detected orbit maneuver, or an estimated collision risk. The two models deliberately omit/include different perturbation treatments. Both globe paths are WGS84 geographic projections of the predicted GCRS states. The tool does not compare historical GP snapshots yet. If elements are unavailable, the UI shows a retriable data error, never fabricated satellite telemetry.

Targeted check from repository root:

```bash
cd backend
python -m pytest -q tests/test_forensics.py tests/test_numerical.py
```

Build frontend after dependencies are installed (as in initial setup):

```bash
cd frontend
npm run build
```


## J₂ Perturbation Laboratory (v0.8)

Open **J₂ LAB** in the navigation. Adjust **inclination** and the **1/3/7-day** propagation horizon. Two animated globe tracks show central gravity versus Earth's J₂ zonal gravity; hover or scrub the nodal-drift chart to inspect osculating ascending-node motion. The globe displays the **last three hours** of the propagation, while the historical chart spans the entire selected horizon. Read the separate first-order averaged secular node rate to understand why prograde and retrograde inclinations have opposite signs.

The physical model uses identical initial ECI states and 60-second RK4 timesteps on both sides. J₂ acceleration is an idealized Earth-oblateness perturbation, not an ISS-derived measurement, and is independent of CelesTrak. At strictly equatorial inclinations, RAAN is undefined.

API: `GET /api/orbit/perturbations?horizon_days=3&inclination_deg=51.6` with additional optional Mission Designer orbital-element parameters. Run `python -m pytest -q tests/test_perturbations.py` inside `backend/` and `npm run build` inside `frontend/`.
