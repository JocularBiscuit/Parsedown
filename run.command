#!/bin/bash
# Parsedown — double-click to run. Opens a Terminal window with live server logs.
# The server runs as long as this window is open; press Ctrl+C or close the
# window to stop it.

# Figure out the folder this script lives in, so it works on any machine
# (no hard-coded paths — important now that this is shared on GitHub).
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:8000/"

cd "$DIR" || { echo "Could not find the Parsedown folder."; exit 1; }

# If a server is already running, just open the page and stop here.
if /usr/bin/curl -s -o /dev/null "$URL"; then
  echo "Parsedown is already running — opening it in your browser."
  /usr/bin/open "$URL"
  exit 0
fi

echo "Starting Parsedown…"
echo "(The first launch can take ~15 seconds while the PDF engine loads.)"
echo "Your browser will open automatically when it's ready."
echo "Leave this window open while you use the app. Press Ctrl+C here to stop it."
echo "------------------------------------------------------------"

# In the background: wait until the server actually answers, then open the browser.
(
  for _ in $(seq 1 120); do          # up to ~60s
    if /usr/bin/curl -s -o /dev/null "$URL"; then
      /usr/bin/open "$URL"
      break
    fi
    sleep 0.5
  done
) &

# Run the server in the foreground so its logs appear in this window.
exec "$DIR/venv/bin/python" -m uvicorn main:app --port 8000
