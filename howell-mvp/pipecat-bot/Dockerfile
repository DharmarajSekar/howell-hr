FROM python:3.11-slim

WORKDIR /app

# Install system deps: ffmpeg for MP3→PCM conversion (used by edge-tts)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY bot.py .
COPY server.py .

EXPOSE 8080

# Run the HTTP server (which spawns bot.py subprocesses on demand)
CMD ["python", "server.py"]
