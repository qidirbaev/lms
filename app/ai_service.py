import os
import json
import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

def get_access_token():
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

    if not sa_json:
        raise Exception("Missing GOOGLE_SERVICE_ACCOUNT_JSON")

    info = json.loads(sa_json)

    credentials = service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )

    credentials.refresh(Request())
    return credentials.token


def call_gemma(prompt: str):
    token = get_access_token()

    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    location = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
    model = os.getenv("VERTEX_MODEL")

    url = f"https://aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/endpoints/openapi/chat/completions"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    body = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "stream": False
    }

    res = requests.post(url, headers=headers, json=body)

    if res.status_code != 200:
        raise Exception(f"Gemma error: {res.text}")

    data = res.json()

    return data["choices"][0]["message"]["content"]