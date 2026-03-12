"""
Instagrapi sidecar — lightweight FastAPI service wrapping the instagrapi Python library.
Handles Instagram private API calls with proper device fingerprinting, headers,
and challenge resolution that instagrapi maintains upstream.

Run: uvicorn main:app --host 127.0.0.1 --port 3002
PM2: pm2 start "uvicorn main:app --host 127.0.0.1 --port 3002" --name instagrapi-sidecar
"""

import logging
import traceback
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    ClientError,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("instagrapi-sidecar")

app = FastAPI(title="Instagrapi Sidecar", version="1.0.0")


# --- Models ---

class LikedFeedRequest(BaseModel):
    session_id: str
    cookies: dict[str, str] = {}


class LikedFeedResponse(BaseModel):
    success: bool = False
    items: list[Any] = []
    updated_cookies: dict[str, str] = {}
    challenge_required: bool = False
    error: str | None = None


# --- Helpers ---

def build_client(session_id: str, cookies: dict[str, str]) -> Client:
    """Create an instagrapi Client with session cookies (no login/password needed)."""
    cl = Client()

    # Build settings dict that instagrapi expects
    cookie_dict = {**cookies}
    if "sessionid" not in cookie_dict:
        cookie_dict["sessionid"] = session_id

    # Set authorization data so private_request works
    cl.settings = {
        "uuids": {
            "phone_id": cl.phone_id,
            "uuid": cl.uuid,
            "client_session_id": cl.client_session_id,
            "advertising_id": cl.advertising_id,
            "android_device_id": cl.android_device_id,
            "request_id": cl.request_id,
            "tray_session_id": cl.tray_session_id,
        },
        "cookies": {},
        "authorization_data": {
            "ds_user_id": cookies.get("ds_user_id", ""),
            "sessionid": session_id,
        },
        "mid": cookies.get("mid", ""),
        "ig_u_rur": cookies.get("rur", ""),
        "ig_www_claim": "0",
        "user_agent": cl.user_agent,
    }

    # Inject cookies into the session
    for key, value in cookie_dict.items():
        cl.private.cookies.set(key, value, domain=".instagram.com", path="/")

    # Set user_id from ds_user_id cookie if available
    ds_user_id = cookies.get("ds_user_id", "")
    if ds_user_id:
        cl.user_id = int(ds_user_id)

    return cl


def extract_updated_cookies(cl: Client) -> dict[str, str]:
    """Extract current cookies from the client session."""
    result = {}
    allowed = {"sessionid", "csrftoken", "ds_user_id", "mid", "ig_did", "ig_nrcb", "rur", "datr"}
    for cookie in cl.private.cookies:
        if cookie.name in allowed and cookie.value:
            result[cookie.name] = cookie.value
    return result


# --- Routes ---

@app.get("/health")
def health():
    return {"status": "ok", "service": "instagrapi-sidecar"}


@app.post("/instagram/liked-feed", response_model=LikedFeedResponse)
def get_liked_feed(req: LikedFeedRequest):
    """
    Fetch user's liked feed using instagrapi.
    Uses session cookies — no username/password needed.
    """
    logger.info(f"Fetching liked feed for ds_user_id={req.cookies.get('ds_user_id', '?')}")

    try:
        cl = build_client(req.session_id, req.cookies)

        # Use private_request to call the liked feed endpoint directly
        result = cl.private_request("feed/liked/")

        items = result.get("items", [])
        updated_cookies = extract_updated_cookies(cl)

        logger.info(f"Success: {len(items)} items fetched")
        return LikedFeedResponse(
            success=True,
            items=items,
            updated_cookies=updated_cookies,
        )

    except ChallengeRequired as e:
        logger.warning(f"Challenge required: {e}")
        return LikedFeedResponse(
            challenge_required=True,
            error=f"Challenge required: {e}",
        )

    except LoginRequired as e:
        logger.warning(f"Login required: {e}")
        return LikedFeedResponse(error=f"Login required: {e}")

    except PleaseWaitFewMinutes as e:
        logger.warning(f"Rate limited: {e}")
        return LikedFeedResponse(error=f"Rate limited, please wait: {e}")

    except ClientError as e:
        logger.error(f"Client error: {e}")
        return LikedFeedResponse(error=f"Instagram client error: {e}")

    except Exception as e:
        logger.error(f"Unexpected error: {traceback.format_exc()}")
        return LikedFeedResponse(error=f"Unexpected error: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3002)
