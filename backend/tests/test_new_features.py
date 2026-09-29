"""Tests for password reset, reschedule, vendor profile prefill."""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vendor-stall-reserve.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

mongo = MongoClient(MONGO_URL)[DB_NAME]

ADMIN_EMAIL = "imcreatorstudio13@gmail.com"
ADMIN_PASSWORD = "Studio41Admin!"


def _register_user(prefix="test"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@example.com".lower()
    pw = "vendor123"
    r = requests.post(f"{API}/auth/register", json={
        "name": "TEST User", "email": email, "password": pw, "phone": "555-9999"})
    assert r.status_code == 200, r.text
    return email, pw, r.json()["token"], r.json()["user"]


# ---------- PASSWORD RESET ----------
class TestPasswordReset:
    def test_forgot_password_unknown_email_generic(self):
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": "TEST_nonexistent@example.com", "origin_url": BASE_URL})
        assert r.status_code == 200
        assert "if an account exists" in r.json()["message"].lower()

    def test_forgot_password_known_creates_token(self):
        email, pw, _, _ = _register_user("forgot")
        r = requests.post(f"{API}/auth/forgot-password", json={
            "email": email, "origin_url": BASE_URL})
        assert r.status_code == 200
        tok = mongo.password_reset_tokens.find_one({"email": email})
        assert tok is not None
        assert tok["used"] is False

    def test_reset_password_flow(self):
        email, pw, _, _ = _register_user("reset")
        requests.post(f"{API}/auth/forgot-password", json={"email": email, "origin_url": BASE_URL})
        tok = mongo.password_reset_tokens.find_one({"email": email, "used": False})
        assert tok
        new_pw = "newpass456"
        r = requests.post(f"{API}/auth/reset-password", json={"token": tok["token"], "password": new_pw})
        assert r.status_code == 200
        # Login with new password
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": new_pw})
        assert r2.status_code == 200
        # Old password fails
        r3 = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert r3.status_code == 401

    def test_reset_password_token_reuse_rejected(self):
        email, _, _, _ = _register_user("reuse")
        requests.post(f"{API}/auth/forgot-password", json={"email": email, "origin_url": BASE_URL})
        tok = mongo.password_reset_tokens.find_one({"email": email, "used": False})
        r1 = requests.post(f"{API}/auth/reset-password", json={"token": tok["token"], "password": "pass12345"})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/auth/reset-password", json={"token": tok["token"], "password": "other12345"})
        assert r2.status_code == 400

    def test_reset_password_short_rejected(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "whatever", "password": "abc"})
        assert r.status_code == 400

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "bogus_token_xyz", "password": "abcdef"})
        assert r.status_code == 400


# ---------- VENDOR PROFILE SAVE + PREFILL ----------
class TestVendorProfile:
    def test_booking_saves_vendor_profile(self):
        email, pw, token, user = _register_user("profile")
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "stalls": ["A"], "rental_type": "hourly",
            "date": "2027-03-15", "start_hour": 8, "end_hour": 12,
            "customer": {
                "full_name": "Jane Vendor", "business_name": "TEST Biz XYZ",
                "email": email, "phone": "555-1111",
                "business_description": "Handmade candles", "products": "Candles, wax melts",
                "notes": ""
            },
            "agreements_accepted": True, "cancellation_accepted": True, "terms_accepted": True,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        # GET /auth/me should have profile data
        me = requests.get(f"{API}/auth/me", headers=headers)
        assert me.status_code == 200
        m = me.json()
        assert m["business_name"] == "TEST Biz XYZ"
        assert m["phone"] == "555-1111"
        assert m["business_description"] == "Handmade candles"
        assert m["products"] == "Candles, wax melts"


# ---------- RESCHEDULE ----------
class TestReschedule:
    def _create_booking(self, headers, email, date="2027-03-20", sh=8, eh=12):
        payload = {
            "stalls": ["C"], "rental_type": "hourly",
            "date": date, "start_hour": sh, "end_hour": eh,
            "customer": {
                "full_name": "TEST U", "business_name": "TEST Biz",
                "email": email, "phone": "555", "business_description": "x", "products": "y", "notes": ""
            },
            "agreements_accepted": True, "cancellation_accepted": True, "terms_accepted": True,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        return r.json()

    def test_reschedule_hourly_same_duration_ok(self):
        email, _, token, _ = _register_user("resch1")
        h = {"Authorization": f"Bearer {token}"}
        b = self._create_booking(h, email)
        old_total = b["total"]
        r = requests.post(f"{API}/my/bookings/{b['id']}/reschedule", headers=h,
                          json={"date": "2027-03-22", "start_hour": 10, "end_hour": 14})
        assert r.status_code == 200, r.text
        assert r.json()["date"] == "2027-03-22"
        assert r.json()["start_hour"] == 10
        assert r.json()["total"] == old_total

    def test_reschedule_hourly_wrong_duration_400(self):
        email, _, token, _ = _register_user("resch2")
        h = {"Authorization": f"Bearer {token}"}
        b = self._create_booking(h, email)
        r = requests.post(f"{API}/my/bookings/{b['id']}/reschedule", headers=h,
                          json={"date": "2027-03-23", "start_hour": 10, "end_hour": 15})
        assert r.status_code == 400

    def test_reschedule_unauth_401(self):
        email, _, token, _ = _register_user("resch3")
        h = {"Authorization": f"Bearer {token}"}
        b = self._create_booking(h, email, date="2027-05-10")
        r = requests.post(f"{API}/my/bookings/{b['id']}/reschedule",
                          json={"date": "2027-05-11", "start_hour": 8, "end_hour": 12})
        assert r.status_code == 401

    def test_reschedule_cancelled_rejected(self):
        # Admin cancels then user tries to reschedule
        email, _, token, _ = _register_user("resch4")
        h = {"Authorization": f"Bearer {token}"}
        b = self._create_booking(h, email, date="2027-03-25")
        admin_login = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        atoken = admin_login.json()["token"]
        requests.post(f"{API}/admin/reservations/{b['id']}/cancel",
                      headers={"Authorization": f"Bearer {atoken}"})
        r = requests.post(f"{API}/my/bookings/{b['id']}/reschedule", headers=h,
                          json={"date": "2027-03-26", "start_hour": 8, "end_hour": 12})
        assert r.status_code == 400

    def test_reschedule_conflict_409(self):
        email, _, token, _ = _register_user("resch5")
        h = {"Authorization": f"Bearer {token}"}
        b1 = self._create_booking(h, email, date="2027-04-01", sh=8, eh=12)
        b2 = self._create_booking(h, email, date="2027-04-02", sh=14, eh=18)
        # Try to move b2 onto b1's slot
        r = requests.post(f"{API}/my/bookings/{b2['id']}/reschedule", headers=h,
                          json={"date": "2027-04-01", "start_hour": 8, "end_hour": 12})
        assert r.status_code == 409


# ---------- CLEANUP ----------
def test_zz_cleanup():
    # cancel TEST_ bookings, delete TEST_ users + reset tokens
    admin_login = requests.post(f"{API}/auth/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    atoken = admin_login.json()["token"]
    h = {"Authorization": f"Bearer {atoken}"}
    test_users = list(mongo.users.find({"email": {"$regex": "^test_"}}))
    for u in test_users:
        for r in mongo.reservations.find({"user_id": u["id"]}):
            requests.post(f"{API}/admin/reservations/{r['id']}/cancel", headers=h)
    mongo.users.delete_many({"email": {"$regex": "^test_"}})
    mongo.password_reset_tokens.delete_many({"email": {"$regex": "^test_"}})
