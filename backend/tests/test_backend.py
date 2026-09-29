"""End-to-end backend test for Studio Market 41."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendor-stall-reserve.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "imcreatorstudio13@gmail.com"
ADMIN_PASSWORD = "Studio41Admin!"

# Use a far future date safe for tests
TEST_DATE = "2026-12-15"  # Tuesday
TEST_DATE_2 = "2026-12-16"  # Wednesday


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------- settings ----------
def test_settings_public():
    r = requests.get(f"{API}/settings")
    assert r.status_code == 200
    s = r.json()
    assert s["stalls"] == ["A", "B", "C", "D"]
    assert len(s["agreements"]) == 9
    assert "terms" in s and "cancellation_policy" in s
    assert s["hourly_rate"] == 10.0
    assert s["hours_weekday"]["open"] == 7 and s["hours_weekday"]["close"] == 21
    assert s["hours_weekend"]["close"] == 22


# ---------- quote ----------
def test_quote_hourly_ab_combo():
    r = requests.post(f"{API}/quote", json={
        "stalls": ["A", "B"], "rental_type": "hourly",
        "date": TEST_DATE, "start_hour": 8, "end_hour": 12,
    })
    assert r.status_code == 200
    q = r.json()
    assert q["total"] == 80.0
    assert q["num_stalls"] == 2


def test_quote_min_hours_rejected():
    r = requests.post(f"{API}/quote", json={
        "stalls": ["A"], "rental_type": "hourly",
        "date": TEST_DATE, "start_hour": 8, "end_hour": 10,
    })
    assert r.status_code == 400


def test_quote_invalid_combo():
    r = requests.post(f"{API}/quote", json={
        "stalls": ["A", "C"], "rental_type": "hourly",
        "date": TEST_DATE, "start_hour": 8, "end_hour": 12,
    })
    assert r.status_code == 400


# ---------- availability ----------
def test_availability_shape():
    r = requests.get(f"{API}/availability", params={"date": TEST_DATE})
    assert r.status_code == 200
    a = r.json()
    assert a["open"] == 7 and a["close"] == 21
    for st in ["A", "B", "C", "D"]:
        assert st in a["stalls"]


# ---------- bookings + conflict + double-booking ----------
def _booking_payload(stalls, date, start, end, email=None):
    return {
        "stalls": stalls, "rental_type": "hourly", "date": date,
        "start_hour": start, "end_hour": end,
        "customer": {
            "full_name": "TEST User",
            "business_name": "TEST Biz",
            "email": email or f"test_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "555-1234",
            "business_description": "desc", "products": "widgets", "notes": ""
        },
        "agreements_accepted": True,
        "cancellation_accepted": True,
        "terms_accepted": True,
    }


created_ids = []


def test_booking_create_and_conflict():
    # unique date for this suite to avoid collision from prior runs
    date = "2026-11-17"  # Tuesday
    p = _booking_payload(["A"], date, 8, 12)
    r = requests.post(f"{API}/bookings", json=p)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["total"] == 40.0
    assert b["status"] == "pending"
    created_ids.append(b["id"])

    # overlapping same stall
    r2 = requests.post(f"{API}/bookings", json=_booking_payload(["A"], date, 9, 13))
    assert r2.status_code == 409

    # non-overlapping same stall
    r3 = requests.post(f"{API}/bookings", json=_booking_payload(["A"], date, 12, 16))
    assert r3.status_code == 200
    created_ids.append(r3.json()["id"])

    # different stall same time
    r4 = requests.post(f"{API}/bookings", json=_booking_payload(["B"], date, 8, 12))
    assert r4.status_code == 200
    created_ids.append(r4.json()["id"])

    # availability reflects booking
    av = requests.get(f"{API}/availability", params={"date": date}).json()
    booked = av["stalls"]["A"]["booked"]
    assert any(x["start"] == 8 and x["end"] == 12 for x in booked)


def test_booking_rejects_past_date():
    p = _booking_payload(["A"], "2020-01-01", 8, 12)
    r = requests.post(f"{API}/bookings", json=p)
    assert r.status_code == 400


def test_booking_requires_agreements():
    p = _booking_payload(["A"], TEST_DATE, 8, 12)
    p["terms_accepted"] = False
    r = requests.post(f"{API}/bookings", json=p)
    assert r.status_code == 400


def test_booking_invalid_combo():
    p = _booking_payload(["A", "C"], TEST_DATE, 8, 12)
    r = requests.post(f"{API}/bookings", json=p)
    assert r.status_code == 400


# ---------- payments checkout ----------
def test_payments_checkout():
    p = _booking_payload(["C"], "2026-11-18", 8, 12)
    b = requests.post(f"{API}/bookings", json=p).json()
    created_ids.append(b["id"])
    r = requests.post(f"{API}/payments/checkout", json={
        "booking_id": b["id"], "origin_url": BASE_URL,
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "checkout_url" in data and "session_id" in data
    assert "stripe.com" in data["checkout_url"]

    st = requests.get(f"{API}/payments/status/{data['session_id']}")
    assert st.status_code == 200
    assert st.json()["payment_status"] in ("pending", "paid", "unpaid", "no_payment_required")


# ---------- auth ----------
def test_auth_login_and_me(admin_token, auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL.lower()


def test_auth_protected_without_token():
    r = requests.get(f"{API}/admin/reservations")
    assert r.status_code == 401
    r2 = requests.get(f"{API}/admin/reservations", headers={"Authorization": "Bearer garbage"})
    assert r2.status_code == 401


def test_auth_login_bad_credentials():
    r = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# ---------- admin flows ----------
def test_admin_update_settings(auth_headers):
    r = requests.put(f"{API}/settings", headers=auth_headers, json={"hourly_rate": 10.0})
    assert r.status_code == 200
    assert r.json()["hourly_rate"] == 10.0


def test_admin_block_date_flow(auth_headers):
    d = "2026-12-31"
    r = requests.post(f"{API}/admin/block-date", headers=auth_headers, json={"date": d, "reason": "TEST"})
    assert r.status_code == 200
    av = requests.get(f"{API}/availability", params={"date": d}).json()
    assert av["day_blocked"] is True
    r2 = requests.delete(f"{API}/admin/block-date/{d}", headers=auth_headers)
    assert r2.status_code == 200
    av2 = requests.get(f"{API}/availability", params={"date": d}).json()
    assert av2["day_blocked"] is False


def test_admin_stall_unavailable_flow(auth_headers):
    r = requests.post(f"{API}/admin/stall-unavailable", headers=auth_headers,
                      json={"stall": "D", "unavailable": True})
    assert r.status_code == 200
    av = requests.get(f"{API}/availability", params={"date": TEST_DATE}).json()
    assert av["stalls"]["D"]["unavailable"] is True
    # revert
    r2 = requests.post(f"{API}/admin/stall-unavailable", headers=auth_headers,
                       json={"stall": "D", "unavailable": False})
    assert r2.status_code == 200
    av2 = requests.get(f"{API}/availability", params={"date": TEST_DATE}).json()
    assert av2["stalls"]["D"]["unavailable"] is False


def test_admin_block_slot_flow(auth_headers):
    d = "2026-11-19"
    r = requests.post(f"{API}/admin/block-slot", headers=auth_headers,
                      json={"date": d, "stall": "A", "start": 10, "end": 14, "reason": "TEST"})
    assert r.status_code == 200
    slot_id = r.json()["id"]
    av = requests.get(f"{API}/availability", params={"date": d}).json()
    assert any(x["start"] == 10 and x["end"] == 14 for x in av["stalls"]["A"]["booked"])
    # attempt booking that conflicts
    p = _booking_payload(["A"], d, 12, 16)
    conflict = requests.post(f"{API}/bookings", json=p)
    assert conflict.status_code == 409
    # cleanup
    requests.delete(f"{API}/admin/block-slot/{slot_id}", headers=auth_headers)


def test_admin_list_and_cancel(auth_headers):
    # create a booking
    p = _booking_payload(["B"], "2026-11-20", 8, 12)
    b = requests.post(f"{API}/bookings", json=p).json()
    bid = b["id"]

    lst = requests.get(f"{API}/admin/reservations", headers=auth_headers)
    assert lst.status_code == 200
    assert any(r["id"] == bid for r in lst.json())

    # cancel and confirm slot is free
    c = requests.post(f"{API}/admin/reservations/{bid}/cancel", headers=auth_headers)
    assert c.status_code == 200
    av = requests.get(f"{API}/availability", params={"date": "2026-11-20"}).json()
    assert not any(x["start"] == 8 and x["end"] == 12 for x in av["stalls"]["B"]["booked"])


# ---------- cleanup ----------
def test_zz_cleanup(auth_headers):
    for bid in created_ids:
        try:
            requests.post(f"{API}/admin/reservations/{bid}/cancel", headers=auth_headers)
        except Exception:
            pass
