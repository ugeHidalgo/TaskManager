#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8080/api/v1}"
VALID_USER="${VALID_USER:-admin}"
VALID_PASSWORD="${VALID_PASSWORD:-Admin123!}"

echo "[1/3] Login success check"
SUCCESS_BODY=$(curl -sS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${VALID_USER}\",\"password\":\"${VALID_PASSWORD}\"}")

TOKEN=$(printf '%s' "${SUCCESS_BODY}" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
if [[ -z "${TOKEN}" ]]; then
  echo "FAIL: login success did not return token"
  exit 1
fi
echo "PASS: token issued"

echo "[2/3] Login failure check"
FAIL_STATUS=$(curl -sS -o /tmp/taskmanager_login_fail.json -w "%{http_code}" -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"wrong-password"}')

if [[ "${FAIL_STATUS}" != "401" ]]; then
  echo "FAIL: invalid login expected 401, got ${FAIL_STATUS}"
  exit 1
fi
echo "PASS: invalid login rejected"

echo "[3/3] Token reuse check"
ME_STATUS=$(curl -sS -o /tmp/taskmanager_me.json -w "%{http_code}" "${API_BASE_URL}/auth/me" \
  -H "Authorization: Bearer ${TOKEN}")

if [[ "${ME_STATUS}" != "200" ]]; then
  echo "FAIL: protected endpoint expected 200, got ${ME_STATUS}"
  exit 1
fi
echo "PASS: token accepted by protected endpoint"

echo "SMOKE RESULT: PASS"
echo "Note: Logout is frontend-managed by clearing localStorage token."