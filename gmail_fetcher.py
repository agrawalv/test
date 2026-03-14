"""Fetch emails from Gmail API."""
import base64
import re
from gmail_auth import get_gmail_service


def decode_body(data: str) -> str:
    padded = data + "=" * (4 - len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def extract_text_from_parts(parts: list) -> str:
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
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return ""


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def fetch_emails(token_dict: dict, max_results: int = 50) -> list[dict]:
    """Fetch recent inbox emails using stored OAuth token dict."""
    service = get_gmail_service(token_dict)
    result = service.users().messages().list(
        userId="me", labelIds=["INBOX"], maxResults=max_results
    ).execute()

    emails = []
    for msg_ref in result.get("messages", []):
        msg = service.users().messages().get(
            userId="me", id=msg_ref["id"], format="full"
        ).execute()

        payload = msg.get("payload", {})
        headers = payload.get("headers", [])
        subject = get_header(headers, "subject") or "(no subject)"
        sender = get_header(headers, "from") or "unknown"
        snippet = msg.get("snippet", "")

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
