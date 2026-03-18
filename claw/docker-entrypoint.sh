#!/bin/sh
set -e

OPENCLAW_DIR="/root/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
AGENT_DIR="$OPENCLAW_DIR/agents/aida-flyttagent/agent"
WORKSPACE_DIR="$OPENCLAW_DIR/workspace-aida"
LISTEN_PORT="${PORT:-${OPENCLAW_GATEWAY_PORT:-18789}}"
BIND_MODE="${OPENCLAW_GATEWAY_BIND:-lan}"
HARD_DEFAULT_MODEL="openai/gpt-5.1-codex"
DEFAULT_MODEL_RAW="${OPENCLAW_MODEL_DEFAULT:-${OPENCLAW_MODEL_LOCK:-$HARD_DEFAULT_MODEL}}"
MODEL_PRIMARY_RAW="${OPENCLAW_MODEL_PRIMARY:-$DEFAULT_MODEL_RAW}"
MODEL_FALLBACK_RAW="${OPENCLAW_MODEL_FALLBACK:-$DEFAULT_MODEL_RAW}"
ALLOWED_MODEL_PREFIXES_RAW="${OPENCLAW_ALLOWED_MODEL_PREFIXES:-openai/}"
MODEL_LOCK_ENABLED_RAW="${OPENCLAW_MODEL_LOCK_ENABLED:-false}"
MODEL_POLICY_ENFORCE_RAW="${OPENCLAW_MODEL_POLICY_ENFORCE:-false}"
OPENCLAW_VERSION="$(openclaw --version 2>/dev/null | tr -d '\r')"
CONTROLUI_DISABLE_DEVICE_AUTH_RAW="${OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH:-false}"
ALLOW_INSECURE_CONTROLUI_RAW="${OPENCLAW_ALLOW_INSECURE_CONTROLUI:-false}"

normalize_bool() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    1|true|y|yes)
      echo "true"
      ;;
    *)
      echo "false"
      ;;
  esac
}

is_model_allowed() {
  model_lower="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  old_ifs="$IFS"
  IFS=','
  for raw_prefix in $ALLOWED_MODEL_PREFIXES_RAW; do
    prefix="$(echo "$raw_prefix" | tr '[:upper:]' '[:lower:]' | sed 's/^ *//;s/ *$//')"
    [ -z "$prefix" ] && continue
    case "$model_lower" in
      "$prefix"*)
        IFS="$old_ifs"
        return 0
        ;;
    esac
  done
  IFS="$old_ifs"
  return 1
}

enforce_model_policy() {
  label="$1"
  candidate="$2"
  fallback="$3"
  if [ -z "$candidate" ]; then
    echo "$fallback"
    return
  fi
  if [ "$MODEL_POLICY_ENFORCE" != "true" ]; then
    if ! is_model_allowed "$candidate"; then
      echo "[entrypoint] WARNING: disallowed ${label} model '${candidate}' seen, but OPENCLAW_MODEL_POLICY_ENFORCE=false." >&2
    fi
    echo "$candidate"
    return
  fi
  if is_model_allowed "$candidate"; then
    echo "$candidate"
    return
  fi
  echo "[entrypoint] WARNING: blocked disallowed ${label} model '${candidate}', fallback='${fallback}'" >&2
  echo "$fallback"
}

MODEL_LOCK_ENABLED="$(normalize_bool "$MODEL_LOCK_ENABLED_RAW")"
MODEL_POLICY_ENFORCE="$(normalize_bool "$MODEL_POLICY_ENFORCE_RAW")"
ALLOW_INSECURE_CONTROLUI="$(normalize_bool "$ALLOW_INSECURE_CONTROLUI_RAW")"
CONTROLUI_DISABLE_DEVICE_AUTH="$(normalize_bool "$CONTROLUI_DISABLE_DEVICE_AUTH_RAW")"

