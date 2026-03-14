"""Flask app for Gmail categorizer with auto-refresh."""
import os
import threading
import time
from datetime import datetime
from flask import Flask, jsonify, render_template_string
from dotenv import load_dotenv
from gmail_fetcher import fetch_emails
from categorizer import categorize_emails, count_by_category, CATEGORIES

load_dotenv()

app = Flask(__name__)

# Shared state (protected by lock)
_lock = threading.Lock()
_state = {
    "counts": {cat: 0 for cat in CATEGORIES},
    "total": 0,
    "last_updated": None,
    "status": "initializing",
    "error": None,
}

REFRESH_INTERVAL = 60  # seconds


def refresh_data():
    """Fetch and categorize emails, update shared state."""
    global _state
    try:
        with _lock:
            _state["status"] = "refreshing"
            _state["error"] = None

        emails = fetch_emails(max_results=50)
        categorization = categorize_emails(emails)
        email_ids = [e["id"] for e in emails]
        counts = count_by_category(email_ids, categorization)

        with _lock:
            _state["counts"] = counts
            _state["total"] = len(emails)
            _state["last_updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            _state["status"] = "ok"

    except Exception as exc:
        with _lock:
            _state["status"] = "error"
            _state["error"] = str(exc)


def background_refresh():
    """Background thread: refresh every REFRESH_INTERVAL seconds."""
    while True:
        refresh_data()
        time.sleep(REFRESH_INTERVAL)


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail Categorizer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 16px;
      color: #1a202c;
    }
    header {
      text-align: center;
      margin-bottom: 32px;
    }
    header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: #2d3748;
    }
    header p {
      font-size: 0.95rem;
      color: #718096;
      margin-top: 6px;
    }
    .status-bar {
      background: white;
      border-radius: 8px;
      padding: 12px 20px;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      font-size: 0.9rem;
      color: #4a5568;
    }
    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.ok { background: #48bb78; }
    .dot.refreshing { background: #f6ad55; animation: pulse 1s infinite; }
    .dot.error { background: #fc8181; }
    .dot.initializing { background: #a0aec0; animation: pulse 1s infinite; }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      width: 100%;
      max-width: 1000px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    .card-icon { font-size: 2rem; }
    .card-label {
      font-size: 1rem;
      font-weight: 600;
      color: #2d3748;
    }
    .card-count {
      font-size: 2.8rem;
      font-weight: 800;
      line-height: 1;
    }
    .card-bar-bg {
      background: #edf2f7;
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
    }
    .card-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }
    /* Category colors */
    .cat-0 .card-count { color: #4299e1; }
    .cat-0 .card-bar { background: #4299e1; }
    .cat-1 .card-count { color: #48bb78; }
    .cat-1 .card-bar { background: #48bb78; }
    .cat-2 .card-count { color: #f6ad55; }
    .cat-2 .card-bar { background: #f6ad55; }
    .cat-3 .card-count { color: #fc8181; }
    .cat-3 .card-bar { background: #fc8181; }
    .cat-4 .card-count { color: #9f7aea; }
    .cat-4 .card-bar { background: #9f7aea; }
    .total-box {
      margin-top: 28px;
      background: white;
      border-radius: 12px;
      padding: 20px 28px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-size: 1.1rem;
      color: #4a5568;
    }
    .total-box strong { color: #2d3748; font-size: 1.4rem; }
    .timer {
      margin-top: 16px;
      font-size: 0.85rem;
      color: #a0aec0;
    }
    .error-msg {
      margin-top: 16px;
      color: #e53e3e;
      font-size: 0.9rem;
      max-width: 600px;
      text-align: center;
      background: #fff5f5;
      padding: 12px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <header>
    <h1>📧 Gmail Categorizer</h1>
    <p>AI-powered inbox categorization using Claude</p>
  </header>

  <div class="status-bar">
    <div class="dot" id="status-dot"></div>
    <span id="status-text">Loading...</span>
  </div>

  <div class="cards" id="cards">
    <!-- filled by JS -->
  </div>

  <div class="total-box" id="total-box" style="display:none">
    Total emails scanned: <strong id="total-count">0</strong>
  </div>

  <div class="error-msg" id="error-msg" style="display:none"></div>

  <div class="timer" id="timer"></div>

  <script>
    const ICONS = ["💼", "👨‍👩‍👧", "📰", "🔔", "📱"];
    const CATEGORIES = {{ categories | tojson }};
    let nextRefresh = Date.now() + 60000;

    function formatCountdown(ms) {
      const s = Math.max(0, Math.ceil(ms / 1000));
      return `Next refresh in ${s}s`;
    }

    function renderCards(counts, total) {
      const container = document.getElementById("cards");
      container.innerHTML = "";
      CATEGORIES.forEach((cat, i) => {
        const count = counts[cat] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const card = document.createElement("div");
        card.className = `card cat-${i}`;
        card.innerHTML = `
          <div class="card-icon">${ICONS[i]}</div>
          <div class="card-label">${cat}</div>
          <div class="card-count">${count}</div>
          <div class="card-bar-bg">
            <div class="card-bar" style="width:${pct}%"></div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    async function fetchData() {
      try {
        const resp = await fetch("/api/status");
        const data = await resp.json();

        const dot = document.getElementById("status-dot");
        const statusText = document.getElementById("status-text");
        const totalBox = document.getElementById("total-box");
        const totalCount = document.getElementById("total-count");
        const errorMsg = document.getElementById("error-msg");

        dot.className = "dot " + data.status;

        if (data.status === "ok") {
          statusText.textContent = `Last updated: ${data.last_updated}`;
          renderCards(data.counts, data.total);
          totalBox.style.display = "block";
          totalCount.textContent = data.total;
          errorMsg.style.display = "none";
        } else if (data.status === "refreshing" || data.status === "initializing") {
          statusText.textContent = data.status === "refreshing"
            ? "Refreshing — fetching and categorizing emails..."
            : "Initializing...";
        } else if (data.status === "error") {
          statusText.textContent = "Error fetching emails";
          errorMsg.textContent = data.error || "Unknown error";
          errorMsg.style.display = "block";
        }
      } catch (e) {
        console.error("Fetch error:", e);
      }
    }

    function updateTimer() {
      const remaining = nextRefresh - Date.now();
      document.getElementById("timer").textContent = formatCountdown(remaining);
      if (remaining <= 0) {
        nextRefresh = Date.now() + 60000;
        fetchData();
      }
    }

    // Initial load + poll every 3s for status updates
    fetchData();
    setInterval(fetchData, 3000);
    setInterval(updateTimer, 1000);
    updateTimer();
  </script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE, categories=CATEGORIES)


@app.route("/api/status")
def api_status():
    with _lock:
        return jsonify(dict(_state))


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    """Trigger an immediate refresh."""
    threading.Thread(target=refresh_data, daemon=True).start()
    return jsonify({"message": "Refresh triggered"})


if __name__ == "__main__":
    # Start background refresh thread
    t = threading.Thread(target=background_refresh, daemon=True)
    t.start()
    app.run(host="0.0.0.0", port=5000, debug=False)
