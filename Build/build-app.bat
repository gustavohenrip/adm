@echo off
setlocal

set "DIR=%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 20 ou maior.
  echo.
  pause
  exit /b 1
)

node "%DIR%build-app.mjs" %*
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo Build finalizado.
) else (
  echo Build falhou com codigo %CODE%.
)
echo.
pause
exit /b %CODE%
