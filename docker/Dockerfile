# filename: docker/Dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy requirements first for caching
COPY backend/requirements.txt /app/backend/requirements.txt

RUN python -m pip install --upgrade pip \
  && pip install -r /app/backend/requirements.txt \
  && pip install "uvicorn[standard]"

# Copy backend source
COPY backend /app/backend

WORKDIR /app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]