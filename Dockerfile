# --- frontend builder ---
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
RUN npm run build

# --- backend builder ---
FROM node:20-alpine AS backend-builder

WORKDIR /app

# better-sqlite3 needs build tools to compile its native binding
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache python3 make g++ tzdata

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && apk del python3 make g++

COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV EPG_SHARED_DIR=/app/epg-shared
ENV PORT=3000
ENV LOG_LEVEL=info

VOLUME ["/app/data", "/app/epg-shared"]
EXPOSE 3000

CMD ["node", "dist/index.js"]
