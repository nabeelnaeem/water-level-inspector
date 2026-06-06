# Multi-stage build for the Water Level Inspector backend.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 needs build tools to compile its native addon.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Persisted SQLite data lives here (mount a volume).
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/water.db
EXPOSE 4000
CMD ["node", "dist/server.js"]
