"""
skv_int7.py

Runs the same Playwright methodology as skv6, but as a
manual-triggered automation entrypoint for dev flows.
"""

import argparse
import json
import os
import time
import uuid
from datetime import datetime
from typing import Optional

import skv6


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = os.path.join(SCRIPT_DIR, "runtime")
DEFAULT_PAYLOAD_FILE = os.path.join(RUNTIME_DIR, "skv_payload_latest.json")
SESSION_LOG_FILE = os.path.join(SCRIPT_DIR, "skv_int7_session_log.txt")

os.makedirs(RUNTIME_DIR, exist_ok=True)


# Keep selectors/timings aligned with skv6 defaults.
CLICK_AFTER_SECONDS_0 = 1.5
CLICK_SELECTORS_0 = [
    "#deny-all",
    "skv-button-8-6-2#deny-all",
    'button:has-text("Tillåt endast nödvändiga")',
    "#accept-all",
]
CLICK_AFTER_SECONDS_1 = 3.0
CLICK_SELECTORS_1 = [
    'a[aria-label*="Inloggning"]',
    "button#login-info-button",
    "slot.fin-skv-button-label",
    "span.fin-skv-button-spinner",
]
CLICK_AFTER_SECONDS_2 = 3.0
CLICK_SELECTORS_2 = [
    "button#bankid-standard",
    "#bankid-standard",
]
CLICK_AFTER_SECONDS_3 = 3.0
CLICK_SELECTORS_3 = [
    "path[fill='#FFFFFF']",
    "path[fill='#000000']",
    "svg path",
]


def _log(message: str, data: Optional[dict] = None) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    with open(SESSION_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{ts}] {message}\n")
        if data is not None:
            f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(message)


def _reset_log() -> None:
    with open(SESSION_LOG_FILE, "w", encoding="utf-8") as f:
        f.write("=" * 60 + "\n")
        f.write(f"  SKV INT7 SESSION  |  {datetime.now().isoformat()}\n")
        f.write("=" * 60 + "\n\n")


def _write_last_payload_snapshot(payload_file: str) -> None:
    if not payload_file or not os.path.isfile(payload_file):
        return
    snapshot_file = os.path.join(RUNTIME_DIR, "last_used_payload.json")
    try:
        with open(payload_file, "r", encoding="utf-8") as src:
            payload = json.load(src)
        with open(snapshot_file, "w", encoding="utf-8") as dst:
            json.dump(payload, dst, ensure_ascii=False, indent=2)
    except Exception as e:
        _log("Failed writing payload snapshot", {"error": str(e)})


def _set_env(temp_env: dict[str, str]) -> dict[str, Optional[str]]:
    previous: dict[str, Optional[str]] = {}
    for key, value in temp_env.items():
        previous[key] = os.environ.get(key)
        os.environ[key] = value
    return previous


def _restore_env(previous: dict[str, Optional[str]]) -> None:
    for key, old_value in previous.items():
        if old_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = old_value


def run_int7_flow(
    target_url: str,
    payload_file: str,
    timeout_seconds: float,
    allow_mockup_data: bool,
    allow_normal_browser_window: bool,
    force_clone_fallback: bool,
) -> int:
    _reset_log()
    _write_last_payload_snapshot(payload_file)

    _log("Starting skv_int7 flow", {
        "target_url": target_url,
        "payload_file": payload_file,
        "timeout_seconds": timeout_seconds,
        "allow_mockup_data": allow_mockup_data,
        "allow_normal_browser_window": allow_normal_browser_window,
        "force_clone_fallback": force_clone_fallback,
        "skv_synligt_skv": os.environ.get("SKV_SYNLIGT_SKV", ""),
    })

    temp_env = {
        "SKV_PAYLOAD_FILE": payload_file,
        "SKV_ALLOW_MOCKUP_DATA": "y" if allow_mockup_data else "n",
        # Prevent opening another default browser window by default for int7.
        "SKV_DISABLE_NORMAL_BROWSER_WINDOW": "n" if allow_normal_browser_window else "y",
        # In dev + popup-constrained environments, clone fallback improves QR visibility.
        "SKV_FORCE_CLONE_TAB_FALLBACK": "y" if force_clone_fallback else "n",
    }

    previous_env = _set_env(temp_env)
    try:
        job_id = uuid.uuid4().hex[:12]
        job = skv6.JobStatus(job_id=job_id, state="queued", message="Köad...")
        skv6._set_job(job)

        skv6._run_playwright_job(
            job_id=job_id,
            url=target_url,
            timeout_seconds=timeout_seconds,
            click_after_seconds_0=CLICK_AFTER_SECONDS_0,
            click_selectors_0=CLICK_SELECTORS_0,
            click_after_seconds=CLICK_AFTER_SECONDS_1,
            click_selectors=CLICK_SELECTORS_1,
            click_after_seconds_2=CLICK_AFTER_SECONDS_2,
            click_selectors_2=CLICK_SELECTORS_2,
            click_after_seconds_3=CLICK_AFTER_SECONDS_3,
            click_selectors_3=CLICK_SELECTORS_3,
        )

        final_job = skv6._get_job(job_id)
        if not final_job:
            _log("skv_int7 finished without final job record")
            return 1

        _log("skv_int7 finished", {
            "state": final_job.state,
            "message": final_job.message,
            "screenshot_path": final_job.screenshot_path,
            "details": final_job.details or {},
        })

        if final_job.state == "matched":
            return 0
        return 1
    finally:
        _restore_env(previous_env)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run SKV int7 BankID flow")
    parser.add_argument(
        "--url",
        default="https://www7.skatteverket.se/portal/flyttanmalan/",
        help="Target URL to open",
    )
    parser.add_argument(
        "--payload-file",
        default=os.environ.get("SKV_PAYLOAD_FILE", DEFAULT_PAYLOAD_FILE),
        help="Path to JSON payload used for form fill",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=float(os.environ.get("SKV_INT7_TIMEOUT_SECONDS", "300")),
        help="How long to wait for form detection",
    )
    parser.add_argument(
        "--allow-mockup-data",
        action="store_true",
        help="Allow explicit fallback mockup data if payload is missing",
    )
    parser.add_argument(
        "--allow-normal-browser-window",
        action="store_true",
        help="Allow POPUP_BROWSER_NORMAL_WINDOW behavior in int7 mode",
    )
    parser.add_argument(
        "--no-force-clone-fallback",
        action="store_true",
        help="Disable forced clone fallback for QR tab in int7 mode",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    exit_code = run_int7_flow(
        target_url=args.url,
        payload_file=args.payload_file,
        timeout_seconds=args.timeout_seconds,
        allow_mockup_data=args.allow_mockup_data,
        allow_normal_browser_window=args.allow_normal_browser_window,
        force_clone_fallback=not args.no_force_clone_fallback,
    )
    # Give user-visible browser operations a tiny flush window before process exits.
    time.sleep(0.2)
    raise SystemExit(exit_code)
