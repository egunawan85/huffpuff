#!/bin/bash
set -e

PERSIST_DIR="/home/user"
USR_LOCAL_PERSIST="$PERSIST_DIR/.local-packages"

# Create workspace dir if first run
mkdir -p "$PERSIST_DIR/workspace"

# Persistent package installs: overlay user-installed packages
# apt installs to /usr/local, npm -g to /usr/local/lib/node_modules, pip to ~/.local
mkdir -p "$USR_LOCAL_PERSIST/bin" "$USR_LOCAL_PERSIST/lib" "$USR_LOCAL_PERSIST/share"
mkdir -p "$PERSIST_DIR/.local/bin" "$PERSIST_DIR/.local/lib"

# Add persistent paths to PATH
export PATH="$USR_LOCAL_PERSIST/bin:$PERSIST_DIR/.local/bin:$PATH"

# Make dpkg/apt install to persistent location
export DESTDIR=""

exec "$@"
