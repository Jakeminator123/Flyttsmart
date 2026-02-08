import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup


DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36"


def safe_slug(text: str, max_len: int = 80) -> str:
    text = unquote(text)
    text = re.sub(r"[^a-zA-Z0-9._-]+", "_", text).strip("_")
    return text[:max_len] if text else "root"


def guess_ext(content_type: Optional[str], url_path: str) -> str:
    # Try extension from URL path first
    ext = Path(url_path).suffix.lower()
    if ext and len(ext) <= 10:
        return ext

    if not content_type:
        return ""

    ct = content_type.split(";")[0].strip().lower()
    mapping = {
        "text/css": ".css",
        "text/javascript": ".js",
        "application/javascript": ".js",
        "application/json": ".json",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/svg+xml": ".svg",
        "font/woff2": ".woff2",
        "font/woff": ".woff",
        "application/font-woff": ".woff",
        "application/octet-stream": "",
        "text/plain": ".txt",
        "text/html": ".html",
    }
    return mapping.get(ct, "")


def is_data_url(u: str) -> bool:
    return u.strip().lower().startswith("data:")


def normalize_url(base_url: str, ref: str) -> Optional[str]:
    if not ref:
        return None
    ref = ref.strip()
    if is_data_url(ref):
        return None
    # Ignore anchors + javascript: links
    if ref.startswith("#") or ref.lower().startswith("javascript:"):
        return None
    return urljoin(base_url, ref)


def parse_srcset(srcset: str) -> List[str]:
    # Very simple srcset parser: "url1 1x, url2 2x" -> ["url1", "url2"]
    results = []
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        url = part.split()[0].strip()
        if url:
            results.append(url)
    return results


def make_asset_filename(url: str, content_type: Optional[str]) -> str:
    parsed = urlparse(url)
    ext = guess_ext(content_type, parsed.path)
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
    return f"{h}{ext}"


def download_url(
    session: requests.Session,
    url: str,
    out_path: Path,
    max_bytes: int,
    timeout: int = 30,
) -> Tuple[bool, Optional[str], int]:
    """
    Returns (ok, content_type, size_bytes)
    """
    try:
        with session.get(url, stream=True, timeout=timeout, allow_redirects=True) as r:
            r.raise_for_status()
            content_type = r.headers.get("Content-Type")
            total = 0
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 64):
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > max_bytes:
                        return False, content_type, total
                    f.write(chunk)
            return True, content_type, total
    except Exception:
        return False, None, 0


def collect_asset_refs(soup: BeautifulSoup) -> List[Tuple[object, str, str]]:
    """
    Returns list of (tag, attr_name, attr_value)
    """
    refs = []

    # CSS
    for tag in soup.find_all("link"):
        rel = " ".join(tag.get("rel", [])).lower()
        href = tag.get("href")
        if href and ("stylesheet" in rel or tag.get("as") == "style"):
            refs.append((tag, "href", href))

    # JS
    for tag in soup.find_all("script"):
        src = tag.get("src")
        if src:
            refs.append((tag, "src", src))

    # Images
    for tag in soup.find_all(["img", "source"]):
        src = tag.get("src")
        if src:
            refs.append((tag, "src", src))
        srcset = tag.get("srcset")
        if srcset:
            refs.append((tag, "srcset", srcset))

    # Video/audio poster/src
    for tag in soup.find_all(["video", "audio"]):
        src = tag.get("src")
        if src:
            refs.append((tag, "src", src))
        poster = tag.get("poster")
        if poster:
            refs.append((tag, "poster", poster))

    return refs


