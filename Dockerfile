FROM alpine/git:latest AS repo

ARG RAILWAY_GIT_REPO_URL

ARG RAILWAY_GIT_BRANCH=main

WORKDIR /repo

RUN if [ -n "$RAILWAY_GIT_REPO_URL" ]; then \
      git clone --depth=1 --single-branch --branch ${RAILWAY_GIT_BRANCH} ${RAILWAY_GIT_REPO_URL} .; \
    else \
      git clone --depth=1 https://github.com/web-design-academy/web-design-academy-app.git .; \
    fi
RUN git submodule update --init --depth=1

FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_APP_MODE=offline
ENV VITE_APP_MODE=$VITE_APP_MODE

COPY --from=repo /repo/Web-Visual-Editor/VisualEditor ./Web-Visual-Editor/VisualEditor

WORKDIR /app/frontend

COPY --from=repo /repo/frontend/package*.json ./
RUN npm ci

COPY --from=repo /repo/frontend/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p storage

COPY --from=repo /repo/backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=repo /repo/backend/src ./src

COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
