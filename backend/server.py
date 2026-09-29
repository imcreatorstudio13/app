from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, date, timedelta

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any

from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from emails import send_email, booking_email_html, reset_email_html

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
OWNER_EMAIL = os.environ.get('OWNER_EMAIL', ADMIN_EMAIL)
ADMIN_REGISTER_CODE = os.environ.get('ADMIN_REGISTER_CODE', 'STUDIO41-OWNER')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

STALLS = ["A", "B", "C", "D"]
VALID_COMBOS = {("A", "B"), ("C", "D")}
RENTAL_LABELS = {
    "hourly": "Hourly / Individual-Day",
    "daily": "Daily Rate",
    "weekly_mf": "Weekly (Mon-Fri)",
    "weekly_msun": "Weekly (Mon-Sun)",
}

DEFAULT_SETTINGS = {
    "id": "settings",
    "hourly_rate": 10.0,
    "daily_rate": 70.0,
    "weekly_mf_rate": 300.0,
    "weekly_msun_rate": 400.0,
    "hours_weekday": {"open": 7, "close": 21},
    "hours_weekend": {"open": 7, "close": 22},
    "min_hours": 4,
    "terms": "By booking with Studio Market 41 you agree to abide by all vendor rules, operating hours, and setup guidelines. Studio Market 41 provides the retail space, general utilities, lighting, Wi-Fi, and general social media marketing. Marketing efforts do not guarantee any particular number of customers, sales, views, or revenue.",
    "cancellation_policy": "Cancellations must be submitted in writing. Cancellations made at least 48 hours before the reservation begins are eligible for a full refund. Cancellations made less than 48 hours before are eligible for a 70% refund (Studio Market 41 retains 30%). No-shows and cancellations after the reservation begins are not eligible for a refund. Payment-processing charges may be nonrefundable. Rescheduling requests are subject to availability and owner approval.",
    "agreements": [
        "Vendor responsibility: I understand that I am solely responsible for my products, merchandise, inventory, money, sales, payment processing, business equipment, employees or assistants, and personal belongings.",
        "On-site supervision: I understand that I or an authorized representative must remain on-site while my business is operating and while my products are displayed.",
        "Setup and cleanup: I agree to keep my assigned area organized and to leave the space clean and free of merchandise, trash, boxes, and personal belongings at the end of my reservation.",
        "Equipment approval: I understand that all additional furniture, signs, electrical equipment, racks, easels, and displays are subject to owner approval. I will not bring unapproved equipment into the space.",
        "Product accuracy: I confirm that the products and services listed accurately represent what I intend to offer.",
        "Security acknowledgment: I understand that Studio Market 41 has 24-hour video surveillance for general property security. Surveillance does not transfer responsibility for my property to Studio Market 41.",
        "Independent business acknowledgment: I understand that Studio Market 41 does not process my sales, supervise my employees, manage my inventory, or guarantee customers, revenue, or sales.",
        "Marketing permission: I authorize Studio Market 41 to use my submitted business name, description, logo, and approved photographs or videos for marketing related to my reservation.",
        "Booking information: I confirm that the information submitted in this reservation is complete and accurate.",
    ],
}


# ---------- helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str = "user") -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def _user_from_creds(creds: Optional[HTTPAuthorizationCredentials]):
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    user = await _user_from_creds(creds)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


async def get_optional_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    try:
        return await _user_from_creds(creds)
    except HTTPException:
        return None


async def get_admin(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    user = await _user_from_creds(creds)
    if not user:
        raise HTTPException(401, "Not authenticated")
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "settings"}, {"_id": 0})
    if not s:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        return dict(DEFAULT_SETTINGS)
    for k, v in DEFAULT_SETTINGS.items():
        s.setdefault(k, v)
    return s


def parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def day_hours(d: date, settings: dict) -> Dict[str, int]:
    # Mon=0 .. Sun=6 ; Sat/Sun are weekend
    if d.weekday() >= 5:
        return settings["hours_weekend"]
    return settings["hours_weekday"]


def hour_label(h: int) -> str:
    suffix = "AM" if h < 12 else "PM"
    disp = h % 12
    if disp == 0:
        disp = 12
    return f"{disp}:00 {suffix}"


def overlaps(s1, e1, s2, e2) -> bool:
    return s1 < e2 and s2 < e1


