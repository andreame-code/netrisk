# GitHub Codespaces guide

This document explains how to work on the netrisk monorepo entirely inside GitHub Codespaces—from spinning up the container to exposing the running services publicly.

## Zero-install workspace

The repository ships a ready-to-use devcontainer that provisions a Node.js 20 environment for you. When the codespace boots it uses the [`mcr.microsoft.com/devcontainers/javascript-node:20` image](.devcontainer/devcontainer.json) and runs the [`start-dev.sh` bootstrap script](.devcontainer/start-dev.sh). That script enables Corepack, activates the workspace-pinned `pnpm@10.5.2`, and installs all dependencies with `pnpm install`. No local tooling is required beyond a GitHub account with Codespaces access.

## Launching a Codespace

1. Navigate to the repository on GitHub and click the green **Code** button.
2. Open the **Codespaces** tab and choose **Create codespace on &lt;branch&gt;** (pick the branch you want to work from).
3. Accept the default machine type unless you know you need more resources, then wait for the devcontainer to build and run the post-create commands.

## First boot and dev servers

Once the container finishes bootstrapping, open a terminal inside VS Code for the Web or the Codespaces desktop connection. The dependencies are already installed, so you can immediately start the full stack:

```bash
pnpm dev
```

The Turborepo `dev` pipeline launches the Next.js client (`pnpm --filter @netrisk/client dev`) and the NestJS API (`pnpm --filter @netrisk/server dev`) in parallel. By default the client serves on port 3000 and the server listens on port 3000 unless you override `PORT` (e.g., `PORT=3001 pnpm --filter @netrisk/server dev`). The Docker Compose configuration exposes the client on port 3000 and the server on port 3001 in production builds, which are the same ports you will typically forward from Codespaces.

## Accessing forwarded URLs

After `pnpm dev` starts, open the **Ports** panel in the Codespaces interface. Codespaces detects active listeners and forwards them automatically. Mark the client port (3000) and server port (3001 if you moved the API off 3000) as **Public** to receive shareable URLs in the form `https://<codespace-name>-3000.app.github.dev`.

## CORS and `NEXT_PUBLIC_API_BASE`

The NestJS application configures CORS to allow any `.github.dev` origin alongside the optional `CLIENT_URL` and `API_URL` environment variables, and it applies the same policy to Socket.IO connections so that Codespaces URLs work out of the box. When the client and server run on different forwarded hosts or ports, export `NEXT_PUBLIC_API_BASE` for the Next.js app and point it at the publicly forwarded API URL (for example, `https://<codespace-name>-3001.app.github.dev`). Keeping `CLIENT_URL` and `API_URL` in sync with those public addresses ensures REST and WebSocket calls respect the CORS allowlist.
