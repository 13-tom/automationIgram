# automationIgram

Find a public Instagram profile's outlier videos (views far above that
account's own baseline) and pull the top ones into a Google Drive folder.
Runs entirely locally, entirely free — no paid API, no paid scraping
service.

## How it works

1. **Read the profile** — the default method drives a real, logged-in
   Chromium browser (via [Playwright](https://playwright.dev/), free/OSS) to
   the profile's Reels tab, scrolls it, and reads the view counts already
   rendered on the page — the same way a human browsing the site would. This
   is the same idea as the
   [free-sort-feed-extension](https://github.com/RostyslavDzhohola/free-sort-feed-extension)
   Chrome extension, except that tool only flags outliers in-browser; this
   also downloads the video. There's a second method (`--method instaloader`,
   using [Instaloader](https://instaloader.github.io/)) that calls
   Instagram's private API directly instead of using a browser — no browser
   needed, but more easily detected/rate-limited than the browser method.
2. **Score outliers** — for each video, `views / median(views across the
   profile's recent videos)`. A ratio of `4.2x` means that video did ~4x the
   account's normal traffic. Using the *median* (not the mean) keeps one
   viral post from skewing the baseline for everything else.
3. **Download + upload** — the top N videos' exact like/comment counts and
   direct video file are fetched, downloaded, and uploaded to a Google Drive
   folder via the Drive API (Drive's free tier — no cost).

## Setup

```bash
pip install -r requirements.txt
playwright install chromium   # one-time, downloads a local Chromium (free)
cp .env.example .env
```

### 1. Instagram login (for the default browser method)

```bash
python login.py
```

This opens a real, visible browser window. Log in normally (solve 2FA or a
checkpoint if Instagram asks), then press Enter in the terminal once you can
see your home feed. Your session is saved to `ig_session.json` (gitignored —
never commit it, it holds your login cookies) and reused by every future
run, so you only do this once (until the session expires and you re-run it).

Use a secondary/throwaway account if you're going to run this often — see
**Risks** below.

*(If you'd rather not use a browser at all, `--method instaloader` skips
this and uses `instaloader --login=<username>` instead — see that file's
docstring in `ig_outlier/instagram_client.py`.)*

### 2. Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), create a
   project, enable the **Google Drive API**, and create an **OAuth client ID**
   of type **Desktop app**.
2. Download it as `credentials.json` into the project root (gitignored —
   never commit this file).
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

1. 6.3x median views  (812,400 views, 41,200 likes)  https://www.instagram.com/reel/AbCdEfG/
2. 4.1x median views  (528,900 views, 30,100 likes)  https://www.instagram.com/reel/HiJkLmN/
...
```

## If scraping breaks

Instagram changes its page markup periodically (it isn't designed to be
scraped), so the browser method's selectors in `ig_outlier/browser_client.py`
can go stale. Symptoms: `scan_profile_reels` returns 0 reels, or
`fetch_reel_details` raises "Could not find a video source". To fix:

1. Run with `headless=False` (edit the call site temporarily) to watch what
   the page actually looks like.
2. Check whether the reel links still match `a[href*="/reel/"]`, and whether
   `og:description` still contains `"<N> likes, <N> comments"` text — these
   are the two things the scraper depends on.
3. Adjust the selector/regex in `browser_client.py` accordingly.

## Risks — read before pointing this at accounts you care about

- **This is against Instagram's Terms of Service.** There is no free,
  ToS-compliant way to pull data for an arbitrary public profile — Instagram's
  only sanctioned free API (Graph API) only exposes data for Business/Creator
  accounts *you* administer, not other people's profiles. Both methods here
  work by automating what a browser/app already does, which the ToS
  prohibits.
- **Account risk.** The Instagram account behind `ig_session.json` (or
  `IG_USERNAME`) can be rate-limited, flagged for automation, or banned. Use
  a throwaway account, not one you rely on.
- **Built-in throttling.** The scraper scrolls/waits between actions rather
  than hammering the page; the Instaloader fallback sleeps between every
  request (`request_delay=3.0`s default). Don't remove these — they're the
  main thing keeping a session alive.
- **Scope.** Only use this on public profiles, for personal research. Don't
  scrape private accounts, don't redistribute downloaded video, and don't
  run this at bulk/commercial scale — detection gets much more aggressive
  there.

## Project layout

```
main.py                      # CLI entrypoint (--method browser|instaloader)
login.py                     # one-time interactive Instagram login (browser method)
ig_outlier/
  browser_client.py          # Playwright: scan reels, fetch details, download video
  instagram_client.py        # Instaloader wrapper (fallback method)
  outliers.py                # median-ratio outlier ranking
  drive_uploader.py          # Google Drive OAuth + upload
```

## Possible next steps

- Normalize outlier score by follower count too (not just the account's own
  median), to compare potential virality across profiles of different sizes.
- Add a scheduled run (e.g. weekly) that tracks a watchlist of profiles —
  see the earlier discussion on running this as a cloud cron job once the
  local version is proven reliable.
