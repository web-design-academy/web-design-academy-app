FROM node:22-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_APP_MODE=offline
ENV VITE_APP_MODE=$VITE_APP_MODE

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/visual-preview/package.json ./packages/visual-preview/
COPY packages/visual-editor/package.json ./packages/visual-editor/
COPY packages/ui-styles/package.json ./packages/ui-styles/

RUN pnpm --filter @wda/frontend... install --frozen-lockfile

COPY apps/frontend/ ./apps/frontend/
COPY packages/visual-preview/ ./packages/visual-preview/
COPY packages/visual-editor/ ./packages/visual-editor/
COPY packages/ui-styles/ ./packages/ui-styles/
RUN pnpm --filter @wda/frontend build

FROM node:22-alpine AS backend-deps

RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/visual-editor/package.json ./packages/visual-editor/
COPY packages/visual-preview/package.json ./packages/visual-preview/
COPY packages/ui-styles/package.json ./packages/ui-styles/

COPY apps/backend/src ./apps/backend/src
RUN pnpm --filter @wda/backend deploy --legacy --prod --frozen-lockfile /runtime

FROM node:22-alpine

WORKDIR /app

COPY --from=backend-deps /runtime/package.json ./package.json
COPY --from=backend-deps /runtime/node_modules ./node_modules
COPY --from=backend-deps /runtime/src ./src
RUN mkdir -p storage lessons

COPY --from=builder /app/apps/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
