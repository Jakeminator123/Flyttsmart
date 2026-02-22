"""
skv6.py - Flyttanmälan Auto

Click sequences → QR login → auto-fill form → save HTML snapshot.
Single session log file (overwrites previous). POPUP_BROWSER_NORMAL_WINDOW
opens form URL in default browser when form is found.
"""
import json
import os
import re
import time
import uuid
import threading
import webbrowser
from datetime import datetime
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from urllib.parse import urljoin

import requests
from flask import Flask, request, jsonify, render_template_string, send_from_directory, Response

# Playwright (sync)
from playwright.sync_api import sync_playwright


APP_HOST = "127.0.0.1"
APP_PORT = int(os.environ.get("PORT", "8767"))  # Different port to run alongside skv2
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
RESULT_DIR = os.path.join(SCRIPT_DIR, "results")
os.makedirs(RESULT_DIR, exist_ok=True)

# Single session log - one file per run, overwrites previous session
SESSION_LOG_FILE = os.path.join(SCRIPT_DIR, "skv6_session_log.txt")

CONFIG_FILE = os.path.join(SCRIPT_DIR, "config.txt")


def _load_config() -> Dict[str, str]:
    """Load config from config.txt. Returns dict of KEY=value (lowercased values)."""
    out = {}
    try:
        if os.path.isfile(CONFIG_FILE):
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if "=" in line and not line.startswith("#"):
                        k, _, v = line.partition("=")
                        out[k.strip().upper()] = (v.strip() or "").lower()
    except Exception:
        pass
    return out
FORM_NEXT_HOST_SELECTOR = "skv-button-10-0-7[button-type='primary'].flytt-skv-wizard-step-button"


def _get_form_signals(p) -> Dict[str, Any]:
    """Collect robust readiness signals from main/popup page."""
    if not p:
        return {
            "ok": False,
            "url": "",
            "url_has_flytt": False,
            "has_form": False,
            "has_wizard_step": False,
            "has_active_step": False,
            "has_next_host": False,
            "error": "no page",
        }

    try:
        url = p.url or ""
    except Exception:
        return {
            "ok": False,
            "url": "",
            "url_has_flytt": False,
            "has_form": False,
            "has_wizard_step": False,
            "has_active_step": False,
            "has_next_host": False,
            "error": "url unavailable",
        }

    url_has_flytt = "flytt" in url.lower()
    if not url_has_flytt:
        return {
            "ok": True,
            "url": url,
            "url_has_flytt": False,
            "has_form": False,
            "has_wizard_step": False,
            "has_active_step": False,
            "has_next_host": False,
            "error": "",
        }

    try:
        # Use shadow-DOM-piercing query: traverse shadow roots (Angular/web components)
        out = p.evaluate(
            """(nextSel) => {
                function qs(root, sel) {
                    try { const el = root.querySelector(sel); if (el) return el; } catch(e) {}
                    const nodes = root.querySelectorAll('*');
                    for (const n of nodes) {
                        if (n.shadowRoot) { const f = qs(n.shadowRoot, sel); if (f) return f; }
                    }
                    return null;
                }
                const hasForm = !!qs(document, '#fbfFlyttanmalanForm');
                const hasWizardStep = !!qs(document, 'flytt-skv-wizard-step');
                const hasActiveStep = !!qs(document, '.flytt-skv-wizard-step--active, .flytt-skv-wizard-step--check');
                const hasNextHost = !!qs(document, nextSel);
                return { hasForm, hasWizardStep, hasActiveStep, hasNextHost, title: document.title || '' };
            }""",
            FORM_NEXT_HOST_SELECTOR,
        )
        return {
            "ok": True,
            "url": url,
            "url_has_flytt": url_has_flytt,
            "has_form": bool(out.get("hasForm")),
            "has_wizard_step": bool(out.get("hasWizardStep")),
            "has_active_step": bool(out.get("hasActiveStep")),
            "has_next_host": bool(out.get("hasNextHost")),
            "title": out.get("title", ""),
            "error": "",
        }
    except Exception as e:
        return {
            "ok": False,
            "url": url,
            "url_has_flytt": url_has_flytt,
            "has_form": False,
            "has_wizard_step": False,
            "has_active_step": False,
            "has_next_host": False,
            "error": str(e),
        }


def _is_form_ready_from_signals(signals: Dict[str, Any], api_ready: bool) -> bool:
    """Readiness decision after QR: require real form signals, with API fallback."""
    if not signals or not signals.get("url_has_flytt"):
        return False
    # Strict: form + wizard + (active step or Nästa button or api)
    if signals.get("has_form") and signals.get("has_wizard_step"):
        return bool(signals.get("has_active_step") or signals.get("has_next_host") or api_ready)
    # Relaxed: flytt URL + Nästa button visible (form may be in different DOM structure)
    if signals.get("has_next_host"):
        return True
    return False


def _get_all_pages_for_form(page) -> list:
    """Collect all pages in page's context - includes all tabs in same window."""
    try:
        ctx = page.context
        if ctx:
            return list(ctx.pages)
    except Exception:
        pass
    return []


def _pick_form_page(page, popup_ref, api_ready: bool, all_pages: Optional[list] = None):
    """Pick ready page among main, popup, and any other tabs (new tab often opens after BankID approval)."""
    pages_to_check = []
    if all_pages:
        pages_to_check = [(p, f"tab_{i}") for i, p in enumerate(all_pages) if p and not p.is_closed()]
    if not pages_to_check:
        pages_to_check = [(page, "main")]
        if popup_ref and not popup_ref.is_closed():
            pages_to_check.append((popup_ref, "popup"))

    main_signals = _get_form_signals(page)
    popup_signals = _get_form_signals(popup_ref) if popup_ref and not popup_ref.is_closed() else None

    for p, source in pages_to_check:
        try:
            sig = _get_form_signals(p)
            if _is_form_ready_from_signals(sig, api_ready):
                return p, source, sig, main_signals
            # Fallback: Playwright locator pierces shadow DOM - if Nästa exists, form is ready
            if sig.get("url_has_flytt"):
                try:
                    if p.locator(FORM_NEXT_HOST_SELECTOR).count() > 0:
                        return p, source, {**sig, "has_next_host": True}, main_signals
                    if p.get_by_role("button", name="Nästa").count() > 0:
                        return p, source, {**sig, "has_next_host": True}, main_signals
                except Exception:
                    pass
        except Exception:
            continue
    return None, "", main_signals, popup_signals


