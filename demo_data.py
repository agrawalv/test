"""Sample emails for demo mode — no Gmail or Anthropic credentials needed."""
import random
from datetime import datetime, timedelta
from categorizer import CATEGORIES

# 50 realistic sample emails pre-assigned to categories
SAMPLE_EMAILS = [
    # Work & Professional (12)
    {"subject": "Q4 2025 Budget Review — Action Required", "sender": "Sarah Chen <s.chen@acmecorp.com>", "category": "Work & Professional"},
    {"subject": "Re: Project Phoenix kick-off meeting", "sender": "Michael Torres <m.torres@acmecorp.com>", "category": "Work & Professional"},
    {"subject": "Invoice #4521 from Zendesk", "sender": "billing@zendesk.com", "category": "Work & Professional"},
    {"subject": "Your weekly Jira digest", "sender": "noreply@atlassian.com", "category": "Work & Professional"},
    {"subject": "Interview scheduled: Senior Engineer role", "sender": "talent@stripe.com", "category": "Work & Professional"},
    {"subject": "Confluence: 3 pages need your review", "sender": "noreply@atlassian.com", "category": "Work & Professional"},
    {"subject": "Re: Contract renewal discussion", "sender": "legal@partnerco.com", "category": "Work & Professional"},
    {"subject": "Figma — Alex commented on your design", "sender": "noreply@figma.com", "category": "Work & Professional"},
    {"subject": "AWS invoice: November 2025 — $342.18", "sender": "aws-billing@amazon.com", "category": "Work & Professional"},
    {"subject": "Zoom recording available: Team standup", "sender": "no-reply@zoom.us", "category": "Work & Professional"},
    {"subject": "DocuSign: Please sign the NDA", "sender": "dse@docusign.net", "category": "Work & Professional"},
    {"subject": "Pull request review requested: feat/auth-refresh", "sender": "notifications@github.com", "category": "Work & Professional"},

    # Personal & Family (9)
    {"subject": "Re: Thanksgiving dinner plans 🦃", "sender": "Mom <margaret.wells@gmail.com>", "category": "Personal & Family"},
    {"subject": "Flight confirmation — SFO → NYC Dec 22", "sender": "noreply@delta.com", "category": "Personal & Family"},
    {"subject": "Happy Birthday!! 🎉", "sender": "Jake Reyes <jake.r@gmail.com>", "category": "Personal & Family"},
    {"subject": "Your OpenTable reservation is confirmed", "sender": "reservations@opentable.com", "category": "Personal & Family"},
    {"subject": "Re: Weekend hiking trip — final headcount", "sender": "Lisa Park <lisa.park@gmail.com>", "category": "Personal & Family"},
    {"subject": "Photos from the camping trip!", "sender": "dad.photos@icloud.com", "category": "Personal & Family"},
    {"subject": "Dentist appointment reminder — Tuesday 2pm", "sender": "noreply@smileclinic.com", "category": "Personal & Family"},
    {"subject": "Re: Baby shower gift ideas?", "sender": "Emily Watson <emwatson@gmail.com>", "category": "Personal & Family"},
    {"subject": "Car service appointment confirmed — Thursday", "sender": "service@toyotaofmarin.com", "category": "Personal & Family"},

    # Newsletters & Marketing (12)
    {"subject": "🔥 Black Friday starts NOW — 60% off everything", "sender": "deals@shopify-store.com", "category": "Newsletters & Marketing"},
    {"subject": "This week in AI: OpenAI, Gemini, and Claude updates", "sender": "newsletter@tldr.tech", "category": "Newsletters & Marketing"},
    {"subject": "Your cart is waiting — complete your purchase", "sender": "noreply@amazon.com", "category": "Newsletters & Marketing"},
    {"subject": "Substack: New post from Stratechery", "sender": "no-reply@substack.com", "category": "Newsletters & Marketing"},
    {"subject": "Introducing our new Pro plan — $9/mo", "sender": "hello@notion.so", "category": "Newsletters & Marketing"},
    {"subject": "Weekend sale: Up to 40% off at West Elm", "sender": "email@westelm.com", "category": "Newsletters & Marketing"},
    {"subject": "Morning Brew ☕ — Thursday edition", "sender": "hello@morningbrew.com", "category": "Newsletters & Marketing"},
    {"subject": "Hacker News Digest — top stories this week", "sender": "digest@hackernewsletter.com", "category": "Newsletters & Marketing"},
    {"subject": "Your Spotify Wrapped 2025 is here!", "sender": "noreply@spotify.com", "category": "Newsletters & Marketing"},
    {"subject": "Last chance: Cyber Monday deal expires tonight", "sender": "offers@bestbuy.com", "category": "Newsletters & Marketing"},
    {"subject": "New course available: Advanced Python for ML", "sender": "courses@udemy.com", "category": "Newsletters & Marketing"},
    {"subject": "Product update: New features in Figma 2025", "sender": "updates@figma.com", "category": "Newsletters & Marketing"},

    # Notifications & Alerts (10)
    {"subject": "Your order #1042-SFBA has shipped!", "sender": "shipping@amazon.com", "category": "Notifications & Alerts"},
    {"subject": "Security alert: New sign-in from Chrome/Mac", "sender": "security@google.com", "category": "Notifications & Alerts"},
    {"subject": "Receipt: $12.99 — Apple iCloud Storage", "sender": "noreply@apple.com", "category": "Notifications & Alerts"},
    {"subject": "Delivery today by 8pm — FedEx tracking", "sender": "TrackingUpdates@fedex.com", "category": "Notifications & Alerts"},
    {"subject": "Your GitHub Actions run failed: CI/CD pipeline", "sender": "notifications@github.com", "category": "Notifications & Alerts"},
    {"subject": "Password changed successfully", "sender": "security@netflix.com", "category": "Notifications & Alerts"},
    {"subject": "Monthly statement ready — Chase Sapphire", "sender": "chase-alerts@chase.com", "category": "Notifications & Alerts"},
    {"subject": "Unusual login attempt blocked", "sender": "security@dropbox.com", "category": "Notifications & Alerts"},
    {"subject": "Your Uber receipt — Tuesday, Dec 3", "sender": "uber.receipts@uber.com", "category": "Notifications & Alerts"},
    {"subject": "Reminder: Subscription renews in 3 days — $99/yr", "sender": "billing@1password.com", "category": "Notifications & Alerts"},

    # Social Media & Communities (7)
    {"subject": "Sarah Chen liked your post on LinkedIn", "sender": "notifications@linkedin.com", "category": "Social Media & Communities"},
    {"subject": "You have 5 new followers on Twitter/X", "sender": "notify@twitter.com", "category": "Social Media & Communities"},
    {"subject": "New reply to your comment in r/MachineLearning", "sender": "noreply@reddit.com", "category": "Social Media & Communities"},
    {"subject": "Michael Torres sent you a message on LinkedIn", "sender": "notifications@linkedin.com", "category": "Social Media & Communities"},
    {"subject": "Discord: 12 new messages in #general", "sender": "noreply@discord.com", "category": "Social Media & Communities"},
    {"subject": "Alex commented on your photo", "sender": "notification@instagram.com", "category": "Social Media & Communities"},
    {"subject": "You're invited: Python Users Group meetup Dec 10", "sender": "events@meetup.com", "category": "Social Media & Communities"},
]


def _base_counts() -> dict[str, int]:
    counts = {cat: 0 for cat in CATEGORIES}
    for email in SAMPLE_EMAILS:
        counts[email["category"]] += 1
    return counts


def get_demo_counts() -> dict:
    """
    Return slightly randomised counts each call to simulate a live inbox.
    Each category gets ±0-3 random emails added on top of the baseline.
    """
    base = _base_counts()
    total_base = len(SAMPLE_EMAILS)
    extra = 0
    counts = {}
    for cat in CATEGORIES:
        delta = random.randint(0, 3)
        counts[cat] = base[cat] + delta
        extra += delta
    return {
        "counts": counts,
        "total": total_base + extra,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "ok",
        "error": None,
    }
