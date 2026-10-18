# APHELION — Vision, Scientific Architecture & Development Plan

**Status:** v0.7 historical element archive implemented; local frontend build and integration verification required  
**Project identity:** Orbital Detective / APHELION  
**Type:** Personal, interactive scientific playground, not a production satellite operations tool

## 1. What are we building?

APHELION combines **real orbital physics**, **interactive experiments**, and a **beautiful mission-control-inspired 3D interface**. Users can visualize a spacecraft around Earth; examine predicted position and velocity; place ground stations; inspect pass windows; manipulate simulated time; and later create virtual satellites and compare orbital models.

The goal is neither a conventional satellite tracking dashboard nor a purely mathematical simulation. The mathematical model and the UI must remain synchronized so the user can *see and manipulate* each concept as soon as it is implemented.

### Non-goals

- No generic account system, billing, multi-tenancy, subscriptions, or early cloud infrastructure.
- No claims of receiving live satellite telemetry or making operationally certified orbital predictions.
- No unrelated features just because they are easy to add.
- No backend-only feature backlog that sits unvisualized for several releases.

## 2. The hard rule: vertical slices, every time

**Every backend feature must ship with a thoughtfully designed, interactive frontend expression in the same milestone.** Every UI motion that represents real physical state must be traceable to correct physical calculations.

Each feature moves through this loop:

1. **Scientific specification:** What quantity, coordinate frame, units, assumptions, and time system are involved?
2. **Computation + API:** Implement/validate the calculation and return typed output with provenance.
3. **Interactive UI:** Implement the animation, visualization, controls, transitions, and understandable feedback states.
4. **Integration:** Ensure UI and API respond together to changing inputs, including loading/error/empty states.
5. **Verification:** At least one meaningful calculation test and a manual frontend interaction check.
6. **Checkpoint:** User clones current commit, runs it locally, and reports what works or fails before expanding scope.

A feature is **not complete** after only step 2. The preferred unit of progress is a small end-to-end capability the user can actually experience.

## 3. Experience and visual direction

**Design language:** Cinematic, restrained space mission control; dark/navy background; luminous cyan/mint instrumentation; limited amber highlights; subtle glassy telemetry panels; clear numerical typography. The interactive globe is the visual centerpiece, not a token 3D ornament.

**Animation principles:** Smooth camera changes, orbit-path motion, hover/selection transitions, value interpolation, scrub/playback feedback, elevation arcs and horizon cones. Animation must enhance physical understanding rather than make a prediction look more precise than it is.

**Interaction principles:** Direct manipulation where sensible (dragging a ground station, adjusting a mask, scrubbing time, modifying orbit parameters). Immediate feedback for actions; apparent delay only for genuinely computational operations. Keyboard/pointer accessibility and responsive layout should be maintained.

**Data honesty:** Clearly separate **propagated model results**, **interpolated display states**, and **decorative visuals**. Surface orbital-element epoch, cache status, and errors rather than silently fabricating data.

## 4. Initial architecture

```text
                     APHELION — browser UI
      ┌──────────────────────────────────────────────┐
      │ React + TypeScript + Vite                    │
      │ React Three Fiber / Three.js (3D Earth)      │
      │ Motion / CSS (UI transitions + telemetry)    │
      │ Interactive globe + controls + science views │
      └──────────────────────┬───────────────────────┘
                             │ typed HTTP /api calls
                             ▼
      ┌──────────────────────────────────────────────┐
      │ Python / FastAPI                             │
      │ Skyfield + SGP4 orbital propagation          │
      │ WGS84 geodetic and observer calculations     │
      │ Pass prediction and element provenance       │
      └──────────────────────┬───────────────────────┘
                             │ cached source elements
                             ▼
                     CelesTrak (ISS TLE)
```

**Backend responsibilities:** Orbital and observer physics, input validation, units, times, data provenance, numerical tests.  
**Frontend responsibilities:** Visualization, smooth playback between known samples, direct controls, user feedback, accessible formatting.  
**Contract:** The frontend must never quietly substitute random numbers for unavailable real orbital data.