def build_segments(rental_type: str, start_date: date, start_hour: Optional[int],
                   end_hour: Optional[int], settings: dict) -> List[dict]:
    """Return list of occupied segments {date, start, end}."""
    segs = []
    if rental_type == "hourly":
        segs.append({"date": start_date.isoformat(), "start": start_hour, "end": end_hour})
    elif rental_type == "daily":
        h = day_hours(start_date, settings)
        segs.append({"date": start_date.isoformat(), "start": h["open"], "end": h["close"]})
    elif rental_type in ("weekly_mf", "weekly_msun"):
        monday = start_date - timedelta(days=start_date.weekday())
        n = 5 if rental_type == "weekly_mf" else 7
        for i in range(n):
            d = monday + timedelta(days=i)
            h = day_hours(d, settings)
            segs.append({"date": d.isoformat(), "start": h["open"], "end": h["close"]})
    return segs


async def active_reservations():
    return await db.reservations.find(
        {"status": {"$in": ["pending", "confirmed"]}}, {"_id": 0}
    ).to_list(5000)


async def check_conflicts(stalls: List[str], segments: List[dict], settings: dict,
                          exclude_id: Optional[str] = None) -> Optional[str]:
    # blocked dates
    blocked_dates = {b["date"] for b in await db.blocked_dates.find({}, {"_id": 0}).to_list(5000)}
    unavailable = {b["stall"] for b in await db.stall_unavailable.find({}, {"_id": 0}).to_list(100)}
    blocked_slots = await db.blocked_slots.find({}, {"_id": 0}).to_list(5000)
    for st in stalls:
        if st in unavailable:
            return f"Stall {st} is currently marked unavailable."
    for seg in segments:
        if seg["date"] in blocked_dates:
            return f"{seg['date']} is blocked and unavailable for booking."
        for bs in blocked_slots:
            if bs["date"] == seg["date"] and bs.get("stall") in stalls and overlaps(
                    seg["start"], seg["end"], bs["start"], bs["end"]):
                return f"Stall {bs['stall']} is blocked on {seg['date']} during the selected time."
    reservations = await active_reservations()
    for r in reservations:
        if exclude_id and r["id"] == exclude_id:
            continue
        if not set(r["stalls"]) & set(stalls):
            continue
        for seg in segments:
            for rs in r["segments"]:
                if rs["date"] == seg["date"] and overlaps(seg["start"], seg["end"], rs["start"], rs["end"]):
                    conflict_stall = ", ".join(set(r["stalls"]) & set(stalls))
                    return f"Stall {conflict_stall} is already booked on {seg['date']} during the selected time."
    return None


def compute_quote(rental_type: str, stalls: List[str], start_hour: Optional[int],
                  end_hour: Optional[int], settings: dict) -> dict:
    n = len(stalls)
    if rental_type == "hourly":
        hours = (end_hour or 0) - (start_hour or 0)
        total = settings["hourly_rate"] * hours * n
        total_hours = hours
    elif rental_type == "daily":
        total = settings["daily_rate"] * n
        total_hours = 1
    elif rental_type == "weekly_mf":
        total = settings["weekly_mf_rate"] * n
        total_hours = 5
    elif rental_type == "weekly_msun":
        total = settings["weekly_msun_rate"] * n
        total_hours = 7
    else:
        raise HTTPException(400, "Invalid rental type")
    return {"total": round(float(total), 2), "total_hours": total_hours, "num_stalls": n}


def validate_stalls(stalls: List[str]):
    if not stalls or len(stalls) > 2:
        raise HTTPException(400, "Select one stall or two adjoining stalls.")
    for s in stalls:
        if s not in STALLS:
            raise HTTPException(400, "Invalid stall.")
    if len(stalls) == 2 and tuple(sorted(stalls)) not in VALID_COMBOS:
        raise HTTPException(400, "Only adjoining stalls (A+B or C+D) may be combined.")


# ---------- schemas ----------
class LoginReq(BaseModel):
    email: EmailStr
    password: str


class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""


class AdminRegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    admin_code: str


class ForgotPasswordReq(BaseModel):
    email: EmailStr
    origin_url: str


class ResetPasswordReq(BaseModel):
    token: str
    password: str


class RescheduleReq(BaseModel):
    date: str
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None


class QuoteReq(BaseModel):
    stalls: List[str]
    rental_type: str
    date: str
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None


class CustomerInfo(BaseModel):
    full_name: str
    business_name: str
    email: EmailStr
    phone: str
    business_description: str = ""
    products: str = ""
    notes: str = ""


