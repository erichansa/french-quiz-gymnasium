@echo off
chcp 65001 >nul
title Gymnasium 10e Français Studio
cd /d "%~dp0"

echo ============================================================
echo   Gymnasium 10e Français Studio - Studio d'Apprentissage
echo ============================================================
echo.
echo Server startet...
start "" "http://localhost:8765"
python server.py
pause
