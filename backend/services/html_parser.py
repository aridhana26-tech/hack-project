"""URL fetching + HTML element extraction — replaces extractPageElements from testgen.server.ts."""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from services.gemini import TestGenError


def _assert_safe_url(raw_url: str) -> str:
    """Validate the URL is safe (not pointing to internal/private addresses)."""
    try:
        parsed = urlparse(raw_url)
    except Exception:
        raise TestGenError(
            "Invalid URL. Include the protocol, e.g. https://example.com",
            "bad_url",
        )

    if parsed.scheme not in ("http", "https"):
        raise TestGenError("Only http and https URLs are supported.", "bad_url")

    host = (parsed.hostname or "").lower()
    blocked_patterns = [
        host == "localhost",
        host == "0.0.0.0",
        host.endswith(".local"),
        host.endswith(".internal"),
        bool(re.match(r"^127\.", host)),
        bool(re.match(r"^10\.", host)),
        bool(re.match(r"^192\.168\.", host)),
        bool(re.match(r"^169\.254\.", host)),
        bool(re.match(r"^172\.(1[6-9]|2\d|3[01])\.", host)),
    ]

    if any(blocked_patterns):
        raise TestGenError(
            "This URL points to a private/internal address and cannot be analyzed.",
            "bad_url",
        )

    return raw_url


def _build_locator(
    tag: str,
    el_id: str | None = None,
    name: str | None = None,
    data_test_id: str | None = None,
    aria_label: str | None = None,
    el_type: str | None = None,
    text: str | None = None,
) -> tuple[str, str]:
    """Build a recommended CSS/XPath locator and its strategy name."""
    if el_id:
        return f"#{el_id}", "id"
    if name:
        return f"{tag}[name='{name}']", "name"
    if data_test_id:
        return f"[data-testid='{data_test_id}']", "data-testid"
    if aria_label:
        return f"{tag}[aria-label='{aria_label}']", "aria-label"
    if el_type:
        return f"{tag}[type='{el_type}']", "css"
    if text:
        safe_text = text[:40].replace("'", "")
        return f"//{tag}[normalize-space()='{safe_text}']", "xpath"
    return tag, "css"


def _extract_element(el, kind: str) -> dict:
    """Extract element info from a BeautifulSoup tag."""
    tag = el.name or ""
    el_id = el.get("id") or None
    name = el.get("name") or None
    el_type = el.get("type") or None
    placeholder = el.get("placeholder") or None
    aria_label = el.get("aria-label") or None
    data_test_id = el.get("data-testid") or el.get("data-test-id") or None
    href = el.get("href") or None
    text = (el.get_text(strip=True) or "")[:80] or None

    locator, strategy = _build_locator(
        tag=tag,
        el_id=el_id,
        name=name,
        data_test_id=data_test_id,
        aria_label=aria_label,
        el_type=el_type,
        text=text,
    )

    return {
        "kind": kind,
        "tag": tag,
        "id": el_id,
        "name": name,
        "type": el_type,
        "text": text,
        "placeholder": placeholder,
        "ariaLabel": aria_label,
        "dataTestId": data_test_id,
        "href": href,
        "locator": locator,
        "locatorStrategy": strategy,
    }


async def extract_page_elements(raw_url: str) -> dict:
    """Fetch a URL and extract interactive UI elements from the static HTML."""
    url = _assert_safe_url(raw_url)

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; AITestGenPro/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                },
            )

        if response.status_code != 200:
            raise TestGenError(
                f"The URL responded with status {response.status_code}. "
                "Check that the page is publicly accessible.",
                "fetch_failed",
            )

        html = response.text

    except TestGenError:
        raise
    except httpx.TimeoutException:
        raise TestGenError(
            "Fetching the URL timed out after 15 seconds.", "timeout"
        )
    except Exception as e:
        print(f"URL fetch failed: {e}")
        raise TestGenError(
            "Could not fetch the URL. Check that it is reachable and publicly accessible.",
            "fetch_failed",
        )

    try:
        soup = BeautifulSoup(html, "lxml")
        elements = []

        # Inputs
        for el in soup.find_all("input"):
            input_type = (el.get("type") or "text").lower()
            if input_type == "hidden":
                continue
            if input_type == "checkbox":
                elements.append(_extract_element(el, "checkbox"))
            elif input_type == "radio":
                elements.append(_extract_element(el, "radio"))
            else:
                elements.append(_extract_element(el, "input"))

        # Textareas
        for el in soup.find_all("textarea"):
            elements.append(_extract_element(el, "input"))

        # Selects
        for el in soup.find_all("select"):
            options = [
                opt.get_text(strip=True)
                for opt in el.find_all("option")
                if opt.get_text(strip=True)
            ][:20]

            el_id = el.get("id") or None
            name = el.get("name") or None
            locator, strategy = _build_locator(tag="select", el_id=el_id, name=name)

            elements.append(
                {
                    "kind": "select",
                    "tag": "select",
                    "id": el_id,
                    "name": name,
                    "options": options,
                    "locator": locator,
                    "locatorStrategy": strategy,
                }
            )

        # Buttons
        for el in soup.select(
            "button, input[type='submit'], input[type='button'], [role='button']"
        ):
            elements.append(_extract_element(el, "button"))

        # Links (limit to 60)
        for el in soup.select("a[href]")[:60]:
            elements.append(_extract_element(el, "link"))

        # Forms
        forms = []
        for f in soup.find_all("form"):
            forms.append(
                {
                    "action": f.get("action") or None,
                    "method": (f.get("method") or "GET").upper(),
                    "fieldCount": len(f.find_all(["input", "select", "textarea"])),
                }
            )

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else urlparse(url).hostname

        return {
            "url": url,
            "title": title,
            "forms": forms,
            "elements": elements[:250],
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "note": (
                "No interactive elements were found in the static HTML. "
                "The page may be JavaScript-rendered or behind a login."
                if len(elements) == 0
                else None
            ),
        }

    except TestGenError:
        raise
    except Exception as e:
        print(f"HTML parsing failed: {e}")
        raise TestGenError("Failed to parse the page HTML.", "parse_html")
