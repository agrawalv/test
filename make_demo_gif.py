"""
Capture an animated GIF demo of the Gmail Categorizer app.
Scenes:
  1. Setup page (with "Try Demo" button visible)
  2. Demo dashboard — initial load
  3. Demo dashboard — hover over a card
  4. Demo dashboard — after clicking "Refresh now" (counts update)
"""
import time
import io
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5000"
OUT  = "/home/user/test/demo.gif"


def screenshot_to_pil(page, full_page=False) -> Image.Image:
    buf = page.screenshot(full_page=full_page)
    return Image.open(io.BytesIO(buf)).convert("RGB")


def make_gif(frames: list[tuple[Image.Image, int]], path: str):
    """frames = list of (PIL_image, duration_ms)"""
    imgs = []
    durations = []
    for img, ms in frames:
        imgs.append(img.convert("P", palette=Image.ADAPTIVE, dither=Image.Dither.NONE))
        durations.append(ms)
    imgs[0].save(
        path,
        save_all=True,
        append_images=imgs[1:],
        duration=durations,
        loop=0,
        optimize=False,
    )
    print(f"Saved {path}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            executable_path="/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome",
        )
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        frames: list[tuple[Image.Image, int]] = []

        # ── Scene 1: Setup page ──────────────────────────────────────────────
        page.goto(f"{BASE}/setup", wait_until="networkidle")
        time.sleep(0.4)
        frames.append((screenshot_to_pil(page, full_page=True), 2500))

        # ── Scene 2: Click "Try the demo" ────────────────────────────────────
        page.click("text=Try the demo")
        page.wait_for_url(f"{BASE}/demo", timeout=5000)
        page.wait_for_selector(".card", timeout=6000)
        time.sleep(0.6)
        frames.append((screenshot_to_pil(page, full_page=True), 2500))

        # ── Scene 3: Scroll down a little so all 5 cards visible ────────────
        page.evaluate("window.scrollTo(0, 120)")
        time.sleep(0.3)
        frames.append((screenshot_to_pil(page, full_page=False), 2000))

        # ── Scene 4: Hover over card 0 (Work & Professional) ────────────────
        card = page.locator(".card.cat-0")
        card.hover()
        time.sleep(0.4)
        frames.append((screenshot_to_pil(page, full_page=False), 1500))

        # ── Scene 5: Click "↻ Refresh now" ──────────────────────────────────
        page.click(".btn-refresh")
        time.sleep(0.5)
        # Show "refreshing" dot briefly
        frames.append((screenshot_to_pil(page, full_page=False), 800))

        # Wait for counts to update
        time.sleep(3.5)
        frames.append((screenshot_to_pil(page, full_page=False), 2500))

        # ── Scene 6: Scroll to bottom to show total + timer ──────────────────
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(0.3)
        frames.append((screenshot_to_pil(page, full_page=False), 2000))

        # ── Scene 7: Scroll back to top ──────────────────────────────────────
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.3)
        frames.append((screenshot_to_pil(page, full_page=False), 3000))

        browser.close()

    make_gif(frames, OUT)
    print(f"Done — {len(frames)} frames, saved to {OUT}")


if __name__ == "__main__":
    run()
