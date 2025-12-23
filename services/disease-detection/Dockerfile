# ============================================================================
# Fast Disease Detection Service - Lightweight Dockerfile
# Uses pattern matching instead of heavy ML models
# ============================================================================

FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install (very lightweight)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

ENV PYTHONUNBUFFERED=1

# Start service with 4 workers for concurrency
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "4"]
