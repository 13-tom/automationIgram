"""CLI: find a profile's outlier videos and download the top ones to Google Drive.

Usage:
    python main.py --profile https://www.instagram.com/some_account/ --top 5

Run `python login.py` once first (see README) so the browser method has a
saved Instagram session to use.
"""

from __future__ import annotations

import argparse
import os
import tempfile
from contextlib import contextmanager

from dotenv import load_dotenv

from ig_outlier.browser_client import SESSION_FILE_DEFAULT, download_video, fetch_reel_details, scan_profile_reels
from ig_outlier.drive_uploader import upload_file
from ig_outlier.instagram_client import InstagramClient, VideoPost, username_from_input
from ig_outlier.outliers import RankedPost, rank_outliers


def find_outliers_browser(username: str, max_posts: int, top: int) -> list[RankedPost]:
    if not os.path.exists(SESSION_FILE_DEFAULT):
        raise SystemExit(f"No {SESSION_FILE_DEFAULT} found — run `python login.py` first (see README).")

    print(f"Scanning up to {max_posts} recent reels on @{username} via browser ...")
    summaries = scan_profile_reels(username, max_posts=max_posts)
    print(f"Found {len(summaries)} reels.")

    posts = [
        VideoPost(
            shortcode=s.shortcode,
            url=f"https://www.instagram.com/reel/{s.shortcode}/",
            caption="",
            date_utc="",
            views=s.approx_views,
            likes=0,
            comments=0,
            video_local_url="",
        )
        for s in summaries
    ]
    ranked = rank_outliers(posts, top_n=top)

    # Only fetch exact like/comment counts + the video file URL for the
    # shortlist — this is the expensive per-post step, so keep it small.
    for r in ranked:
        details = fetch_reel_details(r.post.shortcode)
        r.post.likes = details.likes
        r.post.comments = details.comments
        r.post.video_local_url = details.video_url

    return ranked


def find_outliers_instaloader(client: InstagramClient, username: str, max_posts: int, top: int) -> list[RankedPost]:
    print(f"Scanning up to {max_posts} recent posts on @{username} via Instaloader ...")
    posts = client.fetch_video_posts(username, max_posts=max_posts)
    print(f"Found {len(posts)} video posts.")
    return rank_outliers(posts, top_n=top)


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, help="Instagram username or profile URL")
    parser.add_argument("--top", type=int, default=5, help="How many outlier videos to download")
    parser.add_argument("--max-posts", type=int, default=60, help="How many recent posts to scan")
    parser.add_argument(
        "--method",
        choices=["browser", "instaloader"],
        default="browser",
        help="browser (recommended): drives a real logged-in Chromium session. "
        "instaloader: calls Instagram's private API directly, no browser needed.",
    )
    parser.add_argument(
        "--no-upload", action="store_true", help="Skip the Google Drive upload, just download+rank"
    )
    args = parser.parse_args()

    username = username_from_input(args.profile)
    drive_folder_id = os.getenv("DRIVE_FOLDER_ID")

    if not args.no_upload and not drive_folder_id:
        raise SystemExit("DRIVE_FOLDER_ID is not set in .env (see .env.example), or pass --no-upload")

    ig_client = InstagramClient(session_username=os.getenv("IG_USERNAME")) if args.method == "instaloader" else None

    if args.method == "browser":
        ranked = find_outliers_browser(username, args.max_posts, args.top)
    else:
        ranked = find_outliers_instaloader(ig_client, username, args.max_posts, args.top)

    print(f"\nTop {len(ranked)} outlier videos for @{username}:\n")
    for i, r in enumerate(ranked, 1):
        print(
            f"{i}. {r.outlier_ratio:.1f}x median views  "
            f"({r.post.views:,} views, {r.post.likes:,} likes)  "
            f"{r.post.url}"
        )

    with _output_dir(persistent=args.no_upload) as out_dir:
        for i, r in enumerate(ranked, 1):
            print(f"\nDownloading #{i} ({r.post.shortcode}) ...")
            local_path = os.path.join(out_dir, f"{r.post.shortcode}.mp4")

            if args.method == "browser":
                download_video(r.post.video_local_url, local_path)
            else:
                local_path = ig_client.download_post(username, r.post.shortcode, out_dir)

            if args.no_upload:
                print(f"  saved locally: {local_path}")
                continue

            print("  uploading to Google Drive ...")
            file_id = upload_file(local_path, drive_folder_id)
            print(f"  uploaded: https://drive.google.com/file/d/{file_id}/view")


@contextmanager
def _output_dir(persistent: bool):
    """Downloads land in ./downloads/ when kept locally (--no-upload), or in a
    scratch temp dir when they're just a hop on the way to Drive.
    """
    if persistent:
        out_dir = "downloads"
        os.makedirs(out_dir, exist_ok=True)
        yield out_dir
    else:
        with tempfile.TemporaryDirectory() as tmp_dir:
            yield tmp_dir


if __name__ == "__main__":
    main()
