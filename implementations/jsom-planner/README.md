# JSOM Degree Planner

Full-stack web app for UTD JSOM graduate students to plan degrees and for admins to manage requirements.

---

## Prerequisites

- **Docker Desktop** — https://www.docker.com/products/docker-desktop

Verify: `docker --version` and `docker compose version`

---

## Quick Start

```bash
cd jsom-planner
docker compose up --build
```

First build: ~3–5 minutes. App at http://localhost:3000

### Demo Accounts

| Role    | Email                     | Password    |
|---------|---------------------------|-------------|
| Admin   | admin@utdallas.edu        | password123 |
| Student | demo.student@utdallas.edu | password123 |

### Stop
```bash
docker compose down          # keeps data
docker compose down -v       # full reset
```

---

## Optional: Nebula API Key

Enables live course sections and grade distributions.

1. Join UTD Nebula Labs Discord (search "UTD Nebula Labs")
2. Request API key
3. `echo "NEBULA_API_KEY=your_key" > .env`
4. `docker compose restart backend`

---

## Development (hot reload)

```bash
# Terminal 1: Database
docker compose up postgres

# Terminal 2: Backend
cd backend && npm install
DATABASE_URL=postgresql://postgres:password@localhost:5432/jsom_planner JWT_SECRET=dev-secret FRONTEND_URL=http://localhost:3000 node src/server.js

# Terminal 3: Frontend (http://localhost:5173)
cd frontend && npm install --legacy-peer-deps && npm run dev
```

---

## Seed Full Catalog (XLSX)

```bash
pip install psycopg2-binary openpyxl
cd scripts
DATABASE_URL=postgresql://postgres:password@localhost:5432/jsom_planner python3 seed_database.py
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Rollup build error | `docker compose down -v && docker system prune -f && docker compose up --build` |
| Port in use | Change ports in `docker-compose.yml` or kill conflicting process |
| Blank page | Check `docker compose ps` — all 3 services must show `Up` |
| DB connection refused | `docker compose logs postgres` |

---

## API Quick Reference

- `POST /api/auth/login` — Login
- `GET /api/students/dashboard` — Degree progress
- `POST /api/students/courses` — Add course (checks prereqs)
- `GET /api/students/eligible-courses` — What student can take next
- `GET /api/programs` — List all programs
- `GET /api/admin/stats` — Admin overview
- `GET /api/admin/graph/stats` — Knowledge graph analysis
