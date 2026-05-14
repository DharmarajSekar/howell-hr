FROM python:3.11-slim

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY bot.py .
COPY server.py .

EXPOSE 8080

# Run the HTTP server (which spawns bot.py subprocesses on demand)
CMD ["python", "server.py"]
