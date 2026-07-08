# TaskManager

Story 1.1 baseline implementation:

- Frontend: React + Vite + TypeScript
- Backend: ASP.NET Core Web API (.NET 9)
- Database: PostgreSQL with EF Core migration
- Containers: Docker Compose with 3 services (frontend, backend, postgres)
- Authentication: username/password login with BCrypt + JWT

## Project Structure

- frontend: Vite React app with login page, protected board route, token persistence, and logout flow.
- backend: clean-layer skeleton with Api/Application/Domain/Infrastructure.
- docker-compose.yml: local stack orchestration.

## Local Setup (Without Docker)

1. Copy env examples.
2. Start PostgreSQL on localhost:5432.
3. Build and run backend.
4. Build and run frontend.

### Environment Examples

- Root compose variables: .env.example
- Backend variables: backend/src/TaskManager.Api/.env.example
- Frontend variables: frontend/.env.example

## Backend Commands

Build backend:

```bash
dotnet build TaskManager.sln
```

Run migration:

```bash
dotnet tool run dotnet-ef database update \
	--project backend/src/TaskManager.Infrastructure/TaskManager.Infrastructure.csproj \
	--startup-project backend/src/TaskManager.Api/TaskManager.Api.csproj
```

Run API:

```bash
dotnet run --project backend/src/TaskManager.Api/TaskManager.Api.csproj
```

Default bootstrap credentials (dev only):

- username: admin
- password: Admin123!

## Frontend Commands

Install:

```bash
cd frontend
npm install --cache .npm-cache
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Docker Compose

Copy .env.example to .env and run:

```bash
docker compose up --build
```

Services:

- frontend: http://localhost:5173
- backend: http://localhost:8080
- postgres: localhost:5432

## Auth API Endpoints

- POST /api/v1/auth/login
- GET /api/v1/auth/me (Bearer token required)
- GET /api/v1/board (Bearer token required)

Responses follow envelopes:

- Success: { data, meta }
- Error: { error, meta }

## Smoke Checks

Run the auth smoke script:

```bash
bash scripts/smoke-auth.sh
```

What it validates:

- login success returns JWT
- invalid login fails safely
- token can be reused against protected endpoint
- logout behavior is implemented in frontend (token cleared from localStorage)