## 5. Features and roadmap: small, paired deliveries

| Slice | Scientific/backend capability | Frontend/interaction delivered in the same slice | Completion signal |
|---|---|---|---|
| **0.1 · First Contact** (initial code) | CelesTrak ISS TLE retrieval/cache; SGP4 state/ground track; observer angles and pass windows | 3D globe, moving ISS marker, animated trail, time control, station switcher, telemetry, passes and provenance screens | Positions and pass data appear in UI; errors surfaced; math checks run |
| **0.2 · Ground Control** | Arbitrary station coordinates, configurable elevation mask, visibility windows | **Click/drag station** on globe; animated horizon/visibility cone; real-time pass/geometry updates; fine mask slider | Moving a station or changing mask updates the full view consistently |
| **0.3 · Orbit Explorer** (implemented) | Circular two-body inclination, semimajor axis/altitude, speed and period; validated state and epoch; Earth-fixed track | Altitude/inclination presets and sliders; animated violet spacecraft, tilted frozen-instant orbital plane and Earth-fixed ground trail; ISS comparison | Slider interaction triggers computation, visuals and numerical readouts together |
| **0.4 · Mission Designer** (implemented) | Elliptical two-body propagation with eccentricity, i, Ω, ω, initial true anomaly, apsis distance and vis-viva speed | APHELION-X shape/plane/phase sliders, eccentricity diagram, illuminated apsis markers and speed readout | Compute state in Python, animate on 3D Earth and display synchronized results in the same slice |
| **0.5 · Numerical Lab** (implemented) | Independently evolve the same Cartesian ECI initial state with Euler, velocity Verlet or RK4; analytic Kepler baseline; 3D ECI position error and invariants | Adjustable 10–360 s max integration substep; 1–3 period horizon; animated 3D analytic/numerical overlays, logarithmic interactive error plot, metric cards and time scrubbing | Analytic and numerical tracks start together; method and timestep visibly affect measured numerical error |
| **0.8 · J₂ Perturbation Laboratory** (implemented) | Compare fixed-step RK4 two-body and J₂ zonal gravity trajectories from identical ECI initial state; compute osculating nodal drift and leading-order secular rate | Interactive inclination/horizon controls, overlaid 3D final-orbit trajectories, historic nodal-drift chart and synchronized telemetry | Inclination changes nodal-precession sign; numerical J₂ effects and limits displayed alongside real backend calculations |
| **0.6 · Orbital Detective** (implemented) | Compare SGP4 predictions against two-body integration from the same epoch | Animated overlay and discrepancy timeline | Model disagreement is clearly labeled, not treated as observed error |
| **0.7 · Epoch Archive** (implemented) | Archive independently recorded ISS TLE sets; compare SGP4 predictions at matched UTC instants | Snapshot selectors, historical import, 3D overlays and synchronized RIC discrepancy chart | No fabricated history; provenance and limitations displayed |

These are **proposals**, not a promise to implement every item. Each slice is reviewed after local validation; exploration remains more important than feature quantity. Later optional experiments may include Sun/Earth illumination geometry, ground-station optimization, satellite constellations, and educational conjunction geometry (never safety-critical collision warnings).

## 6. Scientific model: concepts to maintain carefully

### 6.1 Real spacecraft mode

We ingest **published general perturbations/orbital elements** from CelesTrak and propagate the ISS with **SGP4** via Skyfield. Resulting predictions are not telemetry. Element sets must include epoch information; predictions become less reliable as their element epoch becomes stale.

### 6.2 Coordinates and reference frames

A spacecraft position used in a world-fixed Earth visualization is not interchangeable with an inertial vector. Skyfield handles relevant Earth-orientation transformations for geodetic coordinates and ground-observer directions. All new models must document frame conventions before linking them to the globe.

**Current state:** geodetic latitude, longitude, altitude; approximate inertial-frame speed magnitude; observer-relative azimuth, elevation, slant range. The viewer interpolates 45-second sample spacing for display only.

