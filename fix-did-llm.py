"""
Restore D-ID agent Custom LLM configuration.

Run this if D-ID Studio overwrites the Custom LLM config
(e.g. after saving changes in the agent editor).

Usage:
  1. Open https://studio.d-id.com/agents/editor/v2_agt_THZNQGpC
  2. Open DevTools (F12) > Network tab
  3. Find any request to "v2_agt_THZNQGpC"
  4. Copy the "authorization" header value (starts with "Bearer eyJ...")
  5. Run: python fix-did-llm.py
  6. Paste the token when prompted
  7. Reload D-ID Studio (F5) to verify

What this does:
  Sets llm.provider to "custom" so the D-ID avatar uses your
  Vercel endpoint (-> OpenClaw) instead of D-ID's built-in GPT.
"""

import json
import urllib.request
import urllib.error
import sys

AGENT_ID = "v2_agt_THZNQGpC"
CUSTOM_LLM_URL = "https://flyttanu.vercel.app/api/did/v1/chat/completions"
CUSTOM_LLM_KEY = "did-bridge-key-prod"

API_URL = f"https://api.d-id.com/agents/{AGENT_ID}"

PATCH_BODY = {
    "llm": {
        "provider": "custom",
        "custom": {
            "type": "basic",
            "url": CUSTOM_LLM_URL,
            "key": CUSTOM_LLM_KEY,
            "streaming": True,
            "max_messages": 20,
        },
    }
}


def get_token() -> str:
    if len(sys.argv) > 1:
        token = sys.argv[1]
    else:
        print("Paste the Bearer token from D-ID Studio Network tab:")
        token = input("> ").strip()

    if not token.startswith("Bearer "):
        token = f"Bearer {token}"
    return token


def patch_agent(token: str) -> None:
    data = json.dumps(PATCH_BODY).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=data,
        method="PATCH",
        headers={
            "Authorization": token,
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            provider = result.get("llm", {}).get("provider", "?")
            custom = result.get("llm", {}).get("custom", {})
            url = custom.get("url", "?")
            streaming = custom.get("streaming", "?")

            print(f"\nOK! Agent updated:")
            print(f"  provider:  {provider}")
            print(f"  url:       {url}")
            print(f"  streaming: {streaming}")

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"\nError {e.code}: {body}")
        sys.exit(1)


def verify_agent(token: str) -> None:
    req = urllib.request.Request(
        API_URL,
        method="GET",
        headers={"Authorization": token},
    )

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            provider = result.get("llm", {}).get("provider", "?")
            print(f"\nVerification: llm.provider = {provider}")
            if provider == "custom":
                print("All good - OpenClaw is the brain.")
            else:
                print("WARNING: provider is not 'custom'!")
    except urllib.error.HTTPError as e:
        print(f"\nVerify failed: {e.code}")


if __name__ == "__main__":
    token = get_token()
    print(f"\nPatching agent {AGENT_ID}...")
    patch_agent(token)
    verify_agent(token)
