"""Thin wrapper around Instaloader for reading a public profile's video posts."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

import instaloader


def username_from_input(profile: str) -> str:
    """Accept either a bare username or a full profile URL and return the username."""
    match = re.search(r"instagram\.com/([^/?#]+)", profile)
    if match:
        return match.group(1)
    return profile.strip().strip("@").strip("/")


@dataclass
class VideoPost:
    shortcode: str
    url: str
    caption: str
    date_utc: str
    views: int
    likes: int
    comments: int
    video_local_url: str


class InstagramClient:
    """Reads public profile data. Optionally logs in with a saved session so
    Instagram serves view counts on Reels (often hidden when logged out) and
    so requests are less likely to be rate-limited immediately.
    """

    def __init__(self, session_username: str | None = None, request_delay: float = 3.0):
        self.loader = instaloader.Instaloader(
            download_pictures=False,
            download_video_thumbnails=False,
            download_geotags=False,
            download_comments=False,
            save_metadata=False,
            compress_json=False,
            quiet=True,
        )
        self.request_delay = request_delay
        if session_username:
            # Requires a session file created once via:
            #   instaloader --login=<session_username>
            self.loader.load_session_from_file(session_username)

    def fetch_video_posts(self, profile_username: str, max_posts: int = 60) -> list[VideoPost]:
        profile = instaloader.Profile.from_username(self.loader.context, profile_username)

        posts: list[VideoPost] = []
        for i, post in enumerate(profile.get_posts()):
            if i >= max_posts:
                break
            if post.is_video:
                posts.append(
                    VideoPost(
                        shortcode=post.shortcode,
                        url=f"https://www.instagram.com/p/{post.shortcode}/",
                        caption=(post.caption or "")[:120],
                        date_utc=post.date_utc.isoformat(),
                        views=post.video_view_count or 0,
                        likes=post.likes,
                        comments=post.comments,
                        video_local_url=post.video_url,
                    )
                )
            # Be polite: Instagram rate-limits/blocks aggressive scraping.
            time.sleep(self.request_delay)

        return posts

    def download_post(self, profile_username: str, shortcode: str, target_dir: str) -> str:
        """Downloads a single post's video into target_dir. Returns the mp4 path."""
        post = instaloader.Post.from_shortcode(self.loader.context, shortcode)
        self.loader.dirname_pattern = target_dir
        self.loader.download_post(post, target=profile_username)
        return f"{target_dir}/{post.date_utc.strftime('%Y-%m-%d_%H-%M-%S')}_UTC.mp4"