class BookingReq(BaseModel):
    stalls: List[str]
    rental_type: str
    date: str
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    customer: CustomerInfo
    logo_base64: Optional[str] = None
    electrical_needed: bool = False
    electrical_items: str = ""
    furniture_needed: bool = False
    furniture_items: List[str] = []
    furniture_description: str = ""
    additional_info: str = ""
    agreements_accepted: bool = False
    cancellation_accepted: bool = False
    terms_accepted: bool = False


class CheckoutReq(BaseModel):
    booking_id: str
    origin_url: str


class SettingsUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_mf_rate: Optional[float] = None
    weekly_msun_rate: Optional[float] = None
    hours_weekday: Optional[Dict[str, int]] = None
    hours_weekend: Optional[Dict[str, int]] = None
    min_hours: Optional[int] = None
    terms: Optional[str] = None
    cancellation_policy: Optional[str] = None
    agreements: Optional[List[str]] = None


class BlockDateReq(BaseModel):
    date: str
    reason: str = ""


class BlockSlotReq(BaseModel):
    date: str
    stall: str
    start: int
    end: int
    reason: str = ""


class StallUnavailableReq(BaseModel):
    stall: str
    unavailable: bool


# ---------- auth routes ----------
def _public_user(u: dict) -> dict:
    return {
        "id": u["id"], "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "user"),
        "business_name": u.get("business_name", ""), "phone": u.get("phone", ""),
        "business_description": u.get("business_description", ""), "products": u.get("products", ""),
    }


async def _create_user(name: str, email: str, password: str, role: str) -> dict:
    email = email.lower()
    if len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "An account with this email already exists.")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(dict(doc))
    return doc


@api_router.post("/auth/register")
async def register(req: RegisterReq):
    user = await _create_user(req.name, req.email, req.password, "user")
    if req.phone:
        await db.users.update_one({"id": user["id"]}, {"$set": {"phone": req.phone}})
    token = create_token(user["id"], user["email"], "user")
    return {"token": token, "user": _public_user(user)}


@api_router.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("role") == "admin":
        raise HTTPException(403, "This is an admin account. Please use the admin login page.")
    token = create_token(user["id"], user["email"], user.get("role", "user"))
    return {"token": token, "user": _public_user(user)}


@api_router.post("/auth/admin/register")
async def admin_register(req: AdminRegisterReq):
    if req.admin_code != ADMIN_REGISTER_CODE:
        raise HTTPException(403, "Invalid admin registration code.")
    user = await _create_user(req.name, req.email, req.password, "admin")
    token = create_token(user["id"], user["email"], "admin")
    return {"token": token, "user": _public_user(user)}


@api_router.post("/auth/admin/login")
async def admin_login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("role") != "admin":
        raise HTTPException(403, "This account does not have admin access.")
    token = create_token(user["id"], user["email"], "admin")
    return {"token": token, "user": _public_user(user)}


@api_router.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return current


@api_router.get("/my/bookings")
async def my_bookings(current: dict = Depends(get_current_user)):
    return await db.reservations.find(
        {"user_id": current["id"]}, {"_id": 0, "logo_base64": 0}
    ).sort("created_at", -1).to_list(1000)


@api_router.post("/my/bookings/{booking_id}/reschedule")
async def reschedule_booking(booking_id: str, req: RescheduleReq, current: dict = Depends(get_current_user)):
    b = await db.reservations.find_one({"id": booking_id}, {"_id": 0})
    if not b or b.get("user_id") != current["id"]:
        raise HTTPException(404, "Booking not found")
    if b["status"] == "cancelled":
        raise HTTPException(400, "This booking is cancelled and cannot be rescheduled.")
    settings = await get_settings()
    d = parse_date(req.date)
    if d < datetime.now(timezone.utc).date():
        raise HTTPException(400, "Cannot reschedule to a past date.")
    start_hour, end_hour = req.start_hour, req.end_hour
    if b["rental_type"] == "hourly":
        if start_hour is None or end_hour is None:
            raise HTTPException(400, "Select a start and end time.")
        if end_hour - start_hour != b.get("total_hours"):
            raise HTTPException(400, f"Rescheduled time must keep the same {b.get('total_hours')} hour duration.")
        hrs = day_hours(d, settings)
        if start_hour < hrs["open"] or end_hour > hrs["close"]:
            raise HTTPException(400, "Selected time is outside operating hours.")
    else:
        start_hour, end_hour = None, None
    segments = build_segments(b["rental_type"], d, start_hour, end_hour, settings)
    conflict = await check_conflicts(b["stalls"], segments, settings, exclude_id=b["id"])
    if conflict:
        raise HTTPException(409, conflict)
    dates = sorted({s["date"] for s in segments})
    await db.reservations.update_one({"id": booking_id}, {"$set": {
        "date": req.date, "dates": dates, "start_hour": start_hour, "end_hour": end_hour,
        "start_label": hour_label(start_hour) if start_hour is not None else "",
        "end_label": hour_label(end_hour) if end_hour is not None else "",
        "segments": segments,
    }})
    return await db.reservations.find_one({"id": booking_id}, {"_id": 0, "logo_base64": 0})


