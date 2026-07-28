# =============================================================================
# Dockerfile — Kytos frontend (React + Vite)
# =============================================================================

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite bakes env vars into the bundle at build time. Left empty by default so
# the app calls relative /api/... paths — the reverse-proxy Nginx in front of
# this container routes those to the backend, same as the local Vite dev
# proxy does. Override with --build-arg if the frontend needs to call a
# different origin directly.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ || exit 1
