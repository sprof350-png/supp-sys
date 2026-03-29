@echo off
echo ===================================================
echo   Syndicate Management System - Running...
echo ===================================================
echo.
echo [INFO] Fixed IP detected: 192.168.0.118
echo [INFO] Access the application at: http://192.168.0.118:3000
echo.
echo Starting the server...
echo.

:: Run the application
call npm run dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start the application.
    echo Make sure you have run setup_and_run.bat at least once.
    pause
)