@api_router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"], "email": user["email"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False, "created_at": datetime.now(timezone.utc),
        })
        reset_link = f"{req.origin_url.rstrip('/')}/reset-password?token={token}"
        try:
            await send_email(to=user["email"],
                             subject="Reset your Studio Market 41 password",
                             html=reset_email_html(user.get("name", ""), reset_link))
        except Exception as e:
            logger.error(f"reset email error: {e}")
    return {"message": "If an account exists for that email, a password reset link has been sent."}


@api_router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordReq):
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    rec = await db.password_reset_tokens.find_one({"token": req.token})
    if not rec or rec.get("used"):
        raise HTTPException(400, "This reset link is invalid or has already been used.")
    exp = rec["expires_at"]
    if getattr(exp, "tzinfo", None) is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "This reset link has expired. Please request a new one.")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(req.password)}})
    await db.password_reset_tokens.update_one({"token": req.token}, {"$set": {"used": True}})
    return {"message": "Your password has been updated. You can now log in."}


# ---------- settings ----------
@api_router.get("/settings")
async def settings_public():
    s = await get_settings()
    return {**s, "stalls": STALLS, "rental_labels": RENTAL_LABELS}


@api_router.put("/settings")
async def update_settings(upd: SettingsUpdate, admin: dict = Depends(get_admin)):
    changes = {k: v for k, v in upd.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "settings"}, {"$set": changes}, upsert=True)
    return await get_settings()


# ---------- availability ----------
@api_router.get("/availability")
async def availability(date: str):
    settings = await get_settings()
    d = parse_date(date)
    hrs = day_hours(d, settings)
    blocked_dates = {b["date"] for b in await db.blocked_dates.find({}, {"_id": 0}).to_list(5000)}
    unavailable = {b["stall"] for b in await db.stall_unavailable.find({}, {"_id": 0}).to_list(100)}
    blocked_slots = await db.blocked_slots.find({"date": date}, {"_id": 0}).to_list(5000)
    reservations = await active_reservations()
    result = {}
    day_blocked = date in blocked_dates
    for st in STALLS:
        booked = []
        for r in reservations:
            if st not in r["stalls"]:
                continue
            for seg in r["segments"]:
                if seg["date"] == date:
                    booked.append({"start": seg["start"], "end": seg["end"]})
        for bs in blocked_slots:
            if bs.get("stall") == st:
                booked.append({"start": bs["start"], "end": bs["end"]})
        result[st] = {
            "unavailable": st in unavailable or day_blocked,
            "booked": booked,
        }
    return {"date": date, "open": hrs["open"], "close": hrs["close"], "day_blocked": day_blocked, "stalls": result}


# ---------- quote ----------
@api_router.post("/quote")
async def quote(req: QuoteReq):
    settings = await get_settings()
    validate_stalls(req.stalls)
    if req.rental_type == "hourly":
        if req.start_hour is None or req.end_hour is None:
            raise HTTPException(400, "Select a start and end time.")
        if req.end_hour - req.start_hour < settings["min_hours"]:
            raise HTTPException(400, f"Minimum booking is {settings['min_hours']} consecutive hours.")
    return compute_quote(req.rental_type, req.stalls, req.start_hour, req.end_hour, settings)


