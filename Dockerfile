# Stage 1 — build the Wasel frontend (apps/web) into static files.
FROM node:20-alpine AS frontend-build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
COPY apps/web/ ./
# events.js#trackEvent() already defaults VITE_EVENTS_API_BASE_URL to
# http://localhost:8000 when the env var is unset — which is exactly where
# this merged app now serves both the UI and the API from, so no override
# needed here.
RUN npm run build

# Stage 2 — the API, now also serving the built frontend as static files.
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=frontend-build /web/dist ./apps/web/dist

ENV PYTHONPATH=/app
EXPOSE 8000

CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
