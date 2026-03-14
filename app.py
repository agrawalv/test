"""Gmail Categorizer — credentials entered via UI, no local credential files needed."""
import os
import secrets
import threading
import time
from datetime import datetime
from flask import Flask, session, redirect, request, url_for, jsonify, render_template_string

from gmail_auth import build_flow, token_dict_from_credentials
from gmail_fetcher import fetch_emails
from categorizer import categorize_emails, count_by_category, CATEGORIES

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Per-session refresh state stored in a dict keyed by session ID
_refresh_lock = threading.Lock()
_session_state: dict[str, dict] = {}

REFRESH_INTERVAL = 60  # seconds


def get_redirect_uri():
    return url_for("oauth2callback", _external=True)


def session_id():
    if "sid" not in session:
        session["sid"] = secrets.token_hex(16)
    return session["sid"]


def get_state(sid: str) -> dict:
    with _refresh_lock:
        if sid not in _session_state:
            _session_state[sid] = {
                "counts": {cat: 0 for cat in CATEGORIES},
                "total": 0,
                "last_updated": None,
                "status": "idle",
                "error": None,
            }
        return _session_state[sid]


def set_state(sid: str, **kwargs):
    with _refresh_lock:
        state = _session_state.setdefault(sid, {
            "counts": {cat: 0 for cat in CATEGORIES},
            "total": 0,
            "last_updated": None,
            "status": "idle",
            "error": None,
        })
        state.update(kwargs)


def refresh_data(sid: str, token_dict: dict, api_key: str):
    """Fetch + categorize emails for a session, update state."""
    set_state(sid, status="refreshing", error=None)
    try:
        emails = fetch_emails(token_dict, max_results=50)
        categorization = categorize_emails(emails, api_key)
        counts = count_by_category([e["id"] for e in emails], categorization)
        set_state(
            sid,
            counts=counts,
            total=len(emails),
            last_updated=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            status="ok",
        )
    except Exception as exc:
        set_state(sid, status="error", error=str(exc))


def start_background_refresh(sid: str, token_dict: dict, api_key: str):
    """Launch a background thread that refreshes every REFRESH_INTERVAL seconds."""
    def loop():
        while True:
            # Check session is still alive
            with _refresh_lock:
                if sid not in _session_state:
                    break
            refresh_data(sid, token_dict, api_key)
            time.sleep(REFRESH_INTERVAL)

    t = threading.Thread(target=loop, daemon=True)
    t.start()


# ─── HTML pages ───────────────────────────────────────────────────────────────