# User-Agent to avoid some blocks
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

app = Flask(__name__)


# ----------------------------
# Job handling (simple in-memory)
# ----------------------------

@dataclass
class JobStatus:
    job_id: str
    state: str            # queued | running | matched | timeout | error | cancelled
    message: str = ""
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    screenshot_path: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


_jobs: Dict[str, JobStatus] = {}
_cancel_flags: Dict[str, bool] = {}
_jobs_lock = threading.Lock()


def _set_job(job: JobStatus) -> None:
    with _jobs_lock:
        _jobs[job.job_id] = job


def _get_job(job_id: str) -> Optional[JobStatus]:
    with _jobs_lock:
        return _jobs.get(job_id)


def _cancel_job(job_id: str) -> bool:
    with _jobs_lock:
        if job_id in _jobs:
            _cancel_flags[job_id] = True
            return True
    return False


def _is_cancelled(job_id: str) -> bool:
    with _jobs_lock:
        return _cancel_flags.get(job_id, False)


# ----------------------------
# QR/BankID network logging
# ----------------------------

_log_lock = threading.Lock()

# Store captured BankID tokens per job (aid, autostart_token) for opening in new tab
_qr_captured: Dict[str, dict] = {}


def _log_session(msg: str, section: str = "", data: Optional[dict] = None) -> None:
    """Append to single session log file. Structured with timestamps and optional section."""
    try:
        with _log_lock:
            ts = datetime.now().strftime("%H:%M:%S")
            with open(SESSION_LOG_FILE, "a", encoding="utf-8") as f:
                if section:
                    f.write(f"\n[{ts}] [{section}] {msg}\n")
                else:
                    f.write(f"[{ts}] {msg}\n")
                if data:
                    f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"Session log error: {e}")


def _clear_session_log(job_id: str = "") -> None:
    """Clear and init log file at start of new session - overwrites previous."""
    try:
        with _log_lock:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(SESSION_LOG_FILE, "w", encoding="utf-8") as f:
                f.write("=" * 60 + "\n")
                f.write(f"  FLYTTANMÄLAN SESSION  |  {ts}  |  job: {job_id}\n")
                f.write("=" * 60 + "\n\n")
    except Exception as e:
        print(f"Session log clear error: {e}")


def _log_qr_data(label: str, data: str | dict) -> None:
    """Append QR/BankID-related data to session log."""
    payload = data if isinstance(data, dict) else {"msg": str(data)}
    _log_session(label, "QR/AUTH", payload)


# ----------------------------
# Proxy: strip X-Frame-Options for iframe embedding
# ----------------------------

def _strip_frame_restrictions(csp: str) -> str:
    """Remove or relax frame-ancestors from CSP so iframe can embed."""
    if not csp:
        return ""
    parts = []
    for part in csp.split(";"):
        part = part.strip()
        if part.lower().startswith("frame-ancestors"):
            continue
        if part:
            parts.append(part)
    return "; ".join(parts)


def _inject_base_tag(html: str, base_url: str) -> str:
    """Inject <base href="..."> so relative URLs resolve correctly when served from proxy."""
    base_href = urljoin(base_url + "/" if not base_url.endswith("/") else base_url, ".")
    base_tag = f'<base href="{base_href}">'
    if re.search(r"<head[^>]*>", html, re.I):
        html = re.sub(r"(<head[^>]*>)", r"\1\n  " + base_tag, html, count=1, flags=re.I)
    else:
        html = base_tag + "\n" + html
    return html


@app.get("/proxy")
def proxy_route():
    target = request.args.get("url", "").strip()
    if not target or not target.startswith(("http://", "https://")):
        return "Invalid or missing url parameter", 400

    try:
        resp = requests.get(
            target,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*;q=0.9"},
            allow_redirects=True,
            timeout=30,
            stream=True,
        )
    except requests.RequestException as e:
        return f"Proxy error: {e}", 502

    excluded_headers = [
        "x-frame-options",
        "content-security-policy",
        "content-security-policy-report-only",
        "x-content-type-options",
    ]

    def generate():
        content_type = resp.headers.get("content-type", "")
        is_html = "text/html" in content_type

        if is_html:
            body = b""
            for chunk in resp.iter_content(chunk_size=8192):
                body += chunk
            try:
                text = body.decode("utf-8", errors="replace")
                text = _inject_base_tag(text, resp.url)
                yield text.encode("utf-8")
            except Exception:
                yield body
        else:
            for chunk in resp.iter_content(chunk_size=8192):
                yield chunk

    headers = {}
    csp = resp.headers.get("Content-Security-Policy") or resp.headers.get("content-security-policy")
    for k, v in resp.headers.items():
        kl = k.lower()
        if kl in excluded_headers:
            if kl == "content-security-policy" and v:
                relaxed = _strip_frame_restrictions(v)
                if relaxed:
                    headers["Content-Security-Policy"] = relaxed
            continue
        if kl not in ("transfer-encoding", "content-encoding"):
            headers[k] = v

    return Response(
        generate(),
        status=resp.status_code,
        headers=headers,
        content_type=resp.headers.get("Content-Type", "text/html; charset=utf-8"),
    )


# ----------------------------
# Playwright: open URL in new window (no iframe)
# ----------------------------

def _open_playwright_window(url: str) -> None:
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded")
    except Exception as e:
        print(f"Playwright open error: {e}")


# ----------------------------
# Core: Fill Watch job
# ----------------------------

