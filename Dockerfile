# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y git --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN git rev-parse --short HEAD > COMMIT 2>/dev/null || echo "unknown" > COMMIT

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-slim

# Install Chromium + Thai font dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-thai-tlwg \
    fontconfig \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/COMMIT ./COMMIT

EXPOSE 3000
CMD ["node", "dist/main.js"]