### 6.3 Orbital mechanics fundamentals

For an ideal **circular two-body orbit**, with gravitational parameter \(\mu\) and orbital radius \(r\):

\[
 v = \sqrt{\frac{\mu}{r}}, \qquad
 T = 2\pi \sqrt{\frac{r^3}{\mu}}.
\]

These are useful teaching/validation formulas, not replacements for SGP4 for real satellite tracking. In the Mission Designer, we will explicitly distinguish the ideal two-body model from real propagated element sets.

### 6.4 Ground-station passes

For observer elevation \(e(t)\) and chosen horizon mask \(e_{\min}\), idealized geometric visibility is \(e(t) \ge e_{\min}\). We compute rise, peak, and set events over a requested interval. In v0.2 the observer mask is configurable from **0° to 30°**, passed through to Skyfield pass predictions and the contact-margin samples. An above-mask pass is not automatically optically visible or radio-reachable.

### 6.5 Uncertainty and limitations

- Neither TLE data nor SGP4 yields precise future truth indefinitely.
- No guarantee of accuracy is implied by the implementation's ±14-day epoch check.
- The visualization is stylized. Display interpolation does not replace propagation at the exact requested time.
- Orbital deviation alone does not demonstrate a maneuver; conjunction geometry alone does not establish collision risk.
- A successful calculation should declare timestamp, units, source, and assumed model.

## 7. Repository rules and workflow

**Structure**

```text
README.md                  # Installation and run instructions
 guides/
   PROJECT_PLAN.md          # This single initial planning/theory document
 backend/                   # Python science engine and tests
 frontend/                  # React mission control with 3D globe
 generate_earth_texture.py  # Optional local art generation
```

**Workflow**

1. Assistant proposes or implements **one integrated UI + backend slice**.
2. Assistant prepares a cohesive, reviewable change and shares what changed and what was tested.
3. GitHub commits/pushes happen **only with explicit permission** and to the user's designated repository/branch.
4. User **clones/pulls** and tests locally, reporting runtime behaviour, screenshots, console traces, or bugs.
5. Fix integration issues before growing the scope further.

**Initial guide policy:** Keep just **this one file** in `guides/` until more theory or implementation notes are genuinely needed.

## 8. Next action

Verify **v0.4 Mission Designer** locally and resolve integration bugs before starting v0.5. Ground Control includes arbitrary point placement via globe raycasting (click, not drag), 0°–30° mask input, backend-recomputed WGS84 line-of-sight and passes, contact-margin readings, a spherical-reference footprint visualization, and pass-to-peak timeline navigation. Do not begin a backend-only sprint.


## 9. v0.2 Ground Control — mathematical/visual contract

For a chosen geodetic station (latitude, longitude, zero WGS84 ellipsoidal height), Skyfield gives the satellite's observer-relative **azimuth**, **elevation** \(e(t)\), and **slant range**. For a user-selected mask \(e_{\min} \in [0°,30°]\), the **contact margin** is

\[
M(t) = e(t) - e_{\min}.
\]

The UI shades margins above zero green, below zero amber and draws the corresponding line of sight only when \(M(t) \geq 0\). This denotes **geometric contact eligibility** (not a verified RF link). Pass predictions are computed anew for each chosen mask and station; a selected pass card jumps to the calculated culmination time.

The glowing footprint around the satellite's subpoint uses the **ideal spherical Earth reference** (not WGS84 geodesic geometry). With mean Earth radius \(R=6371\) km, altitude \(h\), and elevation mask \(e\), the angular radius along the Earth is

\[
\psi = rccos\!\left(rac{R}{R+h}\cos e
ight)-e,\qquad D_{\mathrm{surface}} = R\psi.
\]

Angles inside the trigonometric expression must be in radians. The backend provides \(\psi\) per orbital sample and the reference footprint radius in kilometers; the UI projects it as a small circle using spherical destination-point calculations. This overlay is an **approximation for intuition**: at nonzero WGS84 flattening it need not coincide exactly with the station elevation boundary. Display positions between 45-second backend samples are interpolated for smoothness, not independently propagated.

