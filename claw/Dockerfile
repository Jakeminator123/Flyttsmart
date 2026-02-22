FROM node:22-alpine

RUN apk add --no-cache git

# Install OpenClaw — version matches local: 2026.2.21-2
RUN npm install -g openclaw

# Seed files (IDENTITY.md, workspace skills) — no secrets in image
RUN mkdir -p /app/seed/workspace
COPY config/agents/aida-flyttagent/agent/IDENTITY.md /app/seed/IDENTITY.md
COPY config/workspace/ /app/seed/workspace/

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 18789

COPY docker-healthcheck.sh /usr/local/bin/docker-healthcheck.sh
RUN chmod +x /usr/local/bin/docker-healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD docker-healthcheck.sh

ENTRYPOINT ["docker-entrypoint.sh"]
