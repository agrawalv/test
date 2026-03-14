# Gmail Categorizer App — Setup Guide

A web app that scans your Gmail inbox, categorizes emails into 5 areas using Claude AI, and auto-refreshes every minute.

## Categories

| # | Category | What it includes |
|---|----------|-----------------|
| 1 | 💼 Work & Professional | Work emails, business comms, meetings, invoices |
| 2 | 👨‍👩‍👧 Personal & Family | Messages from friends and family |
| 3 | 📰 Newsletters & Marketing | Promo emails, newsletters, deals |
| 4 | 🔔 Notifications & Alerts | Order confirmations, account alerts, receipts |
| 5 | 📱 Social Media & Communities | Social networks, forums, communities |

## Prerequisites

- Python 3.10+
- Google account with Gmail
- Anthropic API key

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Set up Anthropic API key

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 3. Set up Gmail API credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable the **Gmail API** (APIs & Services → Library → search "Gmail API")
4. Create OAuth2 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Desktop app**
   - Download the JSON file
5. Save the downloaded file as `credentials.json` in this directory

### 4. Run the app

```bash
python app.py
```

On first run, a browser window opens for Gmail OAuth authorization. After granting access, `token.json` is saved for future runs.

### 5. Open the dashboard

Navigate to **http://localhost:5000** in your browser.

The app:
- Fetches up to 50 recent inbox emails
- Uses Claude claude-opus-4-6 to categorize them
- Shows counts per category with visual bars
- Auto-refreshes every 60 seconds