**Checks:** test that raising the mask decreases footprint radius and contact margin, that increasing altitude increases footprint radius, and that API responses round-trip arbitrary valid station coordinates. Validate visually that clicking relocates the station and all readings update together, mask changes redraw threshold and orbit overlay, and no stale station readings are shown during recalculation.


## 10. v0.3 Orbit Explorer — scientific and interface contract

**Distinct models:** The amber ISS is real CelesTrak orbital-element propagation through SGP4/Skyfield, while APHELION-X (violet) is a *hypothetical* circular two-body orbit. The same UI timeline drives both animations; changing the virtual altitude or inclination must never alter the ISS state. Orbit Explorer remains operational if ISS element downloads fail.

The circular-orbit parameters are altitude `h ∈ [200,2000] km` and inclination `i ∈ [0°,180°]`. Eccentricity is fixed to 0, ascending node RAAN to 0 and initial circular anomaly to 0 at the browser's fixed **experiment epoch**. For spherical Earth radius `R = 6371 km` and terrestrial gravitational parameter `μ = 398600.4418 km³/s²`,

`r = a = R + h`, `n = sqrt(μ / a³)`, `v = sqrt(μ/a)`, `T = 2π/n`.

At `Δt` seconds from the experiment epoch and true anomaly `ν = nΔt`, our simplified ECI coordinates are `(r cosν, r sinν cos i, r sinν sin i)`. Convert to a spherical Earth-fixed frame by rotating about Earth's Z axis by the negative Greenwich mean sidereal angle at the *sample time*. For scientific traceability, this educational rotation computes GMST using UTC as a proxy for UT1, ignoring precession, nutation, polar motion, atmospheric drag, J2 and orbital maneuvers. The Cartesian → lat/lon conversion is spherical; it is **not** interchangeable with real-SGP4/WGS84 observations.

The animated **solid violet orbital-plane ring** freezes the terrestrial orientation at the backend calculation instant. Thus it illustrates inclination but is not itself an Earth-fixed satellite trajectory over time. The **dashed violet ground trail** recomputes Earth's rotation at every sampled instant. The moving violet marker samples the latter, not the former; a small offset relative to the frozen plane is expected as time advances.

The Python endpoint `GET /api/orbit/preview` validates both parameters and timezone-aware timestamps, independently constructs 241 UTC trajectory samples and 129 frozen-plane points and returns inputs, derived parameters and assumptions. The React side debounces requests, aborts superseded requests, never displays stale orbit results against new sliders, and interpolates only within a known sampled window.

**Validation:** Kepler's third law, altitude–period monotonicity, altitude–speed monotonicity, maximum inclination latitude, sidereal rotation over six hours, API shape, and invalid parameter/time rejection. Next possible extension (v0.4) permits eccentricity and independent RAAN/initial anomaly, explicitly labeled as a more general orbit model rather than modifying the ISS.

## 11. v0.4 Mission Designer — mathematical and interface contract

**Design decisions:** `altitude_km` is now explicitly the **perigee altitude** of the virtual orbit; circular v0.3 results remain unchanged for `e=0`. Input bounds are perigee altitude 200–2000 km, eccentricity 0–0.35, inclination 0–180°, and Ω, ω, ν₀ within 0–360°. ν₀ is the **true anomaly at the experiment epoch**. We do not represent e>0 with a fixed circular radius. We keep operational ISS propagation separate (SGP4).

