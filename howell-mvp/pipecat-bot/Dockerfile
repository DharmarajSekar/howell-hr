FROM python:3.11-slim

WORKDIR /app

# System dependencies for audio processing (required by Silero VAD + pipecat)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    libgomp1 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY bot.py .
COPY server.py .

EXPOSE 8080

# Default: run the HTTP server (which spawns bot.py subprocesses)
CMD ["python", "server.py"]
