@echo off
REM Local Media Downloader -- one-command launcher (Windows)
cd /d "%~dp0"

if not exist ".venv" (
  echo Setting up virtual environment ^(first run only^)...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -q --upgrade pip
pip install -q -r requirements.txt

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo Note: ffmpeg was not found on PATH. It's recommended for merging
  echo video+audio and MP3 extraction. Download it from https://ffmpeg.org/download.html
)

python app.py
pause