def _run_playwright_job(
    job_id: str,
    url: str,
    timeout_seconds: float,
    click_after_seconds_0: Optional[float] = None,
    click_selectors_0: Optional[list[str]] = None,
    click_after_seconds: Optional[float] = None,
    click_selectors: Optional[list[str]] = None,
    click_after_seconds_2: Optional[float] = None,
    click_selectors_2: Optional[list[str]] = None,
    click_after_seconds_3: Optional[float] = None,
    click_selectors_3: Optional[list[str]] = None,
) -> None:
    job = _get_job(job_id)
    if not job:
        return

    job.state = "running"
    job.started_at = time.time()
    job.message = "Startar webbläsare..."
    _set_job(job)

    # New session: clear previous logs and captured data
    _clear_session_log(job_id)
    with _log_lock:
        _qr_captured.clear()

    screenshot_file = os.path.join(RESULT_DIR, f"{job_id}.png")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            page = browser.new_page()

            # Log QR/BankID-related network traffic; capture autostart token for "clone" tab
            def on_response(response):
                try:
                    resp_url = response.url
                    keywords = ("bankid", "auth", "status", "poll", "collect", "sign", "qr", "session")
                    if any(k in resp_url.lower() for k in keywords) or "api" in resp_url.lower():
                        ct = response.headers.get("content-type", "")
                        if "json" in ct:
                            try:
                                body = response.json()
                                _log_qr_data("RESPONSE", {"url": resp_url, "status": response.status, "body": body})
                            except Exception:
                                pass
                        else:
                            _log_qr_data("RESPONSE", {"url": resp_url, "status": response.status})

                        # Logged-in API signal: secure flytt endpoints become available after QR auth.
                        if "/secure/folkbokforing/flyttanmalan/" in resp_url.lower() and response.status == 200:
                            first_seen = False
                            with _log_lock:
                                if job_id not in _qr_captured:
                                    _qr_captured[job_id] = {}
                                if not _qr_captured[job_id].get("flytt_api_ready"):
                                    first_seen = True
                                _qr_captured[job_id]["flytt_api_ready"] = True
                                _qr_captured[job_id]["flytt_api_last_url"] = resp_url
                            if first_seen:
                                _log_qr_data("FORM_API_READY", {"url": resp_url, "status": response.status})

                        # Capture aid and full auth page URL (not /qr - that gives EM_MISSING_AUTH_ATTEMPT when opened directly)
                        if "aid=" in resp_url:
                            m = re.search(r"aid=([^&]+)", resp_url)
                            if m:
                                aid = m.group(1)
                                qr_page = f"https://auth.funktionstjanster.se/id/bankid/qr?aid={aid}"
                                with _log_lock:
                                    if job_id not in _qr_captured:
                                        _qr_captured[job_id] = {}
                                    _qr_captured[job_id]["aid"] = aid
                                    _qr_captured[job_id]["qr_page_url"] = qr_page
                                # Full auth SPA URL - capture from /web/app/ HTML page (has aid; exclude images)
                                if "/web/app/" in resp_url and "aid=" in resp_url and not any(x in resp_url.lower() for x in [".svg", ".png", ".jpg", ".ico"]):
                                    with _log_lock:
                                        _qr_captured[job_id]["auth_spa_url"] = resp_url

                        if "getautostarttoken" in resp_url.lower() and response.status == 200:
                            try:
                                body_text = response.text()
                                if body_text and len(body_text) < 500:
                                    aid = _qr_captured.get(job_id, {}).get("aid", "")
                                    if "aid=" in resp_url:
                                        m = re.search(r"aid=([^&]+)", resp_url)
                                        if m:
                                            aid = m.group(1)
                                    token = body_text.strip().strip('"')
                                    bankid_url = f"bankid:///?autostarttoken={token}&redirect=null"
                                    with _log_lock:
                                        if job_id not in _qr_captured:
                                            _qr_captured[job_id] = {}
                                        _qr_captured[job_id].update({
                                            "autostart_token": token,
                                            "bankid_url": bankid_url,
                                        })
                                    _log_qr_data("AUTOSTART_TOKEN_CAPTURED", {"aid": aid, "token": token[:20] + "...", "bankid_url": bankid_url})
                            except Exception:
                                pass
                except Exception:
                    pass

            page.on("response", on_response)

            job.message = f"Navigerar till: {url}"
            _set_job(job)
            _log_session(f"Navigate to {url}", "INIT")
            page.goto(url, wait_until="domcontentloaded")

            # ---- Click sequences 0-3 ----

            _log_session("Click sequences starting", "CLICKS")
            # Click sequence 0 (cookie banner)
            if click_after_seconds_0 and click_selectors_0:
                job.message = f"Klicksekvens 0 (cookie): väntar {click_after_seconds_0}s..."
                _set_job(job)
                time.sleep(click_after_seconds_0)
                if _is_cancelled(job_id):
                    job.state = "cancelled"
                    job.ended_at = time.time()
                    job.message = "Avbruten av användaren."
                    _set_job(job)
                    browser.close()
                    return
                clicked0 = False
                for sel in click_selectors_0:
                    sel = (sel or "").strip()
                    if not sel:
                        continue
                    try:
                        page.click(sel, timeout=3000)
                        if job.details and job.details.get("click_errors_0"):
                            job.details["click_warnings_nonblocking_0"] = job.details.get("click_errors_0", [])
                            job.details["click_errors_0"] = []
                            job.message = "Klickade på cookie-banner (fortsatte efter fallback-selector)."
                        else:
                            job.message = "Klickade på cookie-banner."
                        clicked0 = True
                        _set_job(job)
                        break
                    except Exception as e:
                        job.details = job.details or {}
                        job.details["click_errors_0"] = job.details.get("click_errors_0", []) + [f"{sel}: {e}"]
                        job.message = f"Cookie: misslyckades med {sel[:30]}..., provar nästa..."
                        _set_job(job)
                if not clicked0:
                    job.message = "Cookie-banner: ingen selector fungerade (kanske ingen banner). Fortsätter..."

            # Click sequence 1
            if click_after_seconds and click_selectors:
                job.message = f"Väntar {click_after_seconds}s, sedan klick på element..."
                _set_job(job)
                time.sleep(click_after_seconds)
                if _is_cancelled(job_id):
                    job.state = "cancelled"
                    job.ended_at = time.time()
                    job.message = "Avbruten av användaren."
                    _set_job(job)
                    browser.close()
                    return
                clicked = False
                for sel in click_selectors:
                    sel = (sel or "").strip()
                    if not sel:
                        continue
                    try:
                        page.click(sel, timeout=5000)
                        if job.details and job.details.get("click_errors"):
                            job.details["click_warnings_nonblocking_1"] = job.details.get("click_errors", [])
                            job.details["click_errors"] = []
                            job.message = f"Klickade på {sel}. Fortsatte efter fallback-selector i sekvens 1."
                        else:
                            job.message = f"Klickade på {sel}. Väntar på nästa steg..."
                        clicked = True
                        _set_job(job)
                        break
                    except Exception as e:
                        job.details = job.details or {}
                        job.details["click_errors"] = job.details.get("click_errors", []) + [f"{sel}: {e}"]
                        job.message = f"Misslyckades med {sel}, provar nästa..."
                        _set_job(job)
                if not clicked:
                    job.message = "Ingen klick-selector fungerade. Fortsätter bevaka fältet..."

            # Click sequence 2
            if click_after_seconds_2 and click_selectors_2:
                job.message = f"Klicksekvens 2: väntar {click_after_seconds_2}s..."
                _set_job(job)
                time.sleep(click_after_seconds_2)
                if _is_cancelled(job_id):
                    job.state = "cancelled"
                    job.ended_at = time.time()
                    job.message = "Avbruten av användaren."
                    _set_job(job)
                    browser.close()
                    return
                clicked2 = False
                for sel in click_selectors_2:
                    sel = (sel or "").strip()
                    if not sel:
                        continue
                    try:
                        page.click(sel, timeout=5000)
                        if job.details and job.details.get("click_errors_2"):
                            job.details["click_warnings_nonblocking_2"] = job.details.get("click_errors_2", [])
                            job.details["click_errors_2"] = []
                            job.message = f"Klickade på {sel} (sekvens 2). Fortsatte efter fallback-selector."
                        else:
                            job.message = f"Klickade på {sel} (sekvens 2). Väntar på nästa steg..."
                        clicked2 = True
                        _set_job(job)
                        break
                    except Exception as e:
                        job.details = job.details or {}
                        job.details["click_errors_2"] = job.details.get("click_errors_2", []) + [f"{sel}: {e}"]
                        job.message = f"Sekvens 2: misslyckades med {sel}, provar nästa..."
                        _set_job(job)
                if not clicked2:
                    job.message = "Klicksekvens 2: ingen selector fungerade. Fortsätter bevaka fältet..."

            # Click sequence 3 (QR code - opens in new tab)
            popup_page_ref = None
            if click_after_seconds_3 and click_selectors_3:
                job.message = f"Klicksekvens 3: väntar {click_after_seconds_3}s (QR-kod)..."
                _set_job(job)
                time.sleep(click_after_seconds_3)
                if _is_cancelled(job_id):
                    job.state = "cancelled"
                    job.ended_at = time.time()
                    job.message = "Avbruten av användaren."
                    _set_job(job)
                    browser.close()
                    return
                clicked3 = False
                for sel in click_selectors_3:
                    sel = (sel or "").strip()
                    if not sel:
                        continue
                    try:
                        try:
                            qr_info = page.evaluate("""() => {
                                const links = Array.from(document.querySelectorAll('a[href*="bankid"], a[href*="redirect"], [data-qr-url], [data-autostart]'));
                                return links.map(el => ({
                                    href: el.href || el.getAttribute('href'),
                                    'data-qr-url': el.getAttribute('data-qr-url'),
                                    'data-autostart': el.getAttribute('data-autostart'),
                                    text: (el.textContent || '').slice(0, 100)
                                })).filter(x => x.href || x['data-qr-url'] || x['data-autostart']);
                            }""")
                            if qr_info:
                                _log_qr_data("QR_URL_FROM_PAGE", qr_info)
                        except Exception:
                            pass

                        got_popup = False
                        try:
                            with page.context.expect_page(timeout=3000) as popup_info:
                                page.click(sel, timeout=5000)
                            popup_page = popup_info.value
                            got_popup = True
                            popup_page_ref = popup_page
                            _log_qr_data("QR_NEW_TAB_URL", {"url": popup_page.url})
                        except Exception:
                            pass

                        if job.details and job.details.get("click_errors_3"):
                            job.details["click_warnings_nonblocking_3"] = job.details.get("click_errors_3", [])
                            job.details["click_errors_3"] = []
                            job.message = f"Klickade på {sel} (sekvens 3, QR). Fortsatte efter fallback-selector."
                        else:
                            job.message = f"Klickade på {sel} (sekvens 3, QR)."
                        clicked3 = True
                        _log_qr_data("QR_CLICK", {"selector": sel, "job_id": job_id})
                        _set_job(job)

                        bankid_url = None
                        with _log_lock:
                            cap = _qr_captured.get(job_id, {})
                        bankid_url = cap.get("bankid_url")

                        # Clone tab fallback: when QR click doesn't open a popup,
                        # we open a clone to the auth URL so the user can see and scan the QR code.
                        # Without this, there's no visible QR if the browser doesn't create a popup.
                        # Controlled by CLONE_TAB_FALLBACK in config.txt (default: off).
                        if not got_popup:
                            cfg = _load_config()
                            clone_enabled = cfg.get("CLONE_TAB_FALLBACK", "") in ("y", "yes", "1", "true")
                            if clone_enabled:
                                clone_url = cap.get("auth_spa_url")
                                if not clone_url and cap.get("aid"):
                                    clone_url = f"https://auth.funktionstjanster.se/web/app/v2/68a6db1b897fa1039c3b3d40/67dace697e15efe89cf3d575/?lang=sv&aid={cap['aid']}"
                                if clone_url:
                                    try:
                                        clone_page = browser.new_page()
                                        clone_page.goto(clone_url, wait_until="domcontentloaded", timeout=30000)
                                        _log_qr_data("QR_CLONE_OPENED", {"url": clone_url})
                                    except Exception as e:
                                        _log_qr_data("QR_CLONE_ERROR", str(e))
                            else:
                                _log_qr_data("QR_NO_POPUP_NO_CLONE", {"reason": "CLONE_TAB_FALLBACK not enabled"})

                        if bankid_url:
                            _log_qr_data("BANKID_URL_AVAILABLE", {"url": bankid_url})
                        break
                    except Exception as e:
                        job.details = job.details or {}
                        job.details["click_errors_3"] = job.details.get("click_errors_3", []) + [f"{sel}: {e}"]
                        job.message = f"Sekvens 3: misslyckades med {sel}, provar nästa..."
                        _set_job(job)
                if not clicked3:
                    job.message = "Klicksekvens 3: ingen selector fungerade. Fortsätter bevaka fältet..."

            # ---- END click sequences ----

            # ---- Wait for login, detect form wizard, run form filler, save HTML ----
            _normal_browser_opened = False
            _form_filler_done = False

            job.message = "Väntar på inloggning (QR)..."
            _set_job(job)

            start = time.time()
            flytt_page = None
            _debug_count = 0
            ready_streak = 0
            ready_source = ""

            # Phase 1: Wait for stable readiness signal after QR login
            while (time.time() - start) < timeout_seconds:
                if _is_cancelled(job_id):
                    job.state = "cancelled"
                    job.ended_at = time.time()
                    job.message = "Avbruten av användaren."
                    _log_session("Session cancelled by user", "DONE")
                    try:
                        page.screenshot(path=screenshot_file, full_page=True)
                        job.screenshot_path = f"{job_id}.png"
                    except Exception:
                        pass
                    _set_job(job)
                    browser.close()
                    return

                with _log_lock:
                    api_ready = bool(_qr_captured.get(job_id, {}).get("flytt_api_ready"))

                all_pages = _get_all_pages_for_form(page)
                candidate_page, candidate_source, source_signals, other_signals = _pick_form_page(
                    page, popup_page_ref, api_ready, all_pages
                )

                if candidate_source == "popup":
                    popup_signals = source_signals
                    main_signals = other_signals
                elif candidate_source == "main":
                    main_signals = source_signals
                    popup_signals = other_signals
                else:
                    main_signals = source_signals
                    popup_signals = other_signals

                # Debug: log what we see every 5 seconds
                _debug_count += 1
                if _debug_count % 5 == 0:
                    elapsed = int(time.time() - start)
                    status_bits = (
                        f"main(form={main_signals.get('has_form')},wiz={main_signals.get('has_wizard_step')},"
                        f"active={main_signals.get('has_active_step')},next={main_signals.get('has_next_host')})"
                    )
                    if popup_signals:
                        status_bits += (
                            f", popup(form={popup_signals.get('has_form')},wiz={popup_signals.get('has_wizard_step')},"
                            f"active={popup_signals.get('has_active_step')},next={popup_signals.get('has_next_host')})"
                        )
                    status_bits += f", api_ready={api_ready}, streak={ready_streak}/2"
                    job.message = f"Väntar på formulär ({elapsed}s)... {status_bits}"
                    _set_job(job)
                    _log_session(
                        f"Waiting for form ({elapsed}s)",
                        "FORM_WAIT",
                        {
                            "api_ready": api_ready,
                            "candidate_source": candidate_source,
                            "tabs_checked": len(all_pages) if all_pages else 0,
                            "streak": f"{ready_streak}/2",
                        },
                    )

                if candidate_page:
                    if ready_source == candidate_source:
                        ready_streak += 1
                    else:
                        ready_source = candidate_source
                        ready_streak = 1

                    if ready_streak == 1:
                        _log_qr_data(
                            "FORM_READY_CANDIDATE",
                            {"source": candidate_source, "api_ready": api_ready, "signals": source_signals},
                        )

                    if ready_streak >= 2:
                        flytt_page = candidate_page
                        _log_session(
                            f"Form detected on {candidate_source}",
                            "FORM_DETECT",
                            {"url": flytt_page.url, "signals": source_signals},
                        )
                        job.message = f"Formulär hittat på {candidate_source}, startar ifyllning..."
                        _set_job(job)
                        time.sleep(1.5)
                        break
                else:
                    ready_streak = 0
                    ready_source = ""

                    # Fallback: on flytt URL but form not detected - scroll down (Nästa below fold),
                    # then try clicking first Nästa. Check ALL tabs (form often opens in new tab after BankID).
                    if _debug_count % 10 == 1:
                        for try_page in all_pages or [page, popup_page_ref]:
                            if try_page is None or try_page.is_closed():
                                continue
                            try:
                                url = try_page.url or ""
                                if "flytt" not in url.lower():
                                    continue
                                # Scroll down first - Nästa is often below viewport on intro page
                                try_page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                                time.sleep(0.5)
                                # Playwright pierces shadow DOM; try primary + text fallback
                                loc = try_page.locator(FORM_NEXT_HOST_SELECTOR)
                                if loc.count() > 0:
                                    loc.first.scroll_into_view_if_needed()
                                    time.sleep(0.3)
                                    loc.first.click(timeout=3000)
                                    _log_qr_data("NÄSTA_FALLBACK_CLICK", {"url": url[:60]})
                                    job.message = "Klickade på Nästa (fallback), väntar på formulär..."
                                    _set_job(job)
                                    time.sleep(2.0)
                                    break
                                # Fallback: button with "Nästa" text (pierces shadow DOM)
                                alt_loc = try_page.get_by_role("button", name="Nästa")
                                if alt_loc.count() > 0:
                                    alt_loc.first.scroll_into_view_if_needed()
                                    time.sleep(0.3)
                                    alt_loc.first.click(timeout=3000)
                                    _log_qr_data("NÄSTA_FALLBACK_CLICK", {"url": url[:60], "selector": "role"})
                                    job.message = "Klickade på Nästa (fallback), väntar på formulär..."
                                    _set_job(job)
                                    time.sleep(2.0)
                                    break
                            except Exception as e:
                                _log_qr_data("NÄSTA_FALLBACK_FAIL", {"error": str(e)})

                time.sleep(1.0)

            if not flytt_page:
                with _log_lock:
                    api_ready = bool(_qr_captured.get(job_id, {}).get("flytt_api_ready"))
                all_pages = _get_all_pages_for_form(page)
                candidate_page, candidate_source, source_signals, _ = _pick_form_page(
                    page, popup_page_ref, api_ready, all_pages
                )
                if candidate_page:
                    flytt_page = candidate_page
                    _log_session(
                        f"Form detected late on {candidate_source}",
                        "FORM_DETECT",
                        {"url": flytt_page.url, "signals": source_signals},
                    )

            if flytt_page and not _normal_browser_opened:
                cfg = _load_config()
                if cfg.get("POPUP_BROWSER_NORMAL_WINDOW", "") in ("y", "yes", "1", "true"):
                    try:
                        webbrowser.open(flytt_page.url)
                        _normal_browser_opened = True
                        _log_session("Opened form URL in default browser (POPUP_BROWSER_NORMAL_WINDOW)", "FORM_DETECT")
                    except Exception:
                        pass

            # Phase 2: Run form filler (output goes to session log)
            if flytt_page:
                try:
                    from formulär.flytt_form_filler import run_flytt_form_filler

                    def _form_log(msg: str) -> None:
                        _log_session(msg.strip(), "FORM")

                    job.message = "Fyller flyttformulär..."
                    _set_job(job)
                    _log_session("Starting form filler", "FORM")
                    run_flytt_form_filler(flytt_page, lambda: _is_cancelled(job_id), log_callback=_form_log)
                    _form_filler_done = True
                except Exception as e:
                    job.details = job.details or {}
                    job.details["flytt_filler_error"] = str(e)
                    _log_session(f"Form filler error: {e}", "FORM")

            # Phase 3: Save full page HTML snapshot
            try:
                save_page = flytt_page or page
                html_content = save_page.content()
                html_path = os.path.join(SCRIPT_DIR, "senaste_formulär.html")
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
            except Exception:
                pass

            try:
                final_page = flytt_page or page
                final_page.screenshot(path=screenshot_file, full_page=True)
                job.screenshot_path = f"{job_id}.png"
            except Exception:
                job.screenshot_path = None

            job.ended_at = time.time()

            if _form_filler_done:
                job.state = "matched"
                job.message = "Formulär ifyllt! Se skv6_session_log.txt + senaste_formulär.html"
                _log_session("Session completed successfully", "DONE")
            elif job.state != "cancelled":
                job.state = "timeout"
                job.message = "Timeout: formuläret hittades inte inom vald tid (inloggning klar?)."
                _log_session("Session ended: form not found within timeout", "DONE")

            _set_job(job)

    except Exception as e:
        job.state = "error"
        job.ended_at = time.time()
        job.message = f"Fel: {e}"
        _log_session(f"Session error: {e}", "DONE")
        _set_job(job)