def main() -> int:
    parser = argparse.ArgumentParser(description="Save a single web page (HTML) plus its referenced assets locally.")
    parser.add_argument("url", nargs="?", help="Page URL to download (if omitted, you will be prompted).")
    parser.add_argument("--out", default="saved_pages", help="Output root directory.")
    parser.add_argument("--no-assets", action="store_true", help="Only save HTML + url.txt (no assets).")
    parser.add_argument("--max-assets", type=int, default=200, help="Maximum number of assets to download.")
    parser.add_argument("--max-asset-bytes", type=int, default=15_000_000, help="Max size per asset (bytes).")
    parser.add_argument("--max-html-bytes", type=int, default=8_000_000, help="Max size for HTML (bytes).")
    args = parser.parse_args()

    url = args.url
    if not url:
        url = input("Klistra in URL: ").strip()

    if not url:
        print("Ingen URL angiven.")
        return 2

    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url

    parsed = urlparse(url)
    if not parsed.netloc:
        print("Ogiltig URL.")
        return 2

    timestamp = time.strftime("%Y%m%d-%H%M%S")
    folder_name = f"{safe_slug(parsed.netloc)}_{safe_slug(parsed.path)}_{timestamp}"
    out_dir = Path(args.out) / folder_name
    assets_dir = out_dir / "assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Session
    session = requests.Session()
    session.headers.update({"User-Agent": DEFAULT_UA})

    # Save URL
    (out_dir / "url.txt").write_text(url + "\n", encoding="utf-8")

    # Download HTML
    html_path = out_dir / "index.html"
    try:
        r = session.get(url, timeout=30, allow_redirects=True)
        r.raise_for_status()
        html = r.text
        if len(html.encode("utf-8")) > args.max_html_bytes:
            print("HTML är större än maxgränsen. Avbryter.")
            return 1
    except Exception as e:
        print(f"Kunde inte hämta HTML: {e}")
        return 1

    # If no assets requested, just save raw HTML
    if args.no_assets:
        html_path.write_text(html, encoding="utf-8")
        print(f"Sparade: {html_path}")
        return 0

    soup = BeautifulSoup(html, "lxml")

    refs = collect_asset_refs(soup)

    manifest: Dict[str, Dict[str, object]] = {
        "page_url": url,
        "saved_at": timestamp,
        "assets": {},
    }

    downloaded = 0

    def download_and_rewrite_single(ref_url: str) -> Optional[str]:
        nonlocal downloaded

        abs_url = normalize_url(url, ref_url)
        if not abs_url:
            return None

        # Deduplicate
        if abs_url in manifest["assets"]:
            return str(manifest["assets"][abs_url]["local_path"])

        if downloaded >= args.max_assets:
            return None

        tmp_name = make_asset_filename(abs_url, None)
        local_path = assets_dir / tmp_name

        ok, content_type, size_bytes = download_url(
            session=session,
            url=abs_url,
            out_path=local_path,
            max_bytes=args.max_asset_bytes,
        )

        if not ok:
            # If failed due to unknown ext, or size limit, remove partial file if exists
            if local_path.exists():
                try:
                    local_path.unlink()
                except Exception:
                    pass
            return None

        # If we can guess a better extension from content-type, rename file
        better_ext = guess_ext(content_type, urlparse(abs_url).path)
        if better_ext and local_path.suffix.lower() != better_ext:
            new_local_path = local_path.with_suffix(better_ext)
            try:
                local_path.rename(new_local_path)
                local_path = new_local_path
            except Exception:
                pass

        rel_path = Path("assets") / local_path.name
        manifest["assets"][abs_url] = {
            "content_type": content_type,
            "bytes": size_bytes,
            "local_path": str(rel_path).replace("\\", "/"),
        }
        downloaded += 1
        return str(rel_path).replace("\\", "/")

    # Rewrite attributes
    for tag, attr, val in refs:
        if attr == "srcset":
            urls = parse_srcset(val)
            new_parts = []
            for u in val.split(","):
                u = u.strip()
                if not u:
                    continue
                pieces = u.split()
                src_url = pieces[0]
                descriptor = " ".join(pieces[1:]) if len(pieces) > 1 else ""
                local = download_and_rewrite_single(src_url)
                if local:
                    if descriptor:
                        new_parts.append(f"{local} {descriptor}")
                    else:
                        new_parts.append(local)
                else:
                    new_parts.append(u)  # fallback
            tag[attr] = ", ".join(new_parts)
        else:
            local = download_and_rewrite_single(val)
            if local:
                tag[attr] = local

    # Save rewritten HTML
    html_path.write_text(str(soup), encoding="utf-8")

    # Save manifest
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Klar! Sparade sida i: {out_dir}")
    print(f"- HTML: {html_path}")
    print(f"- URL:  {out_dir / 'url.txt'}")
    print(f"- Assets nedladdade: {downloaded}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
