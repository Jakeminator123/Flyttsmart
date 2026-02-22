FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git wget \
 && rm -rf /var/lib/apt/lists/*

# Force git to use HTTPS (npm dependency uses SSH URL which requires ssh client)
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
 && git config --global url."https://github.com/".insteadOf "git@github.com:"

# Install OpenClaw — skip node-llama-cpp build (gateway uses OpenAI, not local LLM)
ENV NODE_LLAMA_CPP_SKIP_DOWNLOAD=true
RUN npm install -g openclaw --ignore-scripts

# Seed files (IDENTITY.md, workspace skills) — no secrets in image
RUN mkdir -p /app/seed/workspace
COPY config/agents/aida-flyttagent/agent/IDENTITY.md /app/seed/IDENTITY.md
COPY config/workspace/ /app/seed/workspace/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY docker-healthcheck.sh /usr/local/bin/docker-healthcheck.sh

RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-healthcheck.sh \
 && chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-healthcheck.sh

EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD docker-healthcheck.sh

ENTRYPOINT ["docker-entrypoint.sh"]
