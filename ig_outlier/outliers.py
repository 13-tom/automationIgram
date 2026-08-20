"""Ranks a profile's videos by how much they over-perform that profile's own baseline."""

from __future__ import annotations

import statistics
from dataclasses import dataclass

from ig_outlier.instagram_client import VideoPost


@dataclass
class RankedPost:
    post: VideoPost
    outlier_ratio: float  # views / profile's median views. 3.0 = 3x the account's normal.
    robust_z: float  # median-based z-score, less skewed by one viral post than mean/stdev


def rank_outliers(posts: list[VideoPost], top_n: int = 5, min_sample: int = 5) -> list[RankedPost]:
    """`min_sample` guards against computing a "median" off 1-2 posts, which
    makes every post look like a huge outlier.
    """
    scored = [p for p in posts if p.views > 0]
    if len(scored) < min_sample:
        raise ValueError(
            f"Only {len(scored)} posts have view counts (need >= {min_sample}). "
            "View counts on Reels are often hidden when not logged in — see README."
        )

    views = [p.views for p in scored]
    median_views = statistics.median(views)
    abs_deviations = [abs(v - median_views) for v in views]
    mad = statistics.median(abs_deviations)
    scaled_mad = mad * 1.4826 or 1  # 1.4826 makes MAD comparable to std-dev for normal data

    ranked = [
        RankedPost(
            post=p,
            outlier_ratio=p.views / median_views if median_views else 0,
            robust_z=(p.views - median_views) / scaled_mad,
        )
        for p in scored
    ]
    ranked.sort(key=lambda r: r.outlier_ratio, reverse=True)
    return ranked[:top_n]
