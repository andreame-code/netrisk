# netrisk monorepo

A full-stack workspace for the netrisk strategy platform. The repository is organised as a PNPM workspace with Turborepo to coordinate builds between the Next.js client, NestJS server, and shared TypeScript domain package.

## Getting started

- **GitHub Codespaces**: Follow the zero-install workflow in [README_Codespaces.md](README_Codespaces.md) to spin up a cloud development environment with the client and server already bootstrapped.
- **Local development**: Install the prerequisites below and run the installation steps on your machine.

## Project structure

```
apps/
  client/   # Next.js 15 + TypeScript frontend with Tailwind, Jest, and Playwright
  server/   # NestJS 11 backend with Socket.IO, Prisma, class-validator, and Jest
packages/
  core/     # Shared game rules, DTOs, and validation schemas (Zod)
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [PNPM](https://pnpm.io/) (the repository pins version via `packageManager`)

## Installation

```bash
pnpm install
```

This installs dependencies for all workspaces and configures Husky Git hooks.

## Common scripts

Use Turborepo to orchestrate commands across packages:

```bash
pnpm dev           # Run client and server in parallel
pnpm build         # Build all workspaces
pnpm lint          # Lint using each package's configuration
pnpm test          # Run unit/integration tests (Jest, Vitest)
pnpm format        # Check formatting with Prettier
```

You can target an individual workspace with PNPM filters, for example `pnpm --filter @netrisk/client test`.

## Testing

Before running server or end-to-end tests on a fresh clone, build the shared core package so its compiled output is available to other workspaces:

```bash
pnpm --filter @netrisk/core build
```

Then execute the individual test suites as needed:

- **Client**: `pnpm --filter @netrisk/client test` (Jest) and `pnpm --filter @netrisk/client test:e2e` (Playwright)
- **Server**: `pnpm --filter @netrisk/server test` for unit tests and `pnpm --filter @netrisk/server test:e2e` for API tests
- **Shared core**: `pnpm --filter @netrisk/core test`

## Database & Prisma

The NestJS app uses Prisma with PostgreSQL. Define the `DATABASE_URL` environment variable (e.g. `postgresql://netrisk:netrisk@localhost:5432/netrisk`) before running `pnpm --filter @netrisk/server prisma:migrate` or starting the server in production.

## Docker

Dockerfiles are available for the client and server, plus a `docker-compose.yml` to run the full stack locally:

```bash
docker compose up --build
```

The compose stack exposes:

- Client on http://localhost:3000
- Server on http://localhost:3001
- PostgreSQL on port 5432 (user/password: `netrisk` / `netrisk`)

## Binary assets

This repository omits binary files so the history stays lean. Provide the following assets locally before shipping to
production environments:

- `apps/client/public/favicon.ico` – 32×32 (or larger) favicon referenced by the Next.js app router.
- `apps/client/public/icon-192.png` – Web app manifest icon for installable experiences.
- `apps/client/public/icon-512.png` – Larger manifest icon used on high-resolution devices.
- `apps/client/public/og-image.png` – Open Graph/Twitter card preview shared from marketing pages.

Feel free to swap in your own branding, but keep the filenames and dimensions consistent with the values listed above
so the default configuration continues to work without additional changes.

## Tooling

- **Linting**: Shared `.eslintrc.js` plus package-specific configurations
- **Formatting**: Prettier with `.prettierrc`
- **TypeScript**: Root `tsconfig.base.json` with path aliases for `@netrisk/core`
- **Git hooks**: Husky + lint-staged run formatting and linting on each commit

## Contributing

1. Create a feature branch
2. Run the relevant lint/test commands locally
3. Commit with the Husky pre-commit checks passing
4. Open a pull request summarising your changes and testing steps