DEFAULT_MODEL="$(enforce_model_policy "default" "$DEFAULT_MODEL_RAW" "$HARD_DEFAULT_MODEL")"
MODEL_PRIMARY="$(enforce_model_policy "primary" "$MODEL_PRIMARY_RAW" "$DEFAULT_MODEL")"
MODEL_FALLBACK="$(enforce_model_policy "fallback" "$MODEL_FALLBACK_RAW" "$DEFAULT_MODEL")"

if [ "$MODEL_LOCK_ENABLED" = "true" ]; then
  MODEL_FALLBACK="$MODEL_PRIMARY"
fi

if [ "$CONTROLUI_DISABLE_DEVICE_AUTH" = "true" ] && [ "$ALLOW_INSECURE_CONTROLUI" != "true" ]; then
  echo "[entrypoint] WARNING: blocked OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH=true; forcing false."
  echo "[entrypoint] WARNING: set OPENCLAW_ALLOW_INSECURE_CONTROLUI=true only for local troubleshooting."
  CONTROLUI_DISABLE_DEVICE_AUTH=false
fi

# Binding outside loopback requires auth; if token is missing, stay local.
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ] && [ "$BIND_MODE" != "loopback" ]; then
  echo "[entrypoint] OPENCLAW_GATEWAY_TOKEN missing; forcing loopback bind"
  BIND_MODE="loopback"
fi

# Ensure directories exist (important on first run with empty persistent volume)
mkdir -p "$AGENT_DIR"
mkdir -p "$WORKSPACE_DIR"

# Always overwrite IDENTITY.md from image so updates propagate on redeploy
cp /app/seed/IDENTITY.md "$AGENT_DIR/IDENTITY.md"
echo "[entrypoint] IDENTITY.md written for aida-flyttagent"

# Seed workspace skills if present in image but not yet on volume
if [ -d "/app/seed/workspace" ]; then
  cp -rn /app/seed/workspace/. "$WORKSPACE_DIR/" 2>/dev/null || true
  echo "[entrypoint] Seeded workspace files"
fi

# Write OpenClaw config for container runtime.
cat > "$CONFIG_FILE" <<EOF
{
  "gateway": {
    "mode": "local",
    "bind": "${BIND_MODE}",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "controlUi": {
      "enabled": true,
      "dangerouslyDisableDeviceAuth": ${CONTROLUI_DISABLE_DEVICE_AUTH},
      "allowedOrigins": [
        "https://openclaw-aida.onrender.com",
        "https://flyttanu.vercel.app",
        "http://localhost:3000"
      ]
    },
    "http": {
      "endpoints": {
        "chatCompletions": { "enabled": true }
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "${MODEL_PRIMARY}",
        "fallbacks": ["${MODEL_FALLBACK}"]
      }
    },
    "list": [
      {
        "id": "main"
      },
      {
        "id": "aida-flyttagent",
        "name": "aida-flyttagent",
        "workspace": "${WORKSPACE_DIR}",
        "agentDir": "${AGENT_DIR}",
        "model": {
          "primary": "${MODEL_PRIMARY}",
          "fallbacks": ["${MODEL_FALLBACK}"]
        }
      }
    ]
  }
}
EOF

echo "[entrypoint] Config written — model=${MODEL_PRIMARY}, fallback=${MODEL_FALLBACK}, port=${LISTEN_PORT}, bind=${BIND_MODE}"
echo "[entrypoint] Model policy — allowed prefixes: ${ALLOWED_MODEL_PREFIXES_RAW}, enforce=${MODEL_POLICY_ENFORCE}, lockEnabled=${MODEL_LOCK_ENABLED}"
echo "[entrypoint] OpenClaw version: ${OPENCLAW_VERSION:-unknown}"
echo "[entrypoint] controlUi.dangerouslyDisableDeviceAuth=${CONTROLUI_DISABLE_DEVICE_AUTH}"

if [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  exec openclaw gateway --port "${LISTEN_PORT}" --bind "${BIND_MODE}" --token "${OPENCLAW_GATEWAY_TOKEN}" --allow-unconfigured
fi

exec openclaw gateway --port "${LISTEN_PORT}" --bind "${BIND_MODE}" --allow-unconfigured
