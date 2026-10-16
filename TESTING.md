# AUTH-088 — Authentication API Test Plan

This document is the test plan and runbook for AUTH-088. The plan was defined before the test modules were written, as required by the ticket.

## Goal

Build confidence in the authentication business logic without testing FastAPI/HTTP serialization internals. Route tests call the Python endpoint functions directly and replace service dependencies with controlled fakes where appropriate. Service/security tests exercise the real authentication logic against isolated in-memory TinyDB tables.

The plan covers three classes for every endpoint:

- **Happy path** — valid input and expected business decision.
- **Edge case** — boundary or unusual-but-meaningful input.
- **Failure mode** — invalid credentials, duplicate data, malformed/expired tokens, authorization failures, or dependency failure.

## Endpoint test plan

| Endpoint | Happy path | Edge case | Failure mode | Test module |
|---|---|---|---|---|
| `POST /auth/login` | Active user credentials produce a token | Empty password reaches the authentication decision and is rejected | Unknown/wrong credentials raise 401 | `tests/test_auth_login.py` |
| `POST /auth/forgot-password` | Schedules background reset processing | Unknown email produces no token/email, preserving account privacy | Reset processing error is contained and does not leak provider details | `tests/test_auth_forgot_password.py` |
| `POST /auth/reset-password` | Valid one-time token changes password | Empty reset token is rejected by input rules | Invalid/expired/used token raises 400 | `tests/test_auth_reset_password.py` |
| `POST /auth/change-password` | Correct current password changes password | Exactly 8-character new password is accepted; empty current password rejected | Wrong current password raises 400 | `tests/test_auth_change_password.py` |
| `GET /auth/me` | Authenticated user and profile are returned | Optional profile fields may be `None` | Missing linked profile raises 404 | `tests/test_auth_me.py` |
| `POST /users` | Valid registration returns user + profile | Optional profile fields omitted; empty/short passwords rejected | Duplicate email maps to 409 | `tests/test_auth_register.py` |
| `GET /users` | Authenticated user gets directory | Empty directory returns `[]` | Storage failure is not silently converted to a successful empty result | `tests/test_auth_users_list.py` |
| `GET /users/{id}` | User reads self | Admin reads another user | Non-admin cross-user access raises 403; missing user raises 404 | `tests/test_auth_user_get.py` |
| `PUT /users/{id}` | User updates own email | Admin password update revokes reset tokens | Direct self-password update is forbidden; duplicate email/role permission errors are mapped correctly | `tests/test_auth_user_update.py` |
| `DELETE /users/{id}` | User deletes self | Admin deletes another user | Unauthorized delete raises 403; missing user raises 404 | `tests/test_auth_user_delete.py` |
| `GET /profiles/me` | Existing profile is returned | Optional fields may be empty | Missing profile raises 404 | `tests/test_auth_profile_get.py` |
| `PUT /profiles/me` | Profile update succeeds | Partial update changes only supplied fields | Missing profile raises 404 | `tests/test_auth_profile_update.py` |

## Security and service cases

`tests/test_auth_token.py` verifies the authentication primitives rather than HTTP plumbing:

- JWT access-token round trip preserves user ID and token version.
- Expired tokens are rejected.
- Tokens with the wrong signature are rejected.
- Missing/invalid subjects and invalid token versions are rejected.
- Password-reset tokens preserve the one-time JTI and user ID.
- Reset tokens with the wrong purpose or expired `exp` are rejected.
- Password hashes do not equal plaintext.
- Correct passwords verify; wrong passwords and corrupted stored hashes do not.

`tests/test_auth_dependency.py` verifies protected-route identity decisions:

- Valid token + active current user succeeds.
- Stale token versions are rejected after password changes.
- Malformed token, missing user, and inactive user are rejected as 401.
- Server JWT configuration failures propagate as server failures rather than being mislabeled as invalid credentials.

`tests/test_auth_business_services.py` verifies real service behavior using TinyDB `MemoryStorage` supplied by the existing project fixture:

- Credential authentication succeeds/fails for active, inactive, missing, and wrong-password cases.
- Login creates a decodable signed token.
- Registration normalizes email, hashes passwords, creates a linked profile, and blocks duplicates.
- Non-admin role changes are rejected.
- Password updates increment `token_version`.
- Profile create/update/get behavior and idempotent creation.
- Reset links are one-time use and subject to the 60-second cooldown.
- Persisted expired reset tokens are rejected.
- Password reset/change increments token version, hashes the new password, and revokes outstanding reset links.
- Wrong current password does not mutate the user.

## Inputs chosen because they commonly expose regressions

- Empty string and whitespace-only password.
- Seven-character password versus the 8-character minimum boundary.
- Duplicate email address.
- Email casing differences.
- Unknown email during password reset (account-enumeration protection).
- Expired JWT.
- Wrong JWT signing key.
- Missing/non-numeric/zero JWT subject.
- Negative/boolean token version.
- Wrong-purpose password-reset token.
- One-time token reuse.
- Stale access token after a password change.
- Non-admin access to another user's resource.
- Missing linked profile.
- Simulated persistence/provider failures.

## Running the FastAPI tests

From the FastAPI project root:

```bash
cd services/api
uv sync
uv run pytest
```

Run authentication coverage:

```bash
uv run pytest --cov
```

For an explicit package target, the equivalent command is:

```bash
uv run pytest --cov=auth --cov-report=term-missing
```

Coverage is configured with a **70% minimum** for the `auth` package. The command fails if coverage is below the threshold.

The `pyproject.toml` development dependency group includes `pytest` and `pytest-cov`, so plain `uv run pytest` works after `uv sync`.

## TypeScript/Jest coverage

The backoffice contains authentication utility logic in `uis/backoffice/lib/auth.ts`, so AUTH-088 also includes Jest tests for that utility.

Covered cases include:

- storing a valid bearer session;
- rejecting malformed login-token responses;
- storage write/read failure behavior;
- valid, expired, and malformed local sessions;
- clearing a session;
- safe versus unsafe post-login redirect paths;
- adding `Authorization: Bearer ...` to authenticated requests;
- missing-session behavior;
- clearing/redirecting after backend 401;
- logout behavior.

From the TypeScript project root:

```bash
cd uis/backoffice
npm install
npx jest --coverage
```

You can also use:

```bash
npm run test:coverage
```

`package.json` adds Jest, `ts-jest`, and `@types/jest`. Because these are new dependencies, running `npm install` once will refresh `package-lock.json`; commit that refreshed lock file with the test suite.

## What these tests intentionally do not test

- JSON serialization/deserialization performed by FastAPI/Pydantic after the business decision.
- Starlette routing internals.
- Whether HTTP headers travel over a real network connection.
- Resend's external email service itself.
- TinyDB internals.
- React rendering.

The tests instead assert what TrackFlow decides: authenticate or reject, authorize or deny, create or block a duplicate, accept or reject a token, mutate or preserve credential state, and protect account privacy.

## AI-assisted workflow note

AI was used to identify candidate edge cases and generate test boilerplate. The selected cases are intentionally tied to TrackFlow's current authentication logic. If a test reveals a real defect in production logic, document the defect and the production fix in this file before merging.
