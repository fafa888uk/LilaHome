FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py db.py errors.py auth.py ./
COPY services/ ./services/
COPY integrations/ ./integrations/
COPY routers/ ./routers/

# 复制进来的文件可能是 660 且属 root; 运行时用户 appuser 须能读。
# 全部改为 world-readable, 否则 import 时 Permission denied。
RUN chmod -R a+rX /app

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
