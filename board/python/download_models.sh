#!/usr/bin/env sh
# Python handles verified downloads without requiring curl.
exec python3 "$(dirname "$0")/model_assets.py"
