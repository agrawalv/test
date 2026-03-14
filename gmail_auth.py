"""Gmail OAuth2 authentication — credentials supplied at runtime (no files)."""
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def build_flow(client_id: str, client_secret: str, redirect_uri: str) -> Flow:
    """Build an OAuth2 Flow from client credentials."""
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = redirect_uri
    return flow


def credentials_from_token_dict(token_dict: dict) -> Credentials:
    """Restore Credentials from a serialised token dict (stored in session)."""
    return Credentials(
        token=token_dict.get("token"),
        refresh_token=token_dict.get("refresh_token"),
        token_uri=token_dict.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_dict.get("client_id"),
        client_secret=token_dict.get("client_secret"),
        scopes=token_dict.get("scopes"),
    )


def get_gmail_service(token_dict: dict) -> object:
    """Build and return an authenticated Gmail API service from a stored token."""
    creds = credentials_from_token_dict(token_dict)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)


def token_dict_from_credentials(creds: Credentials) -> dict:
    """Serialise Credentials to a JSON-safe dict for session storage."""
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": list(creds.scopes) if creds.scopes else [],
    }
