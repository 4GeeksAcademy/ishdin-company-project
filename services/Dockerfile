FROM python:3.12-slim

# Python/Docker development settings
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Tell uv to install into the container's system Python
ENV UV_SYSTEM_PYTHON=1

# Support both import styles currently used by the TrackFlow backend:
#   from auth...
#   from services.api...
ENV PYTHONPATH=/app:/app/services/api

WORKDIR /app

# Install uv as required by the assignment
RUN pip install --no-cache-dir uv

# Copy requirements first so Docker can cache dependency installation
COPY api/requirements.txt /tmp/requirements.txt

# Install FastAPI/backend dependencies using uv
RUN uv pip install -r /tmp/requirements.txt

# Preserve the existing monorepo services structure inside the container
COPY . ./services

EXPOSE 8000

CMD [
  "uvicorn",
  "services.api.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
  "--reload"
]