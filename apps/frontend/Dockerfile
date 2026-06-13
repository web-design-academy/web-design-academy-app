FROM node:22-alpine AS build

RUN npm install -g pnpm

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

ARG VITE_BASE_URL=/wda
ARG VITE_APP_MODE=online
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_APP_MODE=$VITE_APP_MODE
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN pnpm --filter web-design-academy build

FROM nginx:alpine
RUN apk upgrade --no-cache
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html/wda
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
