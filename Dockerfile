FROM node:20-slim

# Install Chromium + Thai font dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-thai-tlwg \
    fontconfig \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Bai Jamjuree fonts are embedded as base64 in templates — no system install needed
# fonts-thai-tlwg provides fallback Thai rendering for edge cases

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
