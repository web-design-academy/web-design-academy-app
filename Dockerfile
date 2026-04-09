FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_APP_MODE=offline
ENV VITE_APP_MODE=$VITE_APP_MODE

COPY Web-Visual-Editor/VisualEditor ./Web-Visual-Editor/VisualEditor

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
