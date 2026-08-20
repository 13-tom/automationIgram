"""CLI: find a profile's outlier videos and download the top ones to Google Drive.

Usage:
    python main.py --profile https://www.instagram.com/some_account/ --top 5

See README.md for one-time setup (Instagram session, Google OAuth credentials).
"""

from __future__ import annotations

import argparse
import os
import tempfile
from contextlib import contextmanager

from dotenv import load_dotenv

from ig_outlier.drive_uploader import upload_file
from ig_outlier.instagram_client import InstagramClient, username_from_input
from ig_outlier.outliers import rank_outliers


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", required=True, help="Instagram username or profile URL")
    parser.add_argument("--top", type=int, default=5, help="How many outlier videos to download")
    parser.add_argument("--max-posts", type=int, default=60, help="How many recent posts to scan")
    parser.add_argument(
        "--no-upload", action="store_true", help="Skip the Google Drive upload, just download+rank"
    )
    args = parser.parse_args()

    username = username_from_input(args.profile)
    ig_session_user = os.getenv("IG_USERNAME")
    drive_folder_id = os.getenv("DRIVE_FOLDER_ID")

    if not args.no_upload and not drive_folder_id:
        raise SystemExit("DRIVE_FOLDER_ID is not set in .env (see .env.example), or pass --no-upload")

    client = InstagramClient(session_username=ig_session_user)

    print(f"Scanning up to {args.max_posts} recent posts on @{username} ...")
    posts = client.fetch_video_posts(username, max_posts=args.max_posts)
    print(f"Found {len(posts)} video posts.")

    ranked = rank_outliers(posts, top_n=args.top)

    print(f"\nTop {len(ranked)} outlier videos for @{username}:\n")
    for i, r in enumerate(ranked, 1):
        print(
            f"{i}. {r.outlier_ratio:.1f}x median views  "
            f"({r.post.views:,} views, {r.post.likes:,} likes)  "
            f"{r.post.url}  {r.post.date_utc[:10]}"
        )

    with _output_dir(persistent=args.no_upload) as out_dir:
        for i, r in enumerate(ranked, 1):
            print(f"\nDownloading #{i} ({r.post.shortcode}) ...")
            local_path = client.download_post(username, r.post.shortcode, out_dir)

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
