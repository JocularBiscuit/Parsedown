@echo off
REM Parsedown - double-click to run. Opens a console window with live server logs.
REM The server runs as long as this window is open; press Ctrl+C or close the
REM window to stop it.

REM Work from the folder this script lives in, so it works on any machine
REM (no hard-coded paths - important now that this is shared on GitHub).
cd /d "%~dp0"

set "URL=http://127.0.0.1:8000/"
set "PY=venv\Scripts\python.exe"

if not exist "%PY%" (
  echo Could not find the virtual environment at "%PY%".
  echo Create it first:  python -m venv venv  ^&^&  venv\Scripts\activate  ^&^&  pip install -r requirements.txt
  pause
  exit /b 1
)

REM If a server is already running, just open the page and stop here.
curl -s -o NUL "%URL%" >NUL 2>&1
if %ERRORLEVEL%==0 (
  echo Parsedown is already running - opening it in your browser.
  start "" "%URL%"
  exit /b 0
)

echo Starting Parsedown...
echo (The first launch can take ~15 seconds while the PDF engine loads.)
echo Your browser will open automatically when it's ready.
echo Leave this window open while you use the app. Press Ctrl+C here to stop it.
echo ------------------------------------------------------------

REM In the background: wait until the server actually answers, then open the browser.
start "" /b cmd /c "for /l %%i in (1,1,60) do (curl -s -o NUL "%URL%" >NUL 2>&1 && (start "" "%URL%" & exit) || ping -n 2 127.0.0.1 >NUL)"

REM Run the server in the foreground so its logs appear in this window.
"%PY%" -m uvicorn main:app --port 8000
