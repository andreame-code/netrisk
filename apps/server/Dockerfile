# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY .eslintrc.js .prettierrc .editorconfig ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter @netrisk/core --filter @netrisk/server
RUN pnpm --filter @netrisk/server prisma:generate

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY package.json ./package.json
COPY pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY apps/server/package.json ./apps/server/package.json
EXPOSE 3000
CMD ["pnpm", "--filter", "@netrisk/server", "start:prod"]
