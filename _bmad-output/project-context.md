# Project Context

## Project Name

Task Manager

## Project Vision

Build a modern web-based task management application that can be self-hosted using Docker and accessed from any web browser.

The initial focus is a lightweight personal productivity tool, with the possibility of evolving into a multi-user collaborative platform.

---

# Business Context

## Problem Statement

Users need a simple and reliable way to manage personal tasks, priorities, deadlines, and productivity workflows without relying on third-party SaaS providers.

The application should be easy to deploy, maintain, and migrate across hosting providers.

## Target Users

### Primary User

- Individual user managing personal tasks and projects.

### Future Users

- Small teams
- Collaborative workspaces
- Multi-user organizations

---

# Product Goals

## MVP Goals

- Manage personal tasks efficiently
- Access the application through a browser
- Self-host using Docker
- Maintain a clean and responsive user interface
- Support future feature expansion

## Long-Term Goals

- Kanban workflows
- Team collaboration
- Notifications and reminders
- Analytics and productivity metrics
- Mobile application support

---

# Technical Stack

## Frontend

- React + Vite + Typescript

### Framework

- React

### Language

- TypeScript

### Build Tool

- Vite

### Styling

- Tailwind CSS

### Responsibilities

- User interface
- Forms and validation
- Task management screens
- Search and filtering
- Future Kanban board implementation
- API integration

---

## Backend

### Framework

- ASP.NET Core Web API (.NET 10 or latest LTS)

### Language

- C#

### Architecture Style

- REST API
- Clean Architecture
- Domain-Driven Design principles where appropriate

### Layers

- API
- Application
- Domain
- Infrastructure

### Data Access

Primary:

- Entity Framework Core

Optional Future Optimization:

- Dapper for performance-critical queries

---

## Database

### Engine

- PostgreSQL

### Rationale

- Open source
- Reliable
- Excellent .NET support
- Docker-friendly
- Easy migration and backup strategy

---

# System Architecture

```text
Browser
    │
    ▼
React Frontend
    │
    ▼
ASP.NET Core API
    │
    ▼
PostgreSQL
```

---

# Containerization Strategy

## Docker

The entire application must be deployable using Docker.

## Docker Compose Services

### app

Contains:

- ASP.NET Core API
- Compiled React frontend assets

### postgres

Contains:

- PostgreSQL database

### Architecture

.NET 10 Minimal API + EF Core + PostgreSQL, contenedorizado con Docker Compose, frontend en React + Vite + TS, Playwright para E2E y xUnit + Testcontainers para integración, CI/CD en GitHub Actions, desplegado en Render (back+db) + Vercel (front).

```text
docker-compose

├── app
│   ├── ASP.NET Core
│   └── React Build
│
└── postgres
```

---

# Hosting Strategy

## Preferred Option

Linux VPS

Potential providers:

- Backend + DB:
  - Render
  - Railway
  - Fly.io
- Frontend:
  - Vercel
- CI/CD
  - Github actions
- Containers
  - Github container registry

# Development Workflow

## Frontend Development

```bash
npm run dev
```

## Backend Development

```bash
dotnet run
```

## Full Environment

```bash
docker compose up -d
```

---

# Authentication Strategy

## MVP

- JWT Authentication
- Single-user support

## Future

- ASP.NET Identity
- Keycloak integration
- OAuth providers (Google, GitHub, Microsoft)

---

# MVP Functional Requirements

## Task Management

Users can:

- Create tasks
- Update tasks
- Delete tasks
- Mark tasks as completed

### Task Fields

- Title
- Description
- Priority
- Due Date
- Completion Status
- Created Date
- Updated Date

---

## Organization Features

### Priorities

- Low
- Medium
- High

### Tags

- Custom labels

### Search

- Full-text task search

### Filtering

Filter by:

- Status
- Priority
- Due Date
- Tags

### Sorting

Sort by:

- Creation date
- Due date
- Priority
- Status

---

# Future Features

## Phase 2

### Kanban Board

- Drag and drop
- Multiple columns
- Workflow customization

### Recurring Tasks

- Daily
- Weekly
- Monthly

### Attachments

- File uploads
- Document management

### Notifications

- Email reminders
- Upcoming deadline alerts

### Dashboard

- Productivity statistics
- Task completion trends

---

## Phase 3

### Multi-User Support

- User accounts
- Shared workspaces
- Team collaboration

### Mobile Applications

- iOS
- Android

### Real-Time Features

- Live updates
- SignalR integration
- Push notifications

---

# Testing Strategy

## Backend Unit Testing

### Tools

- xUnit
- Moq

### Scope

- Domain logic
- Application services
- Business rules
- Validators

---

## Backend Integration Testing

### Tools

- xUnit
- Testcontainers for .NET

### Scope

- Repository testing
- Database integration
- API integration

### Requirements

Use real PostgreSQL containers during test execution.

---

## Frontend Unit Testing

### Tools

- Vitest
- React Testing Library

### Scope

- Components
- Hooks
- Utilities
- User interactions

---

## End-to-End Testing

### Tool

- Playwright

### Scope

- Authentication
- Task creation
- Task editing
- Task completion
- Search
- Filtering

### Browsers

- Chromium
- Firefox
- WebKit

---

# CI/CD Strategy

## Platform

GitHub Actions

## Pipeline

1. Build Frontend
2. Build Backend
3. Run Unit Tests
4. Run Integration Tests
5. Run Playwright Tests
6. Build Docker Images
7. Deploy

---

# Non-Functional Requirements

## Performance

- Fast page load times
- API response times below 500ms for standard operations

## Reliability

- Docker-based deployments
- Persistent PostgreSQL storage volumes
- Automated backups

## Maintainability

- Strong typing with TypeScript
- Clean Architecture principles
- Automated testing coverage
- Clear separation of concerns

## Security

- JWT authentication
- HTTPS in production
- Secure secret management
- Environment-based configuration

## Scalability

The architecture should support future growth without requiring major redesign.

---

# Suggested Repository Structure

```text
task-manager/

├── frontend/
│   ├── src/
│   ├── tests/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── backend/
│   ├── TaskManager.Api/
│   ├── TaskManager.Application/
│   ├── TaskManager.Domain/
│   ├── TaskManager.Infrastructure/
│   └── TaskManager.Tests/
│
├── docker/
│
├── docs/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
│
└── README.md
```

---

# Technology Decisions Summary

| Area                 | Technology              |
| -------------------- | ----------------------- |
| Frontend             | React                   |
| Frontend Language    | TypeScript              |
| Frontend Build Tool  | Vite                    |
| Styling              | Tailwind CSS            |
| Backend              | ASP.NET Core Web API    |
| Backend Language     | C#                      |
| Architecture         | Clean Architecture      |
| ORM                  | Entity Framework Core   |
| Database             | PostgreSQL              |
| Containerization     | Docker                  |
| Orchestration        | Docker Compose          |
| Backend Unit Testing | xUnit                   |
| Mocking              | Moq                     |
| Integration Testing  | Testcontainers for .NET |
| Frontend Testing     | Vitest                  |
| Component Testing    | React Testing Library   |
| End-to-End Testing   | Playwright              |
| CI/CD                | GitHub Actions          |
| Hosting              | Linux VPS               |

---

# Success Criteria

The MVP will be considered successful when:

- Users can create, update, complete, and delete tasks.
- Users can organize tasks through priorities, tags, and filters.
- The application is fully deployable through Docker Compose.
- The application is accessible through a standard web browser.
- Automated unit, integration, and end-to-end tests are implemented.
- Deployment to a Linux VPS can be completed with minimal configuration.
- The architecture supports future expansion without significant refactoring.
