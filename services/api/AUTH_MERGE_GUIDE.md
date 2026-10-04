# TrackFlow AUTH-01 integration guide

This package extends the **existing** `/services/api` FastAPI backend. It does
not create another server.

## New package

Copy the complete:

```text
/services/api/auth/
```

directory into the existing backend.

It contains:

```text
auth/
├── models.py
├── database.py
├── security.py
├── dependencies.py
├── services/
│   ├── user_service.py
│   ├── profile_service.py
│   └── auth_service.py
└── routes/
    ├── users.py
    ├── profiles.py
    └── auth.py
```

## Dependencies

Merge the packages listed in `AUTH_DEPENDENCIES.txt` into the existing
`pyproject.toml`, then run:

```bash
uv sync
```

## Environment configuration

Copy:

```text
.env.example
```

to:

```text
.env
```

Generate a strong secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use it for:

```env
JWT_SECRET_KEY=...
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Never commit `.env`.

## Existing main.py

Merge the imports and `include_router(...)` calls from:

```text
integration_examples/main_auth_integration.py
```

into the existing `main.py`.

Continue starting the same server:

```bash
uv run uvicorn main:app --reload --port 8000
```

## New API routes

```text
POST   /users                 public registration
GET    /users                 protected
GET    /users/{id}            protected
PUT    /users/{id}            protected; self or admin
DELETE /users/{id}            protected; self or admin

GET    /profiles/me           protected
PUT    /profiles/me           protected

POST   /auth/login            public
GET    /auth/me               protected
```

Registration always creates role `user`. A Profile is also created in the same
operation, even if name/phone/address are omitted.

`User` contains credentials/security data only. `Profile` contains display and
contact data.

## Protect existing routes

Follow:

```text
integration_examples/protect_suppliers.md
integration_examples/protect_incidents.md
```

The six Supplier routes alone satisfy the requirement for at least five
existing protected routes outside `/users` and `/auth`.

## TinyDB

Authentication creates:

```text
/services/api/data/auth.json
```

with two TinyDB tables:

```text
users
profiles
```

User and Profile stay in TinyDB only.

The JWT carries the TinyDB user `id` as its subject (`sub`) and also as
`user_id`.

Future inventory/PostgreSQL modules should store only that TinyDB ID in their
`user_uuid` field.

## Password security

Passwords are bcrypt-hashed before insertion.

Plaintext passwords are never stored and password validation uses bcrypt hash
verification rather than string comparison.

## 401 vs 403

`401 Unauthorized`:
- no bearer token
- malformed token
- expired token
- invalid signature
- user no longer exists
- user is inactive

`403 Forbidden`:
- an authenticated non-admin tries to access/update/delete another user's
  protected user resource
- a non-admin tries to change a role

## Manual test with /docs

1. `POST /users`
2. `POST /auth/login`
3. Copy `access_token`
4. Use the Swagger **Authorize** button with the token
5. Test `GET /auth/me`
6. Test `GET /profiles/me`
7. Test a protected Supplier route

Example registration:

```json
{
  "email": "dinesh@example.com",
  "password": "StrongPassword123!",
  "name": "Dinesh",
  "phone": "555-1234",
  "address": "North Carolina"
}
```

Example login:

```json
{
  "email": "dinesh@example.com",
  "password": "StrongPassword123!"
}
```

Also verify:
- protected route without token -> 401
- malformed token -> 401
- expired token -> 401
- access to another user's protected resource -> 403

## Frontend

Do not update the frontend for this exercise yet. Once existing routes are
protected, old frontend calls may return 401. That is expected until the
frontend is changed later to send:

```text
Authorization: Bearer <JWT>
```
