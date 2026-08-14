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
COPY packages/visual-editor/VisualEditor/package.json ./packages/visual-editor/VisualEditor/

RUN pnpm install --frozen-lockfile

COPY apps/frontend/ ./apps/frontend/
COPY packages/visual-preview/ ./packages/visual-preview/
COPY packages/visual-editor/VisualEditor/ ./packages/visual-editor/VisualEditor/
RUN pnpm --filter web-design-academy build

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p storage

COPY apps/backend/package.json ./
RUN npm install --omit=dev

COPY apps/backend/src ./src

COPY --from=builder /app/apps/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
