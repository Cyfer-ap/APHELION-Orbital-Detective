# APHELION — Vision, Scientific Architecture & Development Plan

**Status:** v0.1 initial implementation, awaiting complete local integration testing  
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
| **0.3 · Orbit Explorer** | Interpret inclination, eccentricity, semimajor axis/altitude and orbital period; validated orbital state outputs | Illustrated orbit-plane and inclination controls; linked 3D orbit and information panels | Slider interaction displays physically consistent orbital changes |
| **0.4 · Mission Designer** | Two-body Keplerian virtual-satellite propagator and configurable initial conditions | Create CHACHA-SAT-01; manipulate orbital parameters; animate physical effects | Simulated satellite model visibly responds to parameters and passes checks |
| **0.5 · Orbital Laboratory** | Numerical two-body integrator; compare with analytic baseline; diagnostic invariants | Split/overlay trajectory comparisons; interactive error plots and time controls | Explanatory comparison plots agree with controlled reference cases |
| **0.6 · Orbital Detective** | Compare time-separated element sets and propagated positions; compute deviations | Visual "investigation" missions with orbit overlays and discrepancy timeline | User can inspect prediction differences without mistaking them for proven maneuvers |

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

For observer elevation \(e(t)\) and chosen horizon mask \(e_{\min}\), idealized geometric visibility is \(e(t) \ge e_{\min}\). We compute rise, peak, and set events over a requested interval. In v0.1 the mask is a fixed **10 degrees**; configurable thresholds belong to slice 0.2. An above-mask pass is not automatically optically visible or radio-reachable.

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

First verify v0.1 locally after publishing. Then implement **slice 0.2 — Ground Control** as a coordinated pair: station placement and elevation-mask calculations in FastAPI **plus** immediate interactive globe placement, animated horizon geometry, and updated pass display in React. Do not start a separate backend-only sprint.
