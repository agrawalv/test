"""Fetch emails from Gmail API."""
import base64
import re
from typing import Optional
from gmail_auth import get_gmail_service


def decode_body(data: str) -> str:
    """Decode base64url-encoded email body."""
    padded = data + "=" * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def extract_text_from_parts(parts: list) -> str:
    """Recursively extract plain text from MIME parts."""
    text = ""
    for part in parts:
        mime = part.get("mimeType", "")
        body = part.get("body", {})
        sub_parts = part.get("parts", [])

        if mime == "text/plain" and body.get("data"):
            text += decode_body(body["data"]) + "\n"
        elif sub_parts:
            text += extract_text_from_parts(sub_parts)
    return text


def get_header(headers: list, name: str) -> str:
    """Get a header value by name (case-insensitive)."""
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def strip_html(text: str) -> str:
    """Remove HTML tags and condense whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_emails(max_results: int = 50) -> list[dict]:
    """
    Fetch recent emails from Gmail inbox.
    Returns list of dicts with subject, sender, snippet, body preview.
    """
    service = get_gmail_service()
    result = service.users().messages().list(
        userId="me",
        labelIds=["INBOX"],
        maxResults=max_results
    ).execute()

    messages = result.get("messages", [])
    emails = []

    for msg_ref in messages:
        msg = service.users().messages().get(
            userId="me",
            id=msg_ref["id"],
            format="full"
        ).execute()

        payload = msg.get("payload", {})
        headers = payload.get("headers", [])

        subject = get_header(headers, "subject") or "(no subject)"
        sender = get_header(headers, "from") or "unknown"
        snippet = msg.get("snippet", "")

        # Extract body text (limit to 500 chars for API efficiency)
        body = ""
        parts = payload.get("parts", [])
        if parts:
            body = extract_text_from_parts(parts)
        elif payload.get("body", {}).get("data"):
            body = decode_body(payload["body"]["data"])

        body = strip_html(body)[:500]

        emails.append({
            "id": msg_ref["id"],
            "subject": subject,
            "sender": sender,
            "snippet": snippet,
            "body_preview": body,
        })

    return emails
