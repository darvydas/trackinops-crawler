#!/usr/bin/env bash
set -e

su chromeuser /chromeuser-script.sh
sleep 3s

exec "$@"
