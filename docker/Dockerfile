FROM node:20-slim

# System tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl wget python3 python3-pip build-essential \
    procps htop vim nano sudo \
    && rm -rf /var/lib/apt/lists/*

# Install ttyd from GitHub release (not in Debian repos)
RUN curl -fsSL -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
    && chmod +x /usr/local/bin/ttyd

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Create workspace user with sudo access (for apt-get install)
RUN useradd -m -s /bin/bash user && echo 'user ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Copy workspace server
WORKDIR /opt/workspace
COPY container/ .
RUN npm install --production && chmod +x entrypoint.sh

ENV PORT=3000 TTYD_PORT=7681 TTYD_CMD=claude FILES_ROOT=/home/user/workspace

EXPOSE 3000

ENTRYPOINT ["/opt/workspace/entrypoint.sh"]
CMD ["node", "server.js"]
