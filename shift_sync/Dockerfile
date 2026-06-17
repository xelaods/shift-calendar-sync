FROM python:3.11-slim

# Chrome / Chromium のインストール（スクレイピング用）
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-noto-cjk \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存関係をインストール
COPY requirements.txt requirements.txt
COPY api/requirements_api.txt api/requirements_api.txt
RUN pip install --no-cache-dir -r requirements.txt -r api/requirements_api.txt

# アプリケーションをコピー
COPY . .

# 環境変数
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Render の永続ディスクマウント先にDBを置く
# DATABASE_URL 環境変数で上書き可能（デフォルト: /data/shiftsync.db）
ENV DATABASE_URL=sqlite:////data/shiftsync.db

# データディレクトリ（ローカル実行時のフォールバック）
RUN mkdir -p /data

EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# FastAPI サーバー起動
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
