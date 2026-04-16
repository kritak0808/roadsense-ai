FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV + PyTorch
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p weights uploads logs

EXPOSE 5000

# Use threading worker — compatible with Flask-SocketIO threading mode
CMD ["gunicorn", "--worker-class", "gthread", "--workers", "1", "--threads", "4", \
     "--bind", "0.0.0.0:5000", "--timeout", "180", "--keep-alive", "5", "app:app"]
