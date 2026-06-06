# You-Air ✈

A real-time 3D flight tracker that lets you explore live air traffic across the globe. Click any country or region to see active flights, track individual aircraft, and watch their projected flight paths.

![You-Air Screenshot](https://via.placeholder.com/800x450?text=You-Air+Flight+Tracker)

---

## Features

- **3D Globe** — Atmospheric globe rendered with MapLibre GL, navigate by dragging and scrolling
- **Live Flight Data** — Aircraft positions fetched from the OpenSky Network API, refreshed every 60 seconds
- **Click to Explore** — Click a country to load its airspace; drill into states/regions for a closer view
- **Track Any Aircraft** — Click an aircraft to fly the camera to it and follow it in real time with dead-reckoning animation at 60fps
- **Flight Path Overlay** — Yellow trail shows where the plane has been; red line shows the projected route 90 minutes ahead
- **Airport Markers** — Major international airports rendered as dots on the map
- **Layer Controls** — Toggle aircraft, airports, flight trails, and traffic density independently
- **Altitude Colouring** — Aircraft dots are coloured by altitude: sky blue (low) → orange → amber (cruise)

---

## Tech Stack

### Frontend
| Library | Version | Purpose |
|---|---|---|
| Angular | 20 | App framework, standalone components, signals |
| MapLibre GL | 4.5 | Base map + globe projection |
| Deck.gl | 9 | GPU-accelerated data layers (ScatterplotLayer, PathLayer, TextLayer) |
| RxJS | 7.8 | HTTP polling with `interval` + `switchMap` |

### Backend
| Library | Purpose |
|---|---|
| Express | REST API server |
| Axios | OpenSky Network HTTP client |
| Helmet + CORS | Security headers |
| express-rate-limit | API rate limiting |
| node-cache | Two-tier response cache (30s hot / 5min stale) |

### External APIs
- **OpenSky Network** — Live ADS-B flight state vectors (OAuth2 client credentials)

---

## Project Structure

```
You-Air/
├── frontend/                  # Angular 20 app
│   ├── src/app/
│   │   ├── components/
│   │   │   ├── viewer/        # MapLibre + Deck.gl map (main canvas)
│   │   │   ├── sidebar/       # Country / region / aircraft list
│   │   │   ├── aircraft-card/ # Selected aircraft info card
│   │   │   ├── stats-bar/     # Top navigation bar
│   │   │   ├── search/        # Search box
│   │   │   └── layer-controls/# Layer toggle switches
│   │   ├── services/
│   │   │   ├── flight.service.ts          # API polling + aircraft signals
│   │   │   ├── aircraft-animator.service.ts # 60fps dead-reckoning
│   │   │   ├── app-state.service.ts       # Global UI state (signals)
│   │   │   ├── geocoding.service.ts       # Country click → region name
│   │   │   └── config.service.ts          # Backend health check on load
│   │   └── models/
│   │       └── aircraft.model.ts          # Shared TypeScript interfaces
│   └── public/
│       └── airplane-icon.svg
│
├── backend/                   # Express API server
│   └── src/
│       ├── routes/
│       │   ├── flights.ts     # /api/flights/* endpoints
│       │   └── airports.ts    # /api/airports endpoint
│       └── services/
│           ├── opensky.service.ts  # OpenSky OAuth2 + caching
│           ├── airports.service.ts # Curated airport dataset
│           └── cache.service.ts    # node-cache wrapper
│
├── docker-compose.yml
├── railway.toml
└── .env.example
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- An [OpenSky Network](https://opensky-network.org) account with an API client (free)

### 1. Clone the repo
```bash
git clone https://github.com/your-username/you-air.git
cd you-air
```

### 2. Configure the backend
```bash
cp .env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=3000
FRONTEND_URL=http://localhost:4200
OPENSKY_CLIENT_ID=your-email@example.com-api-client
OPENSKY_CLIENT_SECRET=your_client_secret
```

To get OpenSky credentials: log in at opensky-network.org → Account → API Clients → Create client.

### 3. Start the backend
```bash
cd backend
npm install
npm run dev
```

### 4. Start the frontend
```bash
cd frontend
npm install
ng serve
```

Open [http://localhost:4200](http://localhost:4200).

---

## How It Works

1. **On load** — the globe appears and major airports are fetched once from the backend
2. **Click a country** — the map flies to that country's bounding box and starts polling OpenSky every 60 seconds for aircraft in that region
3. **Click an aircraft** (on the map or in the sidebar) — the camera locks onto it; dead-reckoning moves the dot smoothly between API updates
4. **Projected path** — a 90-minute great-circle arc is computed from current position, heading, and speed

### API Credit Conservation
Aircraft data is only fetched for the **selected region's bounding box**, not globally. This costs 1–3 OpenSky credits per call instead of 4, and no calls are made until a country is selected.

### Two-Tier Cache
The backend caches each bounding-box response for **30 seconds** (hot) and keeps a **5-minute stale copy** as a fallback if OpenSky rate-limits the next request.

---

## Deployment

The app is configured for [Railway](https://railway.app) via `railway.toml`. Deploy frontend and backend as two separate services.

Set the following environment variables in Railway:
- `OPENSKY_CLIENT_ID`
- `OPENSKY_CLIENT_SECRET`
- `FRONTEND_URL` (your deployed frontend URL, for CORS)

---

## License

MIT
