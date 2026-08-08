FROM python:3.11-alpine AS builder
WORKDIR /app

RUN apk add --no-cache gcc musl-dev libffi-dev
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-alpine AS runner
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY scraper.py ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

CMD ["python", "scraper.py"]