SETUP_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail Categorizer — Setup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    h1 { font-size: 1.6rem; color: #1a202c; margin-bottom: 6px; }
    .subtitle { color: #718096; font-size: 0.95rem; margin-bottom: 32px; }
    .section-title {
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #a0aec0;
      margin: 24px 0 12px;
    }
    .section-title:first-of-type { margin-top: 0; }
    label { display: block; font-size: 0.9rem; font-weight: 500; color: #4a5568; margin-bottom: 6px; }
    input[type=text], input[type=password] {
      width: 100%;
      padding: 10px 14px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.95rem;
      color: #2d3748;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    input:focus { border-color: #667eea; }
    .hint {
      font-size: 0.82rem;
      color: #a0aec0;
      margin-top: -12px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .hint a { color: #667eea; text-decoration: none; }
    .hint a:hover { text-decoration: underline; }
    .info-box {
      background: #ebf8ff;
      border: 1px solid #bee3f8;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.85rem;
      color: #2c5282;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .info-box code {
      background: #bee3f8;
      border-radius: 4px;
      padding: 1px 5px;
      font-family: monospace;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      margin-top: 8px;
    }
    button:hover { opacity: 0.9; }
    .error {
      background: #fff5f5;
      border: 1px solid #feb2b2;
      color: #c53030;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
<div class="card">
  <h1>📧 Gmail Categorizer</h1>
  <p class="subtitle">Enter your credentials below to get started. Nothing is stored on disk.</p>

  {% if error %}
  <div class="error">{{ error }}</div>
  {% endif %}

  <div class="info-box">
    <strong>Before you start:</strong> In <a href="https://console.cloud.google.com" target="_blank">Google Cloud Console</a>, add this redirect URI to your OAuth 2.0 client:<br>
    <code>{{ redirect_uri }}</code>
  </div>

  <form method="POST" action="/setup">
    <div class="section-title">Anthropic</div>
    <label>API Key</label>
    <input type="password" name="anthropic_key" placeholder="sk-ant-..." required>

    <div class="section-title">Google OAuth 2.0 — <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:#667eea;font-size:0.8rem;text-transform:none;letter-spacing:0">Get credentials ↗</a></div>
    <label>Client ID</label>
    <input type="text" name="client_id" placeholder="xxxx.apps.googleusercontent.com" required>
    <label>Client Secret</label>
    <input type="password" name="client_secret" placeholder="GOCSPX-..." required>
    <p class="hint">Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console with Gmail API enabled.</p>

    <button type="submit">Connect Gmail →</button>
  </form>
</div>
</body>
</html>"""


DASHBOARD_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gmail Categorizer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0f4f8;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 16px 60px;
      color: #1a202c;
    }
    header { text-align: center; margin-bottom: 28px; }
    header h1 { font-size: 2rem; font-weight: 800; color: #2d3748; }
    header p { color: #718096; font-size: 0.95rem; margin-top: 6px; }
    .top-bar {
      display: flex; align-items: center; gap: 12px;
      background: white; border-radius: 10px; padding: 12px 20px;
      margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      font-size: 0.9rem; color: #4a5568; flex-wrap: wrap;
      max-width: 1000px; width: 100%;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.ok { background: #48bb78; }
    .dot.refreshing, .dot.idle { background: #f6ad55; animation: pulse 1s infinite; }
    .dot.error { background: #fc8181; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .spacer { flex: 1; }
    .btn-refresh {
      padding: 6px 14px; background: #667eea; color: white; border: none;
      border-radius: 6px; font-size: 0.85rem; cursor: pointer; font-weight: 500;
    }
    .btn-refresh:hover { background: #5a67d8; }
    .btn-logout {
      padding: 6px 14px; background: transparent; color: #a0aec0; border: 1px solid #e2e8f0;
      border-radius: 6px; font-size: 0.85rem; cursor: pointer;
    }
    .btn-logout:hover { color: #718096; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
      gap: 20px; width: 100%; max-width: 1000px;
    }
    .card {
      background: white; border-radius: 14px; padding: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07);
      display: flex; flex-direction: column; gap: 10px;
      transition: transform .15s, box-shadow .15s;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,0.11); }
    .card-icon { font-size: 2rem; }
    .card-label { font-size: .95rem; font-weight: 600; color: #2d3748; }
    .card-count { font-size: 3rem; font-weight: 800; line-height: 1; }
    .bar-bg { background: #edf2f7; border-radius: 4px; height: 6px; overflow: hidden; }
    .bar { height: 100%; border-radius: 4px; transition: width .6s ease; }
    .cat-0 .card-count { color: #4299e1; } .cat-0 .bar { background: #4299e1; }
    .cat-1 .card-count { color: #48bb78; } .cat-1 .bar { background: #48bb78; }
    .cat-2 .card-count { color: #f6ad55; } .cat-2 .bar { background: #f6ad55; }
    .cat-3 .card-count { color: #fc8181; } .cat-3 .bar { background: #fc8181; }
    .cat-4 .card-count { color: #9f7aea; } .cat-4 .bar { background: #9f7aea; }
    .summary {
      margin-top: 28px; background: white; border-radius: 12px;
      padding: 18px 28px; text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.07); font-size: 1rem; color: #4a5568;
      max-width: 1000px; width: 100%;
    }
    .summary strong { color: #2d3748; font-size: 1.4rem; }
    .timer { margin-top: 14px; font-size: .85rem; color: #a0aec0; }
    .error-msg {
      margin-top: 14px; color: #e53e3e; font-size: .9rem;
      max-width: 600px; text-align: center;
      background: #fff5f5; padding: 12px; border-radius: 8px;
    }
  </style>
</head>
<body>
  <header>
    <h1>📧 Gmail Categorizer</h1>
    <p>AI-powered inbox categorization · refreshes every minute</p>
  </header>

  <div class="top-bar">
    <div class="dot" id="dot"></div>
    <span id="status-text">Loading…</span>
    <span class="spacer"></span>
    <button class="btn-refresh" onclick="triggerRefresh()">↻ Refresh now</button>
    <button class="btn-logout" onclick="location.href='/logout'">Sign out</button>
  </div>

  <div class="cards" id="cards"></div>

  <div class="summary" id="summary" style="display:none">
    Emails scanned: <strong id="total">0</strong>
  </div>
  <div class="error-msg" id="err" style="display:none"></div>
  <div class="timer" id="timer"></div>

  <script>
    const ICONS = ["💼","👨‍👩‍👧","📰","🔔","📱"];
    const CATS  = {{ categories | tojson }};
    let nextAt  = Date.now() + 60000;

    function renderCards(counts, total) {
      const c = document.getElementById("cards");
      c.innerHTML = "";
      CATS.forEach((cat, i) => {
        const n = counts[cat] || 0;
        const pct = total > 0 ? Math.round(n / total * 100) : 0;
        const div = document.createElement("div");
        div.className = `card cat-${i}`;
        div.innerHTML = `
          <div class="card-icon">${ICONS[i]}</div>
          <div class="card-label">${cat}</div>
          <div class="card-count">${n}</div>
          <div class="bar-bg"><div class="bar" style="width:${pct}%"></div></div>`;
        c.appendChild(div);
      });
    }

    async function fetchStatus() {
      const r = await fetch("/api/status");
      const d = await r.json();
      const dot = document.getElementById("dot");
      const st  = document.getElementById("status-text");
      const sum = document.getElementById("summary");
      const err = document.getElementById("err");

      dot.className = "dot " + d.status;
      if (d.status === "ok") {
        st.textContent = `Last updated: ${d.last_updated}`;
        renderCards(d.counts, d.total);
        document.getElementById("total").textContent = d.total;
        sum.style.display = "block";
        err.style.display = "none";
        nextAt = Date.now() + 60000;
      } else if (d.status === "refreshing" || d.status === "idle") {
        st.textContent = d.status === "refreshing"
          ? "Fetching and categorizing emails…"
          : "Starting up…";
      } else if (d.status === "error") {
        st.textContent = "Error";
        err.textContent = d.error || "Unknown error";
        err.style.display = "block";
      }
    }

    async function triggerRefresh() {
      await fetch("/api/refresh", { method: "POST" });
      nextAt = Date.now() + 60000;
      fetchStatus();
    }

    function tick() {
      const s = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
      document.getElementById("timer").textContent = `Next auto-refresh in ${s}s`;
      if (nextAt - Date.now() <= 0) {
        nextAt = Date.now() + 60000;
        fetch("/api/refresh", { method: "POST" });
      }
    }

    fetchStatus();
    setInterval(fetchStatus, 3000);
    setInterval(tick, 1000);
    tick();
  </script>
</body>
</html>"""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if not session.get("token_dict"):
        return redirect(url_for("setup"))
    sid = session_id()
    state = get_state(sid)
    if state["status"] == "idle":
        # Kick off first refresh
        token_dict = session["token_dict"]
        api_key = session["anthropic_key"]
        threading.Thread(
            target=start_background_refresh,
            args=(sid, token_dict, api_key),
            daemon=True,
        ).start()
    return render_template_string(DASHBOARD_PAGE, categories=CATEGORIES)


@app.route("/setup", methods=["GET", "POST"])
def setup():
    error = None
    redirect_uri = url_for("oauth2callback", _external=True)

    if request.method == "POST":
        anthropic_key = request.form.get("anthropic_key", "").strip()
        client_id = request.form.get("client_id", "").strip()
        client_secret = request.form.get("client_secret", "").strip()

        if not anthropic_key or not client_id or not client_secret:
            error = "All three fields are required."
        else:
            session["anthropic_key"] = anthropic_key
            session["oauth_client_id"] = client_id
            session["oauth_client_secret"] = client_secret

            try:
                flow = build_flow(client_id, client_secret, redirect_uri)
                auth_url, state = flow.authorization_url(
                    access_type="offline",
                    include_granted_scopes="true",
                    prompt="consent",
                )
                session["oauth_state"] = state
                return redirect(auth_url)
            except Exception as exc:
                error = f"Failed to start OAuth flow: {exc}"

    return render_template_string(
        SETUP_PAGE, error=error, redirect_uri=redirect_uri
    )


@app.route("/oauth2callback")
def oauth2callback():
    state = session.get("oauth_state")
    client_id = session.get("oauth_client_id")
    client_secret = session.get("oauth_client_secret")

    if not state or not client_id or not client_secret:
        return redirect(url_for("setup"))

    redirect_uri = url_for("oauth2callback", _external=True)
    try:
        flow = build_flow(client_id, client_secret, redirect_uri)
        flow.fetch_token(
            authorization_response=request.url,
            state=state,
        )
        creds = flow.credentials
        session["token_dict"] = token_dict_from_credentials(creds)
        return redirect(url_for("index"))
    except Exception as exc:
        session["setup_error"] = str(exc)
        return redirect(url_for("setup"))


@app.route("/logout")
def logout():
    sid = session.get("sid")
    if sid:
        with _refresh_lock:
            _session_state.pop(sid, None)
    session.clear()
    return redirect(url_for("setup"))


@app.route("/api/status")
def api_status():
    if not session.get("token_dict"):
        return jsonify({"status": "unauthenticated"}), 401
    sid = session_id()
    return jsonify(dict(get_state(sid)))


@app.route("/api/refresh", methods=["POST"])
def api_refresh():
    if not session.get("token_dict"):
        return jsonify({"error": "unauthenticated"}), 401
    sid = session_id()
    token_dict = session["token_dict"]
    api_key = session["anthropic_key"]
    threading.Thread(
        target=refresh_data, args=(sid, token_dict, api_key), daemon=True
    ).start()
    return jsonify({"message": "Refresh triggered"})


if __name__ == "__main__":
    # Allow OAuth redirect on http (local dev only)
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")
    app.run(host="0.0.0.0", port=5000, debug=False)
