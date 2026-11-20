# ---- build the React frontend ----
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json frontend/
RUN npm ci --prefix frontend
COPY frontend frontend
RUN npm run build --prefix frontend

# ---- runtime: Express serves the API and the built frontend on one port ----
FROM node:22-alpine
ENV NODE_ENV=production \
    DB_PATH=/data/leads.db \
    TRUST_PROXY=1
WORKDIR /app
COPY backend/package*.json backend/
RUN npm ci --omit=dev --prefix backend
COPY backend backend
COPY --from=build /app/frontend/dist frontend/dist

# The database lives on a volume so it survives restarts and redeploys
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME /data
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://localhost:${PORT:-5000}/api/health || exit 1
CMD ["node", "backend/src/server.js"]