**Computation:** with spherical reference Earth radius `R`, perigee radius `r_p=R+h_p`, semimajor axis `a=r_p/(1−e)`, apogee radius `r_a=a(1+e)`, gravitational parameter `μ=398600.4418 km³/s²`, mean motion `n=√(μ/a³)`, and period `T=2π/n`. Convert ν₀ to E₀ and mean anomaly `M₀=E₀−e sin E₀`. Advance `M(t)=M₀+n(t−t₀)`; solve Kepler's equation `M=E−e sin E` numerically; convert to ν and `r=a(1−e cos E)`. Instantaneous speed follows the vis-viva relation `v²=μ(2/r−1/a)`. Perifocal position rotates into inertial space through `R₃(Ω)R₁(i)R₃(ω)` and into approximate Earth-fixed coordinates using GMST. No J₂/drag/thrust modeling is claimed.

**API / backend:** Existing `GET /api/orbit/preview` extended with `eccentricity`, `raan_deg`, `argument_of_periapsis_deg`, `phase_deg_at_epoch`; backward-compatible defaults restore circular v0.3 physics. Backend response includes Earth-fixed time series and frozen-at-request-time ellipse and apsides, with `derived` geometric and kinematic quantities and assumptions. All parameters validated by FastAPI, with defensive finite input validation in Python. Time remains within 30 days of epoch to avoid implicitly claiming high-fidelity future accuracy.

**UI / interaction:** Four presets, six accessible continuous sliders, a schematic Earth-at-focus ellipse with evolving satellite marker, four backend-derived key readouts (perigee, apogee, period and current vis-viva speed), dynamic phase/altitude strip, 3D violet ellipse, glowing apsis markers, rotating-Earth trail, and timeline scrubbing independent of ISS data. When controls change, the stale preview is hidden during a debounced API re-computation. Previous ISS and Ground Control views remain accessible.

**Verification:** Offline Kepler equation residual, vis-viva/specific-energy invariance, perigee/apogee extrema and velocity ordering, period law, phase and orientation effects, circular regression, invalid parameter rejection, and API contract checks. The Python-only mathematics tests can run without network access; the full suite and frontend bundle require dependency installation on the developer's machine.

**Next potential milestone (only after local validation):** v0.5 Numerical Propagation Lab, comparing Kepler propagation with time-stepped integrators under the same UI, including error/step-size plots and consistency tests. No backend-only development.


## 12. v0.5 Numerical Laboratory — precise contract

**Question.** How do three time-stepping algorithms deviate from an exact analytical two-body reference when initial conditions, epoch, and force model agree?

**Backend.** `backend/app/numerical.py` implements the Cartesian ECI initial condition from the same Keplerian elements used in v0.4. Evolve `d r/dt = v`, `d v/dt = -μ r / |r|³` using forward Euler, velocity Verlet, or RK4. The analytic comparator uses Kepler's equation independently at each sampled time. Relative energy drift is `100 abs((ε(t)−ε₀)/ε₀)`, with `ε = |v|²/2−μ/|r|`. Relative angular momentum drift is `100 abs((|r×v|(t)−h₀)/h₀)`. Position error is `||r_numerical−r_analytic||₂` in inertial kilometers *before* converting to geographic coordinates, rounding, or display interpolation. The output grid contains 13–181 aligned samples over 1–3 orbital periods; large requested steps use a sparser grid to prevent silently capping the effective step at the visualization spacing. All computations use the same gravitational parameter and spherical reference-Earth radius as the Mission Designer.

**Important subtlety.** The slider controls **maximum integration substep size** (10–360 s). Integration substeps shrink at output boundaries so both trajectories have exactly corresponding timestamps. Thus velocity Verlet here is second-order kick–drift–kick but **not** a rigorously fixed-step symplectic map across output steps. Do not describe it as preserving symplecticity without qualification. The entire experiment is ideal unperturbed Kepler motion: no J₂, drag, thrust, uncertainty, or collision safety model.

**API.** `GET /api/orbit/compare`, query parameters: `epoch` (UTC/offset-aware), virtual orbit elements matching `/api/orbit/preview`, `method` in `{euler,verlet,rk4}`, `step_seconds` 10–360, `duration_orbits` 1–3. Response includes `reference_track`, `numerical_track` and 13–181 aligned diagnostics, final/maximum position errors and maximum conservation-law drifts. The request is independent of ISS data, although the full FastAPI application still needs the declared backend packages installed.

