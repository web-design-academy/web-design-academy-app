FROM node:22-alpine AS deps

RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

WORKDIR /app

COPY package.json ./
RUN printf 'allowBuilds:\n  better-sqlite3: true\n' > pnpm-workspace.yaml
RUN pnpm install --prod

FROM node:22-alpine

WORKDIR /app

RUN mkdir -p storage lessons

COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
