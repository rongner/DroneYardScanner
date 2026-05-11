# Drone Yard Scanner

A full-stack PWA for autonomous plant health monitoring. Walk your yard to define a GPS flight path, then either deploy a drone to photograph each plant or walk it yourself in simulation mode. Every photo is sent to the [Kindwise Plant Health API](https://plant.id) for AI-powered disease detection, and results are tracked per-plant over time.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791?logo=postgresql&logoColor=white)

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                        PWA (React)                       │
│                                                          │
│  Plan         Simulate        Fly         History        │
│  ─────        ────────        ───         ───────        │
│  Leaflet      Step through    WebSocket   Per-plant      │
│  map +        waypoints,      live feed   health trend   │
│  GPS tap      phone camera    from drone  over time      │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   FastAPI (async)                        │
│                                                          │
│  /api/missions    /api/drone          /api/scans         │
│  Yard + mission   WebSocket fly       Simulate upload    │
│  CRUD             Tello control       Plant history      │
└──────────┬──────────────────┬────────────────────────────┘
           │                  │
    ┌──────▼──────┐   ┌───────▼────────┐
    │ PostgreSQL  │   │  Kindwise API  │
    │ Missions    │   │  Plant health  │
    │ Waypoints   │   │  Disease names │
    │ PlantScans  │   │  Confidence %  │
    └─────────────┘   └────────────────┘
```

**Two execution modes — same data model:**
- **Drone mode** — connects to a DJI Tello over WiFi, executes GPS waypoints as relative moves (Haversine formula), captures photos via the drone's camera, analyses and stores results — all streamed live to the browser over WebSocket
- **Simulation mode** — steps through waypoints one at a time, captures each photo using the phone's native camera (`capture="environment"`), uploads and analyses on the spot

---

## Technical Highlights

### GPS → Drone Movement (no GPS on Tello)
The Tello drone has no GPS, so GPS waypoints are converted to centimetre-level relative moves at runtime:

```python
def gps_to_relative_move(lat1, lon1, lat2, lon2) -> RelativeMove:
    distance_cm = haversine_distance_cm(lat1, lon1, lat2, lon2)
    bearing = bearing_degrees(lat1, lon1, lat2, lon2)
    x = distance_cm * math.sin(math.radians(bearing))   # east/west
    y = distance_cm * math.cos(math.radians(bearing))   # forward/back
    return RelativeMove(x=clamp(x, 20, 500), y=clamp(y, 20, 500))
```

### Live Flight Telemetry via WebSocket
The drone flight endpoint is a FastAPI WebSocket that streams status messages as the mission runs:

```python
@router.websocket("/fly/{mission_id}")
async def fly_mission(websocket: WebSocket, mission_id: int, ...):
    await websocket.accept()
    async def send_status(msg: str):
        await websocket.send_json({"type": "status", "message": msg})
    await run_mission(mission, db, on_status=send_status)
    await websocket.send_json({"type": "complete"})
```

The React client reconnects and renders each message in a live log feed. The abort button calls `ws.close()` — the backend catches the disconnect and attempts an emergency landing.

### Phone Camera Capture
The simulate mode uses the browser's media capture API for a one-tap photo experience on mobile:

```tsx
<input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleCapture} />
```

On iOS and Android this opens the camera directly. The selected file is uploaded as `multipart/form-data` to the backend which saves it to disk and passes it straight to Kindwise.

### Plant Health History
Plants are tracked by their **label** (e.g. "Rose Bush 1") across multiple missions within a yard. The history query joins through missions to group scans by plant name over time:

```python
select(PlantScan)
    .join(Waypoint).join(Mission)
    .where(Mission.yard_id == yard_id, Waypoint.label == label)
    .order_by(PlantScan.scanned_at.desc())
