# Local Media Downloader

Download YouTube videos, Instagram Reels, and Facebook Reels — paste a single
link or feed it a bulk list — through a local web app. Everything runs on
your own machine; nothing is uploaded anywhere. Built on
[yt-dlp](https://github.com/yt-dlp/yt-dlp) with a Flask backend and a small
UI for progress tracking and a downloads library.

## Features

- **Single link** or **bulk links** (paste multiple, one per line, or load a `.txt` file)
- Live per-item progress bars, speed, and ETA
- Quality picker: best available, 1080p/720p/480p caps, or audio-only MP3
- Optional "cookies from browser" for private/login-gated reels
- Downloads library with an "Open folder" shortcut
- Cancel an in-progress batch at any time

## 1. Requirements

- Python 3.9+
- [ffmpeg](https://ffmpeg.org/download.html) (recommended, not required) — needed to merge
  separate video+audio streams into one file and to extract MP3 audio. Without it the
  app still works but falls back to single-file formats.

## 2. Run it

**macOS / Linux**

```bash
./run.sh
```

**Windows**

```bat
run.bat
```

Either script creates a virtual environment on first run, installs
dependencies, and starts the app. Your browser opens automatically at
`http://127.0.0.1:8765`.

To run manually instead:

```bash
python3 -m venv .venv
source .venv/bin/activate   # .venv\Scripts\activate on Windows
pip install -r requirements.txt
python app.py
```

## 3. Using the app

- **Single Link tab** — paste one URL and click Download.
- **Bulk Links tab** — paste multiple links (one per line, `#` lines are
  ignored) and/or drop in a `.txt` file of links, then click Download.
  Each line can be a bare link, or `filename : link` (also accepts `-` or
  `|` as the separator) to control the saved file name instead of using
  the video's own title, e.g.:
  ```
  https://www.youtube.com/watch?v=...
  vacation clip : https://www.instagram.com/reel/...
  funny moment - https://www.facebook.com/reel/...
  ```
- Set the **Quality** and **Save to folder** options before starting — they
  apply to the whole batch.
- Watch progress per item in the **Downloads** panel; cancel anytime.
- Browse everything you've downloaded in the **Library** panel, and use
  **Open folder** to jump straight to the files in your OS file manager.

## Notes on Instagram / Facebook

Public reels usually download without any extra setup. For private or
login-gated content, pick your browser under **Cookies from browser** so
yt-dlp can reuse your existing logged-in session cookies — no passwords are
entered into this app.

Instagram and Facebook change frequently; if downloads suddenly start
failing, update yt-dlp:

```bash
pip install --upgrade yt-dlp
```

## Project layout

```
app.py                 Flask backend (job queue, yt-dlp integration)
templates/index.html   App shell
static/css/style.css   UI styling
static/js/app.js       Frontend logic (polling, rendering, uploads)
downloads/              Default output folder
run.sh / run.bat        One-command launchers
```
