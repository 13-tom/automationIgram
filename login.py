"""One-time interactive Instagram login for the browser-based scraper.

Opens a real, visible Chromium window so you can log in (and solve any
2FA/checkpoint) by hand, then saves the resulting session so main.py never
needs your password again.

Usage:
    python login.py
"""

from __future__ import annotations

from playwright.sync_api import sync_playwright

SESSION_FILE = "ig_session.json"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://www.instagram.com/accounts/login/")

        print("A browser window has opened.")
        print("Log in normally (solve 2FA/checkpoint if Instagram asks for it).")
        print("Once you can see your home feed, come back here and press Enter.")
        input()

        context.storage_state(path=SESSION_FILE)
        browser.close()
        print(f"Session saved to {SESSION_FILE}.")
        print("This file holds your login cookies — it's gitignored, keep it private.")


if __name__ == "__main__":
    main()
