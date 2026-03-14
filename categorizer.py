"""Categorize emails using Claude claude-opus-4-6."""
import json
import anthropic

CATEGORIES = [
    "Work & Professional",
    "Personal & Family",
    "Newsletters & Marketing",
    "Notifications & Alerts",
    "Social Media & Communities",
]

SYSTEM_PROMPT = """You are an email categorization assistant. Classify each email into exactly one of these 5 categories:

1. Work & Professional - work emails, business communications, job-related, meetings, invoices, professional services
2. Personal & Family - personal messages, friends, family, personal appointments
3. Newsletters & Marketing - promotional emails, newsletters, marketing campaigns, deals, offers, subscriptions
4. Notifications & Alerts - automated notifications, order confirmations, shipping updates, account alerts, security notices, receipts
5. Social Media & Communities - social networks, forums, community platforms, event invites from social apps

Respond ONLY with a JSON object mapping email IDs to category names. Example:
{"id1": "Work & Professional", "id2": "Newsletters & Marketing"}"""


def categorize_emails(emails: list[dict], api_key: str) -> dict[str, str]:
    """Categorize emails using Claude. Returns dict mapping email id -> category."""
    if not emails:
        return {}

    client = anthropic.Anthropic(api_key=api_key)

    email_list = []
    for email in emails:
        email_list.append(
            f"ID: {email['id']}\n"
            f"From: {email['sender']}\n"
            f"Subject: {email['subject']}\n"
            f"Preview: {email['snippet'][:200]}"
        )

    user_message = "Categorize these emails:\n\n" + "\n\n---\n\n".join(email_list)

    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        response = stream.get_final_message()

    text = ""
    for block in response.content:
        if block.type == "text":
            text = block.text
            break

    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return {e["id"]: "Notifications & Alerts" for e in emails}

    try:
        result = json.loads(text[start:end])
        for email_id, cat in result.items():
            if cat not in CATEGORIES:
                result[email_id] = "Notifications & Alerts"
        return result
    except json.JSONDecodeError:
        return {e["id"]: "Notifications & Alerts" for e in emails}


def count_by_category(email_ids: list[str], categorization: dict[str, str]) -> dict[str, int]:
    counts = {cat: 0 for cat in CATEGORIES}
    for email_id in email_ids:
        cat = categorization.get(email_id, "Notifications & Alerts")
        if cat in counts:
            counts[cat] += 1
    return counts
