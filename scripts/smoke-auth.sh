#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8080/api/v1}"
VALID_USER="${VALID_USER:-admin}"
VALID_PASSWORD="${VALID_PASSWORD:-Admin123!}"

echo "[1/4] Login success check"
SUCCESS_BODY=$(curl -sS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${VALID_USER}\",\"password\":\"${VALID_PASSWORD}\"}")

TOKEN=$(printf '%s' "${SUCCESS_BODY}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [[ -z "${TOKEN}" ]]; then
  echo "FAIL: login success did not return token"
  exit 1
fi
echo "PASS: token issued"

echo "[2/4] Login failure check"
FAIL_STATUS=$(curl -sS -o /tmp/taskmanager_login_fail.json -w "%{http_code}" -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong-password"}')

if [[ "${FAIL_STATUS}" != "401" ]]; then
  echo "FAIL: invalid login expected 401, got ${FAIL_STATUS}"
  exit 1
fi
echo "PASS: invalid login rejected"

echo "[3/5] Token reuse check"
ME_STATUS=$(curl -sS -o /tmp/taskmanager_me.json -w "%{http_code}" "${API_BASE_URL}/board" \
  -H "Authorization: Bearer ${TOKEN}")

if [[ "${ME_STATUS}" != "200" ]]; then
  echo "FAIL: protected endpoint expected 200, got ${ME_STATUS}"
  exit 1
fi
echo "PASS: token accepted by protected endpoint"

echo "[4/5] Session restore endpoint check"
ME_AUTH_STATUS=$(curl -sS -o /tmp/taskmanager_auth_me.json -w "%{http_code}" "${API_BASE_URL}/auth/me" \
  -H "Authorization: Bearer ${TOKEN}")

if [[ "${ME_AUTH_STATUS}" != "200" ]]; then
  echo "FAIL: auth me endpoint expected 200, got ${ME_AUTH_STATUS}"
  exit 1
fi

if ! grep -q '"username"' /tmp/taskmanager_auth_me.json; then
  echo "FAIL: auth me response does not include username"
  exit 1
fi

echo "PASS: auth me endpoint validates session restore contract"

echo "[5/5] Protected endpoint unauthorized envelope check"
UNAUTH_STATUS=$(curl -sS -o /tmp/taskmanager_me_unauth.json -w "%{http_code}" "${API_BASE_URL}/board")

if [[ "${UNAUTH_STATUS}" != "401" ]]; then
  echo "FAIL: protected endpoint without token expected 401, got ${UNAUTH_STATUS}"
  exit 1
fi

if ! grep -q '"code":"auth.unauthorized"' /tmp/taskmanager_me_unauth.json; then
  echo "FAIL: unauthorized response does not include expected error code auth.unauthorized"
  exit 1
fi

if ! grep -q '"error"' /tmp/taskmanager_me_unauth.json || ! grep -q '"meta"' /tmp/taskmanager_me_unauth.json; then
  echo "FAIL: unauthorized response does not follow expected error envelope"
  exit 1
fi

echo "PASS: unauthorized response follows standard error envelope"

echo "SMOKE RESULT: PASS"
echo "Note: Logout is frontend-managed by clearing sessionStorage token."