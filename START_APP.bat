@echo off
echo.
echo  ===============================================
echo   CardCapture — Starting Local Server
echo  ===============================================
echo.
echo  Opening app at: http://localhost:8080
echo  Press CTRL+C to stop.
echo.

:: Try Python 3 first
python -m http.server 8080 --directory "%~dp0" 2>nul
if %errorlevel% neq 0 (
  :: Try Python 2
  python -m SimpleHTTPServer 8080 2>nul
  if %errorlevel% neq 0 (
    echo ERROR: Python not found.
    echo Please install Python from https://python.org
    echo OR open index.html directly in Chrome with:
    echo   --allow-file-access-from-files flag
    pause
  )
)
