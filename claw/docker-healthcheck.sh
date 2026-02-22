#!/bin/sh
wget -qO- "http://localhost:${OPENCLAW_GATEWAY_PORT:-18789}/health" || exit 1
