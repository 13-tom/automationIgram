"""Uploads local files to a Google Drive folder using an OAuth desktop app flow.

Setup (one-time, see README):
  1. Create an OAuth client ID (Desktop app) in Google Cloud Console, enable
     the Drive API, download it as credentials.json into the project root.
  2. First run opens a browser to authorize; the resulting token is cached
     in token.json so future runs don't prompt again.
"""

from __future__ import annotations

import os

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _get_credentials(credentials_path: str, token_path: str) -> Credentials:
    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w") as token_file:
            token_file.write(creds.to_json())

    return creds


def upload_file(
    local_path: str,
    folder_id: str,
    credentials_path: str = "credentials.json",
    token_path: str = "token.json",
) -> str:
    """Uploads local_path into the given Drive folder. Returns the Drive file ID."""
    creds = _get_credentials(credentials_path, token_path)
    service = build("drive", "v3", credentials=creds)

    file_metadata = {
        "name": os.path.basename(local_path),
        "parents": [folder_id],
    }
    media = MediaFileUpload(local_path, resumable=True)
    uploaded = service.files().create(body=file_metadata, media_body=media, fields="id").execute()
    return uploaded["id"]
