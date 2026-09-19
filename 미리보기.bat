@echo off
title 클못 사이트 미리보기
cd /d "%~dp0"

echo.
echo   클못 사이트 미리보기를 켭니다. 잠시만 기다려 주세요.
echo.
echo   (이 창을 닫으면 미리보기도 꺼집니다)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preview-server.ps1"

if errorlevel 1 (
  echo.
  echo   [!] 미리보기를 켜지 못했습니다.
  echo       이 화면을 사진으로 찍어 보내 주세요.
  echo.
  pause
)