# ----------------------------
# Web UI
# ----------------------------

INDEX_HTML = """
<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Flyttanmälan – Auto</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; max-width: 980px; }
    label { display:block; font-size: 13px; margin-top: 10px; color: #333; }
    input, select { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #ccc; }
    button { padding: 10px 14px; border-radius: 10px; border: 1px solid #333; background: #111; color: #fff; cursor: pointer; }
    button.secondary { background: #fff; color: #111; border-color: #111; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .status { white-space: pre-wrap; background: #f7f7f7; border-radius: 10px; padding: 12px; border: 1px solid #eee; }
    .small { font-size: 12px; color: #666; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    img { max-width: 100%; border-radius: 10px; border: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>Flyttanmälan – Auto</h1>
  <p class="small">
    Klicksekvenser → QR-inloggning → formuläret fylls automatiskt.
    Logg: <code>skv6_session_log.txt</code> (en fil per session, överskriver föregående)
  </p>

  <div class="card">
    <h2>1) Logga in och fyll formulär</h2>

    <div class="row">
      <div style="flex: 2; min-width: 280px;">
        <label>URL att öppna</label>
        <input id="targetUrl" value="https://www7.skatteverket.se/portal/flyttanmalan/" />
      </div>
      <div style="flex: 1; min-width: 220px;">
        <label>Timeout (sekunder)</label>
        <input id="timeoutSeconds" type="number" min="1" value="300" />
      </div>
    </div>

    <div class="row" style="margin-top: 12px;">
      <div style="flex: 1; min-width: 140px;">
        <label>Klicksekvens 0: vänta (sek) – cookie-banner</label>
        <input id="clickAfterSeconds0" type="number" min="0" step="0.5" value="1.5" placeholder="0 = ingen" />
      </div>
      <div style="flex: 2; min-width: 280px;">
        <label>Klicksekvens 0: selectors (primär: nödvändiga, backup: alla)</label>
        <textarea id="clickSelectors0" class="mono" rows="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ccc; resize:vertical;">#deny-all
skv-button-8-6-2#deny-all
button:has-text("Tillåt endast nödvändiga")
#accept-all</textarea>
      </div>
    </div>

    <div class="row" style="margin-top: 12px;">
      <div style="flex: 1; min-width: 140px;">
        <label>Klicksekvens 1: vänta (sek)</label>
        <input id="clickAfterSeconds" type="number" min="0" step="0.5" value="3" placeholder="0 = ingen" />
      </div>
      <div style="flex: 2; min-width: 280px;">
        <label>Klicksekvens 1: selectors (en per rad)</label>
        <textarea id="clickSelectors" class="mono" rows="4" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ccc; resize:vertical;">a[aria-label*="Inloggning"]
button#login-info-button
slot.fin-skv-button-label
span.fin-skv-button-spinner</textarea>
      </div>
    </div>

    <div class="row" style="margin-top: 12px;">
      <div style="flex: 1; min-width: 140px;">
        <label>Klicksekvens 2: vänta (sek)</label>
        <input id="clickAfterSeconds2" type="number" min="0" step="0.5" value="3" placeholder="0 = ingen" />
      </div>
      <div style="flex: 2; min-width: 280px;">
        <label>Klicksekvens 2: selectors (BankID-knapp)</label>
        <textarea id="clickSelectors2" class="mono" rows="2" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ccc; resize:vertical;">button#bankid-standard
#bankid-standard</textarea>
      </div>
    </div>

    <div class="row" style="margin-top: 12px;">
      <div style="flex: 1; min-width: 140px;">
        <label>Klicksekvens 3: vänta (sek)</label>
        <input id="clickAfterSeconds3" type="number" min="0" step="0.5" value="3" placeholder="0 = ingen" />
      </div>
      <div style="flex: 2; min-width: 280px;">
        <label>Klicksekvens 3: selectors (QR-kod, öppnar i ny flik)</label>
        <textarea id="clickSelectors3" class="mono" rows="3" style="width:100%; padding:10px; border-radius:10px; border:1px solid #ccc; resize:vertical;">path[fill='#FFFFFF']
path[fill='#000000']
svg path</textarea>
      </div>
    </div>

    <div style="margin-top: 14px; display:flex; gap:10px; flex-wrap:wrap;">
      <button id="startBtn" onclick="startJob()">Starta</button>
      <button class="secondary" id="cancelBtn" onclick="cancelJob()" disabled>Avbryt</button>
    </div>

    <h3 style="margin-top: 16px;">Status</h3>
    <div id="status" class="status">Ingen körning ännu.</div>
    <div id="shotWrap" style="margin-top: 12px; display:none;">
      <h3>Screenshot</h3>
      <img id="shot" />
    </div>
  </div>

  <div class="card" style="margin-top: 16px;">
    <h2>2) Visa sida (kringgå iframe-blockering)</h2>
    <div class="row">
      <div style="flex: 2; min-width: 280px;">
        <label>URL att visa</label>
        <input id="iframeUrl" value="https://www7.skatteverket.se/portal/flyttanmalan/" />
      </div>
    </div>
    <div class="row" style="margin-top: 12px; gap: 10px; flex-wrap: wrap;">
      <div>
        <label>Metod</label>
        <select id="viewMode">
          <option value="direct">Direkt iframe</option>
          <option value="proxy">Proxy-läge</option>
          <option value="playwright">Playwright-fönster</option>
        </select>
      </div>
      <div style="align-self: end;">
        <button onclick="openView()">Öppna</button>
      </div>
    </div>
  </div>

<script>
let currentJobId = null;
let pollTimer = null;

function setStatus(obj) {
  const el = document.getElementById("status");
  el.textContent = JSON.stringify(obj, null, 2);
  const wrap = document.getElementById("shotWrap");
  const img = document.getElementById("shot");
  if (obj && obj.screenshot_path) {
    img.src = "/results/" + obj.screenshot_path + "?t=" + Date.now();
    wrap.style.display = "block";
  } else {
    wrap.style.display = "none";
  }
  const running = obj && (obj.state === "running" || obj.state === "queued");
  document.getElementById("startBtn").disabled = running;
  document.getElementById("cancelBtn").disabled = !running;
}

async function startJob() {
  const lineBreak = new RegExp("[\\r\\n]+");
  const clickAfter0 = Number(document.getElementById("clickAfterSeconds0").value || 0);
  const clickSelRaw0 = document.getElementById("clickSelectors0").value.trim();
  const clickSelectors0 = clickSelRaw0 ? clickSelRaw0.split(lineBreak).map(function(s){ return s.trim(); }).filter(Boolean) : [];
  const clickAfter = Number(document.getElementById("clickAfterSeconds").value || 0);
  const clickSelRaw = document.getElementById("clickSelectors").value.trim();
  const clickSelectors = clickSelRaw ? clickSelRaw.split(lineBreak).map(function(s){ return s.trim(); }).filter(Boolean) : [];
  const clickAfter2 = Number(document.getElementById("clickAfterSeconds2").value || 0);
  const clickSelRaw2 = document.getElementById("clickSelectors2").value.trim();
  const clickSelectors2 = clickSelRaw2 ? clickSelRaw2.split(lineBreak).map(function(s){ return s.trim(); }).filter(Boolean) : [];
  const clickAfter3 = Number(document.getElementById("clickAfterSeconds3").value || 0);
  const clickSelRaw3 = document.getElementById("clickSelectors3").value.trim();
  const clickSelectors3 = clickSelRaw3 ? clickSelRaw3.split(lineBreak).map(function(s){ return s.trim(); }).filter(Boolean) : [];

  const payload = {
    url: document.getElementById("targetUrl").value.trim(),
    timeout_seconds: Number(document.getElementById("timeoutSeconds").value || 120),
    click_after_seconds_0: clickAfter0 > 0 ? clickAfter0 : null,
    click_selectors_0: clickAfter0 > 0 && clickSelectors0.length ? clickSelectors0 : null,
    click_after_seconds: clickAfter > 0 ? clickAfter : null,
    click_selectors: clickAfter > 0 && clickSelectors.length ? clickSelectors : null,
    click_after_seconds_2: clickAfter2 > 0 ? clickAfter2 : null,
    click_selectors_2: clickAfter2 > 0 && clickSelectors2.length ? clickSelectors2 : null,
    click_after_seconds_3: clickAfter3 > 0 ? clickAfter3 : null,
    click_selectors_3: clickAfter3 > 0 && clickSelectors3.length ? clickSelectors3 : null,
  };

  const res = await fetch("/api/run", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  currentJobId = data.job_id;
  setStatus(data);

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollStatus, 800);
}

async function pollStatus() {
  if (!currentJobId) return;
  const res = await fetch("/api/status/" + encodeURIComponent(currentJobId));
  const data = await res.json();
  setStatus(data);
  if (["matched","timeout","error","cancelled"].includes(data.state)) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function cancelJob() {
  if (!currentJobId) return;
  await fetch("/api/cancel/" + encodeURIComponent(currentJobId), { method: "POST" });
}

function openView() {
  const url = document.getElementById("iframeUrl").value.trim();
  const mode = document.getElementById("viewMode").value;

  if (mode === "playwright") {
    fetch("/api/open-playwright", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ url }),
    }).then(r => r.json()).then(d => {
      if (d.error) alert(d.error);
    });
    return;
  }

  const targetUrl = mode === "proxy" ? "/iframe?url=" + encodeURIComponent(url) + "&mode=proxy" : "/iframe?url=" + encodeURIComponent(url) + "&mode=direct";
  const w = window.open(targetUrl, "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!w) alert("Popup blockerade fönstret. Tillåt popups för localhost.");
}
</script>

</body>
</html>
"""

