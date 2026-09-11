FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y default-libmysqlclient-dev gcc pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

# WEB_CONCURRENCY controla el número de workers (default 2).
# No usar --reload con múltiples workers.
ENTRYPOINT ["./entrypoint.sh"]
