import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Studio Market 41")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        return None


def _row(label, value):
    return (f'<tr><td style="padding:6px 0;color:#6B7280;font-size:14px">{escape(str(label))}</td>'
            f'<td style="padding:6px 0;text-align:right;font-weight:600;color:#1C2120;font-size:14px">{escape(str(value))}</td></tr>')


def booking_email_html(booking: dict, for_admin: bool = False) -> str:
    c = booking.get("customer", {})
    stalls = " + ".join(booking.get("stalls", []))
    dates = booking.get("dates", [])
    date_str = dates[0] if len(dates) == 1 else f"{dates[0]} to {dates[-1]}"
    time_str = "Full day" if booking.get("rental_type") != "hourly" else f'{booking.get("start_label","")} - {booking.get("end_label","")}'
    heading = "New Reservation Received" if for_admin else "Your Reservation is Confirmed"
    intro = (f'A new vendor reservation has been booked.' if for_admin
             else f'Thank you, {escape(c.get("full_name",""))}! Your Studio Market 41 vendor space is reserved.')
    rows = "".join([
        _row("Confirmation Code", booking.get("confirmation_code", "")),
        _row("Vendor", c.get("full_name", "")),
        _row("Business", c.get("business_name", "")),
        _row("Email", c.get("email", "")),
        _row("Phone", c.get("phone", "")),
        _row("Stall(s)", stalls),
        _row("Rental Type", booking.get("rental_label", booking.get("rental_type", ""))),
        _row("Date", date_str),
        _row("Time", time_str),
        _row("Total Hours", booking.get("total_hours", "")),
        _row("Total Paid", f'${booking.get("total", 0):.2f}'),
    ])
    return (
        f'<table role="presentation" width="100%" style="background:#FBF9F5;padding:24px">'
        f'<tr><td align="center">'
        f'<table role="presentation" width="560" style="background:#FFFFFF;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif">'
        f'<tr><td style="background:#D96B43;padding:28px 32px">'
        f'<div style="color:#fff;font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85">Studio Market 41</div>'
        f'<div style="color:#fff;font-size:24px;font-weight:700;margin-top:6px">{heading}</div></td></tr>'
        f'<tr><td style="padding:28px 32px">'
        f'<p style="color:#1C2120;font-size:15px;line-height:1.6;margin:0 0 18px">{intro}</p>'
        f'<table role="presentation" width="100%" style="border-top:1px solid #E5E0D8">{rows}</table>'
        f'<p style="color:#6B7280;font-size:13px;line-height:1.6;margin:20px 0 0">Operating access is limited to your confirmed reservation period. '
        f'You will receive load-in and access details separately. Please review the cancellation policy provided at booking.</p>'
        f'</td></tr>'
        f'<tr><td style="padding:18px 32px;background:#14171A">'
        f'<p style="color:#9CA3AF;font-size:12px;margin:0">Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>'
        f'</td></tr></table></td></tr></table>'
    )
