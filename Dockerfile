FROM alpine/git:latest AS visual_editor_submodule
ARG GITHUB_TOKEN
WORKDIR /visual-editor
RUN git clone --depth=1 https://x-access-token:${GITHUB_TOKEN}@github.com/web-design-academy/Web-Visual-Editor.git .

FROM alpine/git:latest AS css_analyzer_submodule
ARG GITHUB_TOKEN
WORKDIR /css-analyzer
RUN git clone --depth=1 https://x-access-token:${GITHUB_TOKEN}@github.com/web-design-academy/css-analyzer.git .

FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_APP_MODE=offline
ENV VITE_APP_MODE=$VITE_APP_MODE

COPY --from=visual_editor_submodule /visual-editor/VisualEditor ./Web-Visual-Editor/VisualEditor
COPY --from=css_analyzer_submodule /css-analyzer ./css-analyzer

WORKDIR /app/Web-Visual-Editor/VisualEditor
RUN npm ci

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p storage

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src

COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