IFRAME_HTML = """
<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Visa sida</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
    header { display:flex; gap:10px; padding: 10px; border-bottom: 1px solid #ddd; align-items:center; }
    input { flex: 1; padding: 10px; border-radius: 10px; border: 1px solid #ccc; }
    button { padding: 10px 14px; border-radius: 10px; border: 1px solid #333; background: #111; color:#fff; cursor:pointer; }
    select { padding: 8px; border-radius: 8px; border: 1px solid #ccc; }
    iframe { width: 100%; height: calc(100vh - 62px); border: 0; }
    .small { font-size: 12px; color: #666; padding: 0 10px 10px 10px; }
  </style>
</head>
<body>
  <header>
    <input id="url" placeholder="https://..." />
    <select id="mode">
      <option value="direct">Direkt</option>
      <option value="proxy">Proxy (bypass X-Frame-Options)</option>
    </select>
    <button onclick="go()">Go</button>
  </header>
  <div class="small">Proxy-läge: sidan hämtas via server och blockering tas bort.</div>
  <iframe id="frame"></iframe>

<script>
function go() {
  const u = document.getElementById("url").value.trim();
  const mode = document.getElementById("mode").value;
  const frame = document.getElementById("frame");
  frame.src = (mode === "proxy" && u) ? "/proxy?url=" + encodeURIComponent(u) : (u || "about:blank");
}
const params = new URLSearchParams(window.location.search);
const initial = params.get("url") || "https://example.com";
const modeParam = params.get("mode") || "direct";
document.getElementById("url").value = initial;
document.getElementById("mode").value = modeParam;
go();
</script>
</body>
</html>
"""


