"""Tests for the new user/admin split auth flows."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "imcreatorstudio13@gmail.com"
ADMIN_PASSWORD = "Studio41Admin!"
ADMIN_CODE = "STUDIO41-OWNER"

TEST_DATE = "2027-01-15"


def _rand_email(prefix="TEST_user"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


# ---------- USER REGISTER ----------
class TestUserRegister:
    def test_register_success(self):
        email = _rand_email()
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST User", "email": email, "password": "secret123", "phone": "555-1000"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["role"] == "user"
        assert data["user"]["email"] == email.lower()

    def test_register_duplicate_email_409(self):
        email = _rand_email()
        p = {"name": "TEST", "email": email, "password": "secret123"}
        r1 = requests.post(f"{API}/auth/register", json=p)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/auth/register", json=p)
        assert r2.status_code == 409

    def test_register_short_password_400(self):
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST", "email": _rand_email(), "password": "abc"
        })
        assert r.status_code == 400


# ---------- USER LOGIN ----------
class TestUserLogin:
    def test_login_success(self):
        email = _rand_email()
        requests.post(f"{API}/auth/register", json={
            "name": "TEST", "email": email, "password": "secret123"
        })
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "secret123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "user"

    def test_login_rejects_admin_403(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert r.status_code == 403
        assert "admin" in r.text.lower()

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": _rand_email(), "password": "whatever"
        })
        assert r.status_code == 401


# ---------- ADMIN LOGIN ----------
class TestAdminLogin:
    def test_admin_login_success(self):
        r = requests.post(f"{API}/auth/admin/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_admin_login_rejects_user_403(self):
        email = _rand_email()
        requests.post(f"{API}/auth/register", json={
            "name": "TEST", "email": email, "password": "secret123"
        })
        r = requests.post(f"{API}/auth/admin/login", json={"email": email, "password": "secret123"})
        assert r.status_code == 403
        assert "admin" in r.text.lower()


# ---------- ADMIN REGISTER ----------
class TestAdminRegister:
    def test_admin_register_wrong_code_403(self):
        r = requests.post(f"{API}/auth/admin/register", json={
            "name": "TEST Admin", "email": _rand_email("TEST_admin"),
            "password": "secret123", "admin_code": "WRONG"
        })
        assert r.status_code == 403

    def test_admin_register_correct_code_creates_admin(self):
        email = _rand_email("TEST_admin")
        r = requests.post(f"{API}/auth/admin/register", json={
            "name": "TEST Admin", "email": email,
            "password": "secret123", "admin_code": ADMIN_CODE
        })
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "admin"
        # verify it can log in through admin endpoint
        r2 = requests.post(f"{API}/auth/admin/login", json={"email": email, "password": "secret123"})
        assert r2.status_code == 200


# ---------- /auth/me + /my/bookings ----------
class TestMeAndMyBookings:
    def test_me_returns_current_user(self):
        email = _rand_email()
        reg = requests.post(f"{API}/auth/register", json={
            "name": "TEST Me", "email": email, "password": "secret123"
        }).json()
        token = reg["token"]
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        me = r.json()
        assert me["email"] == email.lower()
        assert me["role"] == "user"

    def test_my_bookings_requires_auth(self):
        r = requests.get(f"{API}/my/bookings")
        assert r.status_code == 401

    def test_user_linked_booking_appears_in_my_bookings(self):
        # register user
        email = _rand_email()
        reg = requests.post(f"{API}/auth/register", json={
            "name": "TEST Booker", "email": email, "password": "secret123"
        }).json()
        token = reg["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # create booking with token
        payload = {
            "stalls": ["A"], "rental_type": "hourly",
            "date": TEST_DATE, "start_hour": 8, "end_hour": 12,
            "customer": {
                "full_name": "TEST Booker", "business_name": "TEST Biz",
                "email": email, "phone": "555-1234",
                "business_description": "d", "products": "p", "notes": ""
            },
            "agreements_accepted": True,
            "cancellation_accepted": True,
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=headers)
        # If slot conflict from prior tests, retry with next day
        if r.status_code == 409:
            payload["date"] = "2027-01-16"
            r = requests.post(f"{API}/bookings", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        # my/bookings
        mb = requests.get(f"{API}/my/bookings", headers=headers)
        assert mb.status_code == 200
        ids = [b["id"] for b in mb.json()]
        assert bid in ids

    def test_guest_booking_not_in_any_my_bookings(self):
        # guest booking (no token)
        payload = {
            "stalls": ["B"], "rental_type": "hourly",
            "date": "2027-02-10", "start_hour": 8, "end_hour": 12,
            "customer": {
                "full_name": "TEST Guest", "business_name": "TEST",
                "email": _rand_email("TEST_guest"), "phone": "555",
                "business_description": "d", "products": "p", "notes": ""
            },
            "agreements_accepted": True,
            "cancellation_accepted": True,
            "terms_accepted": True,
        }
        r = requests.post(f"{API}/bookings", json=payload)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        # A random user should not see it
        email = _rand_email()
        reg = requests.post(f"{API}/auth/register", json={
            "name": "TEST", "email": email, "password": "secret123"
        }).json()
        token = reg["token"]
        mb = requests.get(f"{API}/my/bookings", headers={"Authorization": f"Bearer {token}"})
        assert mb.status_code == 200
        ids = [b["id"] for b in mb.json()]
        assert bid not in ids


# ---------- role protection on admin endpoints ----------
class TestRoleProtection:
    @pytest.fixture(scope="class")
    def user_token(self):
        email = _rand_email()
        reg = requests.post(f"{API}/auth/register", json={
            "name": "TEST RP", "email": email, "password": "secret123"
        }).json()
        return reg["token"]

    @pytest.fixture(scope="class")
    def admin_token(self):
        r = requests.post(f"{API}/auth/admin/login", json={
            "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
        })
        return r.json()["token"]

    def test_admin_reservations_no_token_401(self):
        r = requests.get(f"{API}/admin/reservations")
        assert r.status_code == 401

    def test_admin_reservations_user_token_403(self, user_token):
        r = requests.get(f"{API}/admin/reservations",
                         headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 403

    def test_admin_reservations_admin_token_200(self, admin_token):
        r = requests.get(f"{API}/admin/reservations",
                         headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200

    def test_settings_put_user_token_403(self, user_token):
        r = requests.put(f"{API}/settings",
                         headers={"Authorization": f"Bearer {user_token}"},
                         json={"hourly_rate": 10.0})
        assert r.status_code == 403

    def test_settings_put_admin_token_200(self, admin_token):
        r = requests.put(f"{API}/settings",
                         headers={"Authorization": f"Bearer {admin_token}"},
                         json={"hourly_rate": 10.0})
        assert r.status_code == 200
