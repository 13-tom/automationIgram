"""Reads Instagram Reels data (and the underlying video file) using a real
Chromium browser via Playwright, driven with a saved login session.

Instagram doesn't offer a free public API for this, so this works the same
way a logged-in human browsing the site does: load the profile's Reels tab,
scroll it, and read the counts that are already rendered on the page —
rather than calling Instagram's private endpoints directly. This is the
same idea the free-sort-feed-extension Chrome extension uses (see README).

Instagram's markup changes periodically and isn't meant to be scraped, so
the selectors below are best-effort and may need small updates over time.
See README "If scraping breaks" for how to fix them.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

import httpx
from playwright.sync_api import sync_playwright

SESSION_FILE_DEFAULT = "ig_session.json"

_MULTIPLIERS = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
_COUNT_RE = re.compile(r"^([\d.]+)\s*([KMB]?)$")


def parse_count(text: str) -> int:
    """Turns Instagram's abbreviated counts ('1.2M', '834K', '12,345') into an int."""
    match = _COUNT_RE.match(text.strip().upper().replace(",", ""))
    if not match:
        return 0
    number, suffix = match.groups()
    return int(float(number) * _MULTIPLIERS.get(suffix, 1))


@dataclass
class ReelSummary:
    shortcode: str
    approx_views: int


@dataclass
class ReelDetails:
    video_url: str
    likes: int
    comments: int


def _shortcode_from_href(href: str) -> str | None:
    match = re.search(r"/reel/([^/]+)/", href)
    return match.group(1) if match else None


def _extract_tile_views(tiles: list[tuple[str, str]]) -> dict[str, int]:
    """Pure parsing step: given a list of (href, tile_text) pairs from the
    grid, return {shortcode: views}. Kept separate from the Playwright loop
    below so it's testable without a live browser/Instagram session.
    """
    seen: dict[str, int] = {}
    for href, tile_text in tiles:
        shortcode = _shortcode_from_href(href)
        if not shortcode or shortcode in seen:
            continue
        lines = [line for line in tile_text.splitlines() if line.strip()]
        seen[shortcode] = parse_count(lines[0]) if lines else 0
    return seen


def scan_profile_reels(
    profile_username: str,
    session_file: str = SESSION_FILE_DEFAULT,
    max_posts: int = 60,
    headless: bool = True,
) -> list[ReelSummary]:
    """Scrolls a profile's Reels tab and reads (shortcode, view count) off
    each grid tile. View counts here are the abbreviated ones Instagram
    shows in the grid ("1.2M"), which is precise enough for outlier ranking.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=session_file)
        page = context.new_page()
        page.goto(f"https://www.instagram.com/{profile_username}/reels/", wait_until="networkidle")

        seen: dict[str, int] = {}
        stall_rounds = 0
        while len(seen) < max_posts and stall_rounds < 5:
            before = len(seen)
            tiles = [
                (tile.get_attribute("href") or "", tile.inner_text())
                for tile in page.locator('a[href*="/reel/"]').all()
            ]
            seen.update(_extract_tile_views(tiles))

            stall_rounds = stall_rounds + 1 if len(seen) == before else 0
            page.mouse.wheel(0, 4000)
            time.sleep(2)

        browser.close()

    return [ReelSummary(shortcode=sc, approx_views=v) for sc, v in list(seen.items())[:max_posts]]


def fetch_reel_details(
    shortcode: str, session_file: str = SESSION_FILE_DEFAULT, headless: bool = True
) -> ReelDetails:
    """Opens a single reel's page to get the exact like/comment count (from
    Instagram's og:description meta tag, a stable pattern) and the direct
    video file URL.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=session_file)
        page = context.new_page()
        page.goto(f"https://www.instagram.com/reel/{shortcode}/", wait_until="networkidle")

        video = page.locator("video").first
        video.wait_for(state="attached", timeout=15000)
        video_url = video.get_attribute("src") or ""

        description = page.locator('meta[property="og:description"]').get_attribute("content") or ""
        browser.close()

    likes_match = re.search(r"([\d,]+)\s+[Ll]ikes", description)
    comments_match = re.search(r"([\d,]+)\s+[Cc]omments", description)
    likes = int(likes_match.group(1).replace(",", "")) if likes_match else 0
    comments = int(comments_match.group(1).replace(",", "")) if comments_match else 0

    if not video_url:
        raise RuntimeError(f"Could not find a video source for reel {shortcode} — selectors may be stale.")

    return ReelDetails(video_url=video_url, likes=likes, comments=comments)


def download_video(video_url: str, dest_path: str) -> None:
    with httpx.stream("GET", video_url, follow_redirects=True, timeout=60) as response:
        response.raise_for_status()
        with open(dest_path, "wb") as f:
            for chunk in response.iter_bytes():
                f.write(chunk)