@app.get("/")
def index():
    return render_template_string(INDEX_HTML)


@app.get("/iframe")
def iframe_window():
    return render_template_string(IFRAME_HTML)


@app.get("/results/<path:filename>")
def results(filename: str):
    return send_from_directory(RESULT_DIR, filename)


@app.post("/api/run")
def api_run():
    data = request.get_json(force=True) or {}

    url = (data.get("url") or "").strip()
    timeout_seconds = float(data.get("timeout_seconds") or 120)

    def parse_click(key_after, key_selectors):
        after = data.get(key_after)
        sels = data.get(key_selectors)
        if isinstance(sels, list):
            sels = [s for s in sels if s and isinstance(s, str)]
        elif isinstance(sels, str):
            sels = [s.strip() for s in sels.splitlines() if s.strip()]
        else:
            sels = None
        if after is not None:
            after = float(after) if float(after) > 0 else None
        return after, sels

    click_after_0, click_selectors_0 = parse_click("click_after_seconds_0", "click_selectors_0")
    click_after, click_selectors = parse_click("click_after_seconds", "click_selectors")
    click_after_2, click_selectors_2 = parse_click("click_after_seconds_2", "click_selectors_2")
    click_after_3, click_selectors_3 = parse_click("click_after_seconds_3", "click_selectors_3")

    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "URL måste börja med http:// eller https://"}), 400

    job_id = uuid.uuid4().hex[:12]
    job = JobStatus(job_id=job_id, state="queued", message="Köad...")
    _set_job(job)

    t = threading.Thread(
        target=_run_playwright_job,
        args=(job_id, url, timeout_seconds),
        kwargs={
            "click_after_seconds_0": click_after_0,
            "click_selectors_0": click_selectors_0,
            "click_after_seconds": click_after,
            "click_selectors": click_selectors,
            "click_after_seconds_2": click_after_2,
            "click_selectors_2": click_selectors_2,
            "click_after_seconds_3": click_after_3,
            "click_selectors_3": click_selectors_3,
        },
        daemon=True,
    )
    t.start()

    return jsonify(asdict(job))


@app.get("/api/status/<job_id>")
def api_status(job_id: str):
    job = _get_job(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify(asdict(job))


@app.post("/api/cancel/<job_id>")
def api_cancel(job_id: str):
    ok = _cancel_job(job_id)
    return jsonify({"ok": ok})


@app.post("/api/open-playwright")
def api_open_playwright():
    data = request.get_json(force=True) or {}
    url = (data.get("url") or "").strip()
    if not url.startswith(("http://", "https://")):
        return jsonify({"error": "Ogiltig URL"}), 400

    t = threading.Thread(target=_open_playwright_window, args=(url,), daemon=True)
    t.start()
    return jsonify({"ok": True, "message": "Öppnar i Playwright-fönster..."})


def main():
    url = f"http://{APP_HOST}:{APP_PORT}/"
    try:
        webbrowser.open_new(url)
    except Exception:
        pass

    print(f"Server kör på {url}")
    print("Tryck Ctrl+C för att stoppa.")
    app.run(host=APP_HOST, port=APP_PORT, debug=False, threaded=True)


if __name__ == "__main__":
    main()
