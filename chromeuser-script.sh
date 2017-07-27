#!/bin/bash

# Run headless chrome. Unstable v61
nohup google-chrome-unstable \
  --headless \
  --disable-gpu \
  --disable-web-security \
--remote-debugging-port=9222 'about:blank' &