**Frontend.** `LAB` tab and quick launch beside the 3D globe. Violet = analytic Kepler reference; amber = selected numerical integrator. Both marker positions and sampled trajectories come from the Python backend. The chart uses a logarithmic y-axis to allow Euler and RK4 experiments; click a chart position to scrub the synchronized globe. Experiment controls update the API, summary statistics, labels, and 3D path together. Editing the elements in DESIGNER changes the initial conditions of the next laboratory comparison. Old comparison results are hidden while parameters change. Browser animation uses interpolation for visual continuity only, never as an integrator.

**Verification.** Python mathematical tests cover shared initial state, conservation-law reference values, Euler/Verlet/RK4 error ordering, improvement with smaller RK4 substeps, generic orbital orientation, input validation, and API contract. Re-run complete installed `pytest` and `npm run build` on the developer machine; a visual/manual WebGL check must validate rendering and chart/time synchrony before proceeding to v0.6.

## 13. v0.6 Orbit Forensics — single-epoch model investigation

**Question:** Starting from the *same* real ISS Cartesian state at the published CelesTrak GP element epoch, how far apart do the SGP4 prediction and an ideal Newtonian two-body continuation evolve?

**Scope:** This is **one model-comparison experiment**, not a comparison of two independently determined historical element sets. The baseline is the GCRS position and velocity from Skyfield's SGP4 state at its element epoch. The comparator integrates `ṙ=v`, `v̇=−μr/|r|³` with RK4, maximum 45 s internal step, the same terrestrial gravitational parameter as the existing numerical laboratory. The SGP4 model remains untouched. Both trajectories use the same GCRS coordinates at each timestamp, and both are transformed to WGS84 geographic positions for globe display using Skyfield. Ground-track interpolation is visual only.

**Signed differences:** with `δr=r_two-body−r_SGP4`, radial unit `e_R=r_SGP4/|r_SGP4|`, cross-track unit `e_C=(r_SGP4×v_SGP4)/|r_SGP4×v_SGP4|` and along-track `e_I=e_C×e_R`, calculate `δr·e_R`, `δr·e_I`, `δr·e_C`, and total `|δr|` in **unrounded GCRS kilometers**. The RIC components are not geographic latitude/longitude errors. The magnitude describes **model disagreement**, *not* observed orbit-prediction error or evidence of a maneuver. No operational conclusions are warranted. Orbital-element age is displayed and a failure to acquire authentic elements is never replaced with synthetic ISS data.

**API:** `GET /api/orbit/forensics?horizon_hours=6` with supported discrete horizons `{3,6,12,24}`. Data include element-epoch provenance, aligned SGP4 and two-body tracks, and signed radial/along-track/cross-track diagnostics. Dynamic comparisons are computed on demand from the same snapshot fetched or cached through the existing `safe_satellite()` pathway; no new source or API keys are needed.

**Frontend:** New DETECTIVE tab and globe quick-launch. Animated violet SGP4 and amber two-body trajectories, interactive clickable/scrubbable discrepancy graph, four horizon presets, live RIC bars, satellite epoch/cache provenance, and conspicuous scientific cautions. The global playback timeline and 3D orbit camera are reused. A new set of data invalidates previous results until recomputation completes. No generic dashboard refactor.

**Verification:** `PYTHONPATH=backend python -m pytest -q backend/tests/test_forensics.py backend/tests/test_numerical.py` covers signed RIC basis, RK4 circular/elliptic closed-orbit agreement, input rejection, and v0.5 numerical regressions. API runtime and bundled browser build require Skyfield/frontend dependencies on the local development machine. The target after validating v0.6 is to archive *distinct, verifiable, dated* element snapshots and compare SGP4 solutions with different input epochs, with element-set provenance and constraints stated explicitly.


## Experiment 007 — historical TLE snapshot divergence