# ---------- bookings ----------
@api_router.post("/bookings")
async def create_booking(req: BookingReq, current=Depends(get_optional_user)):
    settings = await get_settings()
    validate_stalls(req.stalls)
    if not (req.agreements_accepted and req.cancellation_accepted and req.terms_accepted):
        raise HTTPException(400, "All required agreements must be accepted.")
    d = parse_date(req.date)
    if d < datetime.now(timezone.utc).date():
        raise HTTPException(400, "Cannot book a past date.")
    if req.rental_type == "hourly":
        if req.start_hour is None or req.end_hour is None:
            raise HTTPException(400, "Select a start and end time.")
        if req.end_hour - req.start_hour < settings["min_hours"]:
            raise HTTPException(400, f"Minimum booking is {settings['min_hours']} consecutive hours.")
        hrs = day_hours(d, settings)
        if req.start_hour < hrs["open"] or req.end_hour > hrs["close"]:
            raise HTTPException(400, "Selected time is outside operating hours.")
    segments = build_segments(req.rental_type, d, req.start_hour, req.end_hour, settings)
    conflict = await check_conflicts(req.stalls, segments, settings)
    if conflict:
        raise HTTPException(409, conflict)
    q = compute_quote(req.rental_type, req.stalls, req.start_hour, req.end_hour, settings)
    dates = sorted({s["date"] for s in segments})
    booking = {
        "id": str(uuid.uuid4()),
        "confirmation_code": "SM41-" + uuid.uuid4().hex[:6].upper(),
        "user_id": current["id"] if current else None,
        "status": "pending",
        "stalls": req.stalls,
        "rental_type": req.rental_type,
        "rental_label": RENTAL_LABELS.get(req.rental_type, req.rental_type),
        "date": req.date,
        "dates": dates,
        "start_hour": req.start_hour,
        "end_hour": req.end_hour,
        "start_label": hour_label(req.start_hour) if req.start_hour is not None else "",
        "end_label": hour_label(req.end_hour) if req.end_hour is not None else "",
        "segments": segments,
        "customer": req.customer.model_dump(),
        "logo_base64": req.logo_base64,
        "electrical_needed": req.electrical_needed,
        "electrical_items": req.electrical_items,
        "furniture_needed": req.furniture_needed,
        "furniture_items": req.furniture_items,
        "furniture_description": req.furniture_description,
        "additional_info": req.additional_info,
        "total": q["total"],
        "total_hours": q["total_hours"],
        "num_stalls": q["num_stalls"],
        "payment_status": "pending",
        "session_id": None,
        "email_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reservations.insert_one(dict(booking))
    booking.pop("_id", None)
    if current:
        await db.users.update_one({"id": current["id"]}, {"$set": {
            "business_name": req.customer.business_name,
            "phone": req.customer.phone,
            "business_description": req.customer.business_description,
            "products": req.customer.products,
        }})
    return booking


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    b = await db.reservations.find_one({"id": booking_id}, {"_id": 0, "logo_base64": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    return b


# ---------- payments (Stripe Flow B) ----------
def stripe_client(request: Request) -> StripeCheckout:
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


async def _finalize_paid(booking: dict):
    """Idempotent: mark confirmed + send emails once."""
    if booking.get("payment_status") == "paid" and booking.get("email_sent"):
        return
    await db.reservations.update_one(
        {"id": booking["id"]},
        {"$set": {"payment_status": "paid", "status": "confirmed"}},
    )
    if not booking.get("email_sent"):
        try:
            await send_email(to=booking["customer"]["email"],
                             subject=f"Your Studio Market 41 reservation is confirmed ({booking['confirmation_code']})",
                             html=booking_email_html(booking, for_admin=False))
            await send_email(to=OWNER_EMAIL,
                             subject=f"New reservation: {booking['confirmation_code']} - {booking['customer']['business_name']}",
                             html=booking_email_html(booking, for_admin=True))
        except Exception as e:
            logger.error(f"email error: {e}")
        await db.reservations.update_one({"id": booking["id"]}, {"$set": {"email_sent": True}})


@api_router.post("/payments/checkout")
async def create_checkout(req: CheckoutReq, request: Request):
    booking = await db.reservations.find_one({"id": req.booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.get("payment_status") == "paid":
        raise HTTPException(400, "Booking already paid")
    success_url = f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/payment/cancel?booking_id={booking['id']}"
    checkout = stripe_client(request)
    session = await checkout.create_checkout_session(CheckoutSessionRequest(
        amount=float(booking["total"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"booking_id": booking["id"], "code": booking["confirmation_code"]},
    ))
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "booking_id": booking["id"],
        "amount": float(booking["total"]),
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.reservations.update_one({"id": booking["id"]}, {"$set": {"session_id": session.session_id}})
    return {"checkout_url": session.url, "session_id": session.session_id}


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request):
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Transaction not found")
    if txn.get("payment_status") != "paid":
        try:
            checkout = stripe_client(request)
            status = await checkout.get_checkout_status(session_id)
            if status.payment_status == "paid" or status.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid"}})
                booking = await db.reservations.find_one({"id": txn["booking_id"]}, {"_id": 0})
                if booking:
                    await _finalize_paid(booking)
                txn["payment_status"] = "paid"
        except Exception as e:
            logger.error(f"status check error: {e}")
    booking = await db.reservations.find_one({"id": txn["booking_id"]}, {"_id": 0, "logo_base64": 0})
    return {"session_id": session_id, "payment_status": txn.get("payment_status", "pending"),
            "booking": booking}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        checkout = stripe_client(request)
        result = await checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"webhook error: {e}")
        raise HTTPException(400, "Invalid webhook")
    if result.payment_status == "paid" and result.session_id:
        await db.payment_transactions.update_one(
            {"session_id": result.session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": "paid"}})
        booking_id = (result.metadata or {}).get("booking_id")
        if booking_id:
            booking = await db.reservations.find_one({"id": booking_id}, {"_id": 0})
            if booking:
                await _finalize_paid(booking)
    return {"status": "ok"}


# ---------- admin management ----------
@api_router.get("/admin/reservations")
async def admin_reservations(admin: dict = Depends(get_admin)):
    res = await db.reservations.find({}, {"_id": 0, "logo_base64": 0}).sort("created_at", -1).to_list(5000)
    return res


@api_router.get("/admin/reservations/{booking_id}")
async def admin_reservation(booking_id: str, admin: dict = Depends(get_admin)):
    b = await db.reservations.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    return b


@api_router.put("/admin/reservations/{booking_id}")
async def admin_edit_reservation(booking_id: str, changes: Dict[str, Any], admin: dict = Depends(get_admin)):
    allowed = {k: v for k, v in changes.items() if k in
               ("status", "additional_info", "start_hour", "end_hour")}
    await db.reservations.update_one({"id": booking_id}, {"$set": allowed})
    return await db.reservations.find_one({"id": booking_id}, {"_id": 0, "logo_base64": 0})


@api_router.post("/admin/reservations/{booking_id}/cancel")
async def admin_cancel_reservation(booking_id: str, admin: dict = Depends(get_admin)):
    await db.reservations.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    return {"status": "cancelled"}


@api_router.get("/admin/blocked")
async def admin_blocked(admin: dict = Depends(get_admin)):
    dates = await db.blocked_dates.find({}, {"_id": 0}).to_list(5000)
    slots = await db.blocked_slots.find({}, {"_id": 0}).to_list(5000)
    unav = await db.stall_unavailable.find({}, {"_id": 0}).to_list(100)
    return {"dates": dates, "slots": slots, "unavailable": [u["stall"] for u in unav]}


@api_router.post("/admin/block-date")
async def block_date(req: BlockDateReq, admin: dict = Depends(get_admin)):
    doc = {"id": str(uuid.uuid4()), "date": req.date, "reason": req.reason}
    await db.blocked_dates.update_one({"date": req.date}, {"$set": doc}, upsert=True)
    return doc


@api_router.delete("/admin/block-date/{d}")
async def unblock_date(d: str, admin: dict = Depends(get_admin)):
    await db.blocked_dates.delete_one({"date": d})
    return {"ok": True}


@api_router.post("/admin/block-slot")
async def block_slot(req: BlockSlotReq, admin: dict = Depends(get_admin)):
    doc = {"id": str(uuid.uuid4()), **req.model_dump()}
    await db.blocked_slots.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.delete("/admin/block-slot/{slot_id}")
async def unblock_slot(slot_id: str, admin: dict = Depends(get_admin)):
    await db.blocked_slots.delete_one({"id": slot_id})
    return {"ok": True}


@api_router.post("/admin/stall-unavailable")
async def stall_unavailable(req: StallUnavailableReq, admin: dict = Depends(get_admin)):
    if req.unavailable:
        await db.stall_unavailable.update_one({"stall": req.stall}, {"$set": {"stall": req.stall}}, upsert=True)
    else:
        await db.stall_unavailable.delete_one({"stall": req.stall})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await get_settings()
    try:
        await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.error(f"index error: {e}")
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Studio Market 41 Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                  {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
