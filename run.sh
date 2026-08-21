#!/usr/bin/env bash
# Local Media Downloader — one-command launcher (macOS / Linux)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -d ".venv" ]; then
  echo "Setting up virtual environment (first run only)..."
  python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Note: ffmpeg is not installed. It's recommended for merging video+audio"
  echo "and MP3 extraction. Install it with 'brew install ffmpeg' (macOS) or"
  echo "'sudo apt install ffmpeg' (Linux) for the best experience."
fi

python app.py