```

This lets you see whether a plant's condition improved or worsened between visits.

### Async Throughout
The entire backend is `async`/`await` — SQLAlchemy 2.0 with `asyncpg`, FastAPI's async request handlers, `httpx.AsyncClient` for the Kindwise API, and `asyncio.sleep` for drone movement settling. No thread pool blocking anywhere.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 | Async-native, typed, fast to iterate |
| Database | PostgreSQL 17 · asyncpg | Relational data, async driver |
| Frontend | React 19 · TypeScript · Vite 8 | Latest concurrent renderer, full type safety |
| Styling | Tailwind CSS v4 | Compile-time CSS, zero runtime |
| Maps | Leaflet.js | Lightweight, offline-capable tile maps |
| Data fetching | TanStack Query v5 | Smart caching, background refetch |
| Routing | React Router v7 | File-based + data router |
| Drone | djitellopy | Python SDK for DJI Tello UDP protocol |
| Plant API | Kindwise / plant.id v3 | Health assessment + disease detection |
| Infra | Docker · nginx | Multi-stage builds, reverse proxy + WS upgrade |

---

## Pages

| Page | What it does |
|---|---|
| **Plan** | Leaflet map centered on your GPS location. Tap "Mark Waypoint Here" to drop a numbered pin at your current position. Label each waypoint (plant name). Save the mission — redirects to Simulate. |
| **Simulate** | Step-through walk mode. Shows current waypoint on the map, prompts for a photo. Camera opens on mobile; photo uploads instantly and the Kindwise result appears inline before you move to the next waypoint. |
| **Fly** | Drone control panel. Connect to Tello, select a mission, launch. Live log streams over WebSocket — takeoff, each waypoint, photo capture, analysis result, landing. Abort button closes the socket and triggers emergency land. |
| **Results** | Per-mission scan grid. Health rate stats, photo thumbnails, plant name, health status, disease list, and confidence score per waypoint. |
| **Plant History** | Per-yard, per-plant health timeline. Select a yard, see every labeled plant and its latest health. Drill in to see the full photo history with health trend indicators. |

---

## Running

### Docker (one command)

```bash
cp .env.example .env        # add KINDWISE_API_KEY if you have one
docker compose up
```

Open **http://localhost** — schema is created automatically on first boot.

### Local Development

```bash
# PostgreSQL must be running
psql -U postgres -c "CREATE DATABASE droneyardscanner;"

cp .env.example .env

# Backend — must run from src/ so package imports resolve
cd src
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --port 8000

# Frontend — separate terminal
cd src/web
npm install
npm run dev
```

Frontend → **http://localhost:5173** · API → **http://localhost:8000** · Swagger → **http://localhost:8000/docs**

### Phone Access (no hosting required)

Cloudflare quick tunnels give you a public HTTPS URL that works anywhere — required for the camera API on mobile:

```bash
# Install once
winget install Cloudflare.cloudflared

# Run alongside the dev servers
cloudflared tunnel --url http://localhost:5174
```

Scan the printed QR or paste the `trycloudflare.com` URL into your phone.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/droneyardscanner` | Async PostgreSQL connection |
| `KINDWISE_API_KEY` | *(empty)* | From [plant.id](https://plant.id) — app runs in stub mode without it |

Without an API key, `health_status` returns `"unknown"` and disease detection is skipped. All other features work normally.

---

## Project Structure

```
DroneYardScanner/
├── src/
│   ├── backend/
│   │   ├── models/          # SQLAlchemy mapped models
│   │   │   ├── yard.py      # Yard (multi-property support)
│   │   │   └── mission.py   # Mission → Waypoint → PlantScan
│   │   ├── routers/
│   │   │   ├── yards.py     # GET/POST/DELETE /api/yards
│   │   │   ├── missions.py  # CRUD + yard filter
│   │   │   ├── drone.py     # Connect/status + WebSocket /fly/{id}
│   │   │   └── scans.py     # Results, simulate upload, plant history
│   │   ├── drone/
│   │   │   ├── tello_controller.py   # djitellopy async wrapper
│   │   │   └── mission_executor.py  # Takeoff → waypoints → land
│   │   ├── mission/
│   │   │   └── gps_converter.py     # Haversine GPS → cm moves
│   │   └── plant/
│   │       └── kindwise_client.py   # Plant.id v3 health assessment
│   └── web/
│       └── src/
│           ├── api/          # Axios client + TypeScript types
│           ├── contexts/     # YardContext (active yard, localStorage)
│           ├── components/   # Layout, yard selector
│           └── pages/        # Plan · Simulate · Fly · Results · History
├── docker-compose.yml        # db + api + web (nginx)
└── .env.example
```
