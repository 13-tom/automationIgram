"""
Local media downloader — Flask backend.

Wraps yt-dlp to download YouTube videos / Instagram reels / Facebook reels
(and anything else yt-dlp supports) from a single link or a bulk list of
links, with live progress reporting to the browser UI.

Run with:  python app.py
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from flask import Flask, jsonify, request, send_from_directory
import yt_dlp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, "downloads")
os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)

app = Flask(__name__, static_folder="static", template_folder="templates")

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=3)

URL_RE = re.compile(r"^https?://", re.IGNORECASE)


class Cancelled(Exception):
    pass


def detect_platform(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if "youtube" in host or "youtu.be" in host:
        return "youtube"
    if "instagram" in host:
        return "instagram"
    if "facebook" in host or "fb.watch" in host:
        return "facebook"
    return "other"


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def resolve_dir(raw: str | None) -> str:
    raw = (raw or "").strip() or DEFAULT_OUTPUT_DIR
    return raw if os.path.isabs(raw) else os.path.abspath(os.path.join(BASE_DIR, raw))


def build_ydl_opts(output_dir: str, quality: str, cookies_browser: str | None, hook) -> dict:
    has_ffmpeg = ffmpeg_available()
    opts: dict = {
        "outtmpl": os.path.join(output_dir, "%(title).200B [%(id)s].%(ext)s"),
        "progress_hooks": [hook],
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": False,
        "retries": 3,
    }

    if cookies_browser:
        opts["cookiesfrombrowser"] = (cookies_browser,)

    if quality == "audio":
        opts["format"] = "bestaudio/best"
        if has_ffmpeg:
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
            ]
    else:
        height_map = {"1080": 1080, "720": 720, "480": 480}
        h = height_map.get(quality)
        if has_ffmpeg:
            opts["format"] = (
                f"bestvideo[height<={h}]+bestaudio/best[height<={h}]/bestvideo+bestaudio/best"
                if h
                else "bestvideo+bestaudio/best"
            )
            opts["merge_output_format"] = "mp4"
        else:
            opts["format"] = f"best[height<={h}]/best" if h else "best"

    return opts


def process_item(job_id: str, item_id: str, output_dir: str, quality: str, cookies_browser: str | None):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        return
    item = next(i for i in job["items"] if i["id"] == item_id)

    if job["cancel"].is_set():
        item["status"] = "cancelled"
        return

    item["status"] = "downloading"
    item["percent"] = 0.0

    def hook(d):
        if job["cancel"].is_set():
            raise Cancelled()
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            downloaded = d.get("downloaded_bytes", 0)
            item["percent"] = round(downloaded / total * 100, 1) if total else item.get("percent")
            item["speed"] = d.get("speed")
            item["eta"] = d.get("eta")
        elif d["status"] == "finished":
            item["status"] = "processing"
            item["percent"] = 100.0
            fname = d.get("filename")
            if fname:
                item["filename"] = os.path.basename(fname)

    opts = build_ydl_opts(output_dir, quality, cookies_browser, hook)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(item["url"], download=True)
            item["title"] = info.get("title") or item["title"]
            final_path = ydl.prepare_filename(info)
            if quality == "audio" and ffmpeg_available():
                final_path = os.path.splitext(final_path)[0] + ".mp3"
            if os.path.exists(final_path):
                item["filename"] = os.path.basename(final_path)
        item["status"] = "done"
        item["percent"] = 100.0
    except Cancelled:
        item["status"] = "cancelled"
    except Exception as exc:  # noqa: BLE001 - surface any yt-dlp/network error to the UI
        item["status"] = "error"
        item["error"] = str(exc)[:400]


def run_job(job_id: str):
    with jobs_lock:
        job = jobs[job_id]
    futures = []
    for item in job["items"]:
        if job["cancel"].is_set():
            item["status"] = "cancelled"
            continue
        fut = executor.submit(
            process_item, job_id, item["id"], job["output_dir"], job["quality"], job["cookies_browser"]
        )
        futures.append(fut)
    for fut in futures:
        fut.result()
    job["finished"] = True


def serialize_job(job: dict) -> dict:
    items = job["items"]
    counts = {"queued": 0, "downloading": 0, "processing": 0, "done": 0, "error": 0, "cancelled": 0}
    for i in items:
        counts[i["status"]] = counts.get(i["status"], 0) + 1
    return {
        "id": job["id"],
        "finished": job["finished"],
        "output_dir": job["output_dir"],
        "counts": counts,
        "items": [
            {
                "id": i["id"],
                "url": i["url"],
                "platform": i["platform"],
                "status": i["status"],
                "percent": i.get("percent"),
                "speed": i.get("speed"),
                "eta": i.get("eta"),
                "title": i.get("title"),
                "filename": i.get("filename"),
                "error": i.get("error"),
            }
            for i in items
        ],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    from flask import render_template

    return render_template("index.html", has_ffmpeg=ffmpeg_available())


@app.route("/api/jobs", methods=["POST"])
def create_job():
    data = request.get_json(force=True, silent=True) or {}
    raw_urls = data.get("urls") or []
    quality = data.get("quality") or "best"
    cookies_browser = (data.get("cookies_browser") or "").strip() or None
    output_dir = resolve_dir(data.get("output_dir"))

    urls: list[str] = []
    seen = set()
    for raw in raw_urls:
        u = (raw or "").strip()
        if not u or u.startswith("#") or u in seen:
            continue
        if not URL_RE.match(u):
            continue
        seen.add(u)
        urls.append(u)

    if not urls:
        return jsonify({"error": "No valid http(s) URLs supplied."}), 400

    try:
        os.makedirs(output_dir, exist_ok=True)
    except OSError as exc:
        return jsonify({"error": f"Cannot create output folder: {exc}"}), 400

    job_id = uuid.uuid4().hex[:12]
    items = [
        {
            "id": uuid.uuid4().hex[:8],
            "url": u,
            "platform": detect_platform(u),
            "status": "queued",
            "percent": 0.0,
        }
        for u in urls
    ]
    job = {
        "id": job_id,
        "items": items,
        "cancel": threading.Event(),
        "finished": False,
        "output_dir": output_dir,
        "quality": quality,
        "cookies_browser": cookies_browser,
        "created": time.time(),
    }
    with jobs_lock:
        jobs[job_id] = job

    threading.Thread(target=run_job, args=(job_id,), daemon=True).start()
    return jsonify(serialize_job(job)), 201


@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Unknown job id"}), 404
    return jsonify(serialize_job(job))


@app.route("/api/jobs/<job_id>/cancel", methods=["POST"])
def cancel_job(job_id: str):
    with jobs_lock:
        job = jobs.get(job_id)
    if job is None:
        return jsonify({"error": "Unknown job id"}), 404
    job["cancel"].set()
    return jsonify({"ok": True})


@app.route("/api/library", methods=["GET"])
def library():
    output_dir = resolve_dir(request.args.get("dir"))
    if not os.path.isdir(output_dir):
        return jsonify({"files": [], "dir": output_dir})
    files = []
    for name in os.listdir(output_dir):
        path = os.path.join(output_dir, name)
        if not os.path.isfile(path):
            continue
        stat = os.stat(path)
        files.append({"name": name, "size": stat.st_size, "mtime": stat.st_mtime})
    files.sort(key=lambda f: f["mtime"], reverse=True)
    return jsonify({"files": files, "dir": output_dir})


@app.route("/api/library/file")
def library_file():
    output_dir = resolve_dir(request.args.get("dir"))
    name = request.args.get("name") or ""
    return send_from_directory(output_dir, name, as_attachment=True)


@app.route("/api/open-folder", methods=["POST"])
def open_folder():
    data = request.get_json(force=True, silent=True) or {}
    target = resolve_dir(data.get("dir"))
    try:
        if sys.platform.startswith("darwin"):
            subprocess.Popen(["open", target])
        elif sys.platform.startswith("win"):
            os.startfile(target)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", target])
        return jsonify({"ok": True})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({"ffmpeg": ffmpeg_available(), "default_output_dir": DEFAULT_OUTPUT_DIR})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8765))
    url = f"http://127.0.0.1:{port}"
    print(f"\n  Local Media Downloader running at {url}\n")
    if not ffmpeg_available():
        print("  Note: ffmpeg not found on PATH — video/audio merging and MP3")
        print("  extraction will be limited. Install ffmpeg for full quality options.\n")
    try:
        import webbrowser

        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    except Exception:
        pass
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