Only real, recorded TLE contents are accepted: initially the ISS cached CelesTrak element record, then any later distinct updates or explicitly supplied historical TLEs. There is **no** built-in historical ephemeris provider and **no synthetic element archive**. The persistent local `backend/data/iss_tle_history.json` stores TLE text, element epoch, capture timestamp and source-status label. A user-provided TLE is syntactically validated but source authenticity cannot be established. The archive is local and ignored by Git.

For two distinct epochs `t_a` and `t_b` no more than five days apart, choose common start `t_0 = max(t_a,t_b)`. Independently apply **SGP4** to each element set at the same UTC sequence `t_0 + k Δt`, convert both Skyfield GCRS states to WGS84 geographic coordinates for display, then calculate `δr(t) = r_b(t) − r_a(t)` in GCRS km. Signed RIC components use the first model's local radial, transverse and cross-track unit vectors. The norm `||δr||₂` is model **prediction separation**; it is not observational accuracy or a verified maneuver. Epoch separation constraints reduce extreme extrapolation but do not guarantee accuracy.

**API** `GET /api/orbit/history`, `POST /api/orbit/history/import`, and `GET /api/orbit/history/compare`. **UI:** archive selectors, horizon buttons, manual TLE import, honest empty/error/provenance states, an animated pair of 3D ISS trajectories, an interactive separation plot and the shared simulation playhead. The physics and UI are shipped in the same slice.

**Verification:** `cd backend && python -m pytest -q tests/test_history.py`; `cd frontend && npm run build`. Full browser integration requires the user's local environment.


## Perturbation Laboratory v0.8 — J₂ gravity

Select **J₂ LAB**. The experiment compares two **hypothetical** trajectories from the same ECI Cartesian initial position and velocity, each advanced with a fixed **60-second RK4** timestep. The reference acceleration is `−μr/r³`; the second adds the zonal gravity term

`a_J₂ = (3 J₂ μ Rₑ² / 2r⁵) · [x(5z²/r²−1), y(5z²/r²−1), z(5z²/r²−3)]`

with `μ=398600.4418 km³/s²`, `J₂=0.00108262668`, and equatorial Earth radius `Rₑ=6378.137 km`. Both models share a constant inertial z-axis aligned with the assumed Earth rotation axis. Initial **perigee altitude** is still measured from the Mission Designer's spherical `6371 km` reference Earth, distinct from the WGS84 equatorial radius in J₂ acceleration.

**Rate:** first-order averaged nodal precession `dΩ/dt = −(3/2)n J₂(Rₑ/p)² cos(i)` where `n=√(μ/a³)` and `p=a(1−e²)`. The chart instead shows **numerical osculating** ascending-node drift; short-period fluctuations mean its endpoint need not match the secular estimate exactly. Ω is **undefined** for equatorial orbits. Prograde nodes generally regress (negative sign), retrograde nodes advance, and the leading-order secular polar rate vanishes. Do not interpret model separation as observed orbital error, maneuver detection, or collision hazard.

**Interaction:** change inclination (0–180°) or propagation horizon (1, 3, 7 days), hover/scrub the historical nodal-drift chart, and play the globe's **final three hours** of both models' predicted trajectories. The historical chart spans the full horizon; the 3D globe deliberately focuses on the last three hours to avoid aliasing from undersampled multiday orbital lines. The globe uses the existing simplified Earth-fixed GMST conversion and display interpolation; separation is calculated in ECI from unrounded Cartesian vectors. No drag, higher harmonics, Sun/Moon, precession/nutation, or precision Earth orientation.

**Endpoint:** `GET /api/orbit/perturbations?horizon_days=3&inclination_deg=51.6&altitude_km=450&eccentricity=0.24&raan_deg=35&argument_of_periapsis_deg=60&phase_deg_at_epoch=0&epoch=2026-10-18T00:00:00Z`. Inputs are validated in FastAPI and the pure Python physics engine. No CelesTrak connectivity required for this hypothetical laboratory.

**Targeted test:** `cd backend && python -m pytest -q tests/test_perturbations.py`. **Frontend:** `cd frontend && npm run build`.
