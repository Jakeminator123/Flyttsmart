#!/bin/sh
set -e

OPENCLAW_DIR="/root/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
AGENT_DIR="$OPENCLAW_DIR/agents/aida-flyttagent/agent"
WORKSPACE_DIR="$OPENCLAW_DIR/workspace-aida"

# Ensure directories exist (important on first run with empty persistent volume)
mkdir -p "$AGENT_DIR"
mkdir -p "$WORKSPACE_DIR"

# Seed IDENTITY.md if not already present on the persistent volume
if [ ! -f "$AGENT_DIR/IDENTITY.md" ]; then
  cp /app/seed/IDENTITY.md "$AGENT_DIR/IDENTITY.md"
  echo "[entrypoint] Seeded IDENTITY.md for aida-flyttagent"
fi

# Seed workspace skills if present in image but not yet on volume
if [ -d "/app/seed/workspace" ]; then
  cp -rn /app/seed/workspace/. "$WORKSPACE_DIR/" 2>/dev/null || true
  echo "[entrypoint] Seeded workspace files"
fi

# Write a minimal OpenClaw config with the agents list.
# Token/port are passed via CLI flags/env (not persisted in config file).
cat > "$CONFIG_FILE" <<EOF
{
  "agents": {
    "list": [
      {
        "id": "main",
        "model": {
          "fallbacks": ["GPT (openai/gpt-5.3-codex)"]
        }
      },
      {
        "id": "aida-flyttagent",
        "name": "aida-flyttagent",
        "workspace": "${WORKSPACE_DIR}",
        "agentDir": "${AGENT_DIR}"
      }
    ]
  }
}
EOF

LISTEN_PORT="${PORT:-${OPENCLAW_GATEWAY_PORT:-18789}}"

echo "[entrypoint] Config written — starting OpenClaw gateway on port ${LISTEN_PORT}"

if [ -n "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  exec openclaw gateway --port "${LISTEN_PORT}" --token "${OPENCLAW_GATEWAY_TOKEN}"
fi

exec openclaw gateway --port "${LISTEN_PORT}"
