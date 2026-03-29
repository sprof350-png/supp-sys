@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo   Syndicate Management System - Setup and Run
echo ===================================================
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Node.js detected.
echo.

:: Check if node_modules exists, if not run npm install
if not exist "node_modules\" (
    echo [2/3] Installing dependencies... This may take a few minutes...
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b
    )
) else (
    echo [2/3] Dependencies already installed.
)

echo.
echo [3/3] Starting the application...
echo.
echo The application will be available at http://localhost:3000
echo.

:: Run the application
call npm run dev

pause
