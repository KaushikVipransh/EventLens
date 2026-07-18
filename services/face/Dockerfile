FROM python:3.10-slim

# Build toolchain (insightface compiles native extensions) + opencv runtime libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# numpy + Cython first so insightface's source build can find them.
COPY requirements.txt .
RUN pip install --no-cache-dir "numpy==1.26.4" "cython==3.0.11" \
    && pip install --no-cache-dir -r requirements.txt

COPY app.py .

# The buffalo_l model (~300MB) downloads on first startup into /root/.insightface.
# Persist it with a named volume (see docker-compose) so restarts are fast.

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
