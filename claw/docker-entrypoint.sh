#!/bin/sh
set -e

OPENCLAW_DIR="/root/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
AGENT_DIR="$OPENCLAW_DIR/agents/aida-flyttagent/agent"
WORKSPACE_DIR="$OPENCLAW_DIR/workspace-aida"
LISTEN_PORT="${PORT:-${OPENCLAW_GATEWAY_PORT:-18789}}"
BIND_MODE="${OPENCLAW_GATEWAY_BIND:-lan}"
MODEL_PRIMARY="${OPENCLAW_MODEL_PRIMARY:-openai/gpt-5.1-codex}"
MODEL_FALLBACK="${OPENCLAW_MODEL_FALLBACK:-openai/gpt-5.3-codex}"
OPENCLAW_VERSION="$(openclaw --version 2>/dev/null | tr -d '\r')"
CONTROLUI_DISABLE_DEVICE_AUTH="${OPENCLAW_CONTROLUI_DISABLE_DEVICE_AUTH:-false}"

case "$(echo "$CONTROLUI_DISABLE_DEVICE_AUTH" | tr '[:upper:]' '[:lower:]')" in
  1|true|y|yes)
    CONTROLUI_DISABLE_DEVICE_AUTH=true
    ;;
  *)
    CONTROLUI_DISABLE_DEVICE_AUTH=false
    ;;
esac

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

# Build optional custom providers block (JuiceFactory for Qwen, etc.)
CUSTOM_PROVIDERS=""
if [ -n "${JUICEFACTORY_API_KEY:-}" ]; then
  CUSTOM_PROVIDERS=$(cat <<'PROVIDERS_END'
  "models": {
    "providers": {
      "juicefactory": {
        "baseUrl": "https://api.juicefactory.ai/v1",
        "apiKey": "${JUICEFACTORY_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "qwen3-vl", "name": "Qwen 3 VL (JuiceFactory EU)" }
        ]
      }
    }
  },
PROVIDERS_END
)
  # Env-expand the API key in the providers block
  CUSTOM_PROVIDERS=$(echo "$CUSTOM_PROVIDERS" | sed "s|\${JUICEFACTORY_API_KEY}|${JUICEFACTORY_API_KEY}|g")
  echo "[entrypoint] JuiceFactory provider configured (qwen3-vl)"
fi

# Write OpenClaw config for container runtime.
cat > "$CONFIG_FILE" <<EOF
{
  ${CUSTOM_PROVIDERS}
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
echo "[entrypoint] OpenClaw version: ${OPENCLAW_VERSION:-unknown}"
echo "[entrypoint] controlUi.dangerouslyDisableDeviceAuth=${CONTROLUI_DISABLE_DEVICE_AUTH}"

if [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  exec openclaw gateway --port "${LISTEN_PORT}" --bind "${BIND_MODE}" --token "${OPENCLAW_GATEWAY_TOKEN}" --allow-unconfigured
fi

exec openclaw gateway --port "${LISTEN_PORT}" --bind "${BIND_MODE}" --allow-unconfigured
