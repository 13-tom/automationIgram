# automationIgram

Find a public Instagram profile's outlier videos (views far above that
account's own baseline) and pull the top ones into a Google Drive folder.

## How it works

1. **Read the profile** — [Instaloader](https://instaloader.github.io/) (the
   best-maintained free/open-source Instagram library, 13k+ stars) walks a
   public profile's recent posts and pulls view/like/comment counts for each
   video.
2. **Score outliers** — for each video we compute
   `views / median(views across the profile's recent videos)`. A ratio of
   `4.2x` means that video did ~4x the account's normal traffic. Using the
   *median* (not the mean) keeps one viral post from skewing the baseline for
   everything else — this is the same idea used by the
   [free-sort-feed-extension](https://github.com/RostyslavDzhohola/free-sort-feed-extension)
   Chrome extension, except that tool only flags outliers in-browser, it
   doesn't download anything.
3. **Download + upload** — the top N videos are downloaded via Instaloader
   and uploaded straight to a Google Drive folder via the Drive API.

## Setup

```bash
pip install -r requirements.txt
cp .env.example .env
```

### 1. Instagram session (recommended, not strictly required)

Instagram frequently hides Reel view counts — and rate-limits/blocks
requests fast — when you're not logged in. Logging in fixes both, at some
risk to the account used (see **Risks** below), so use a throwaway/secondary
account, not your main one.

```bash
instaloader --login=<your_ig_username>
```

This prompts for your password once (and 2FA if enabled) and saves a local
session file. Put that username in `.env` as `IG_USERNAME`. If you skip
this, the tool still runs, but expect missing view counts and much faster
rate-limiting.

### 2. Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project, enable the **Google Drive API**, and create an **OAuth client ID**
   of type **Desktop app**.
2. Download it as `credentials.json` into the project root (already
   gitignored — never commit this file).
3. Open the target Drive folder in a browser, copy the ID from the URL
   (`.../folders/<THIS_PART>`), and put it in `.env` as `DRIVE_FOLDER_ID`.
4. First run opens a browser window to authorize once; after that a cached
   `token.json` (also gitignored) is reused.

## Usage

```bash
python main.py --profile https://www.instagram.com/some_account/ --top 5
```

Or skip Drive entirely and just save locally to `./downloads/`:

```bash
python main.py --profile some_account --top 5 --no-upload
```

Output looks like:

```
Top 5 outlier videos for @some_account:

1. 6.3x median views  (812,400 views, 41,200 likes)  https://www.instagram.com/p/AbCdEfG/  2026-06-02
2. 4.1x median views  (528,900 views, 30,100 likes)  https://www.instagram.com/p/HiJkLmN/  2026-05-14
...
```

## Risks — read before pointing this at accounts you care about

- **This is against Instagram's Terms of Service.** Instagram does not
  provide a free public API for reading arbitrary profiles at this scale;
  every free approach (this one included) works by automating the same
  requests a browser makes, which Instagram's ToS prohibits. There is no
  fully "compliant" free option for scraping someone else's profile — the
  only sanctioned path (Instagram Graph API) only exposes data for
  Business/Creator accounts *you* administer, not arbitrary public profiles.
- **Account risk.** If you use `IG_USERNAME`, that account can be
  rate-limited, flagged for automation, or banned. Use a throwaway account.
- **Built-in throttling.** `instagram_client.py` sleeps between every
  request (`request_delay=3.0`s default). Don't lower this to scrape faster
  — it's the main thing keeping the session alive.
- **Scope.** Only use this on public profiles, and only for personal
  research/analysis. Don't scrape private accounts, don't redistribute
  downloaded video, and don't use this for anything at bulk/commercial scale
  — that's a different risk category (and Instagram's detection gets much
  more aggressive).

## Project layout

```
main.py                      # CLI entrypoint
ig_outlier/
  instagram_client.py        # Instaloader wrapper: read posts, download video
  outliers.py                # median-ratio outlier ranking
  drive_uploader.py          # Google Drive OAuth + upload
```

## Possible next steps

- Swap in the browser-extension approach for *identifying* outliers (reading
  the logged-in Reels tab DOM directly) as a lower-risk alternative to
  Instaloader's request-based scraping, then use this repo's download/upload
  step only on the videos it flags.
- Normalize outlier score by follower count too (not just the account's own
  median), to compare potential virality across profiles of different sizes.
- Add a scheduled run (e.g. weekly) that tracks a watchlist of profiles.
