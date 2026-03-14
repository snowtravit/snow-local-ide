@echo off
REM Build all Docker images for SNOW IDE code execution

echo =========================================
echo   Building SNOW IDE Docker Images
echo =========================================

for /D %%d in ("%~dp0images\*") do (
    if exist "%%d\Dockerfile" (
        echo.
        echo [Building] snow-ide-%%~nxd...
        docker build -t "snow-ide-%%~nxd" "%%d"
        if errorlevel 1 (
            echo [ERROR] Failed to build snow-ide-%%~nxd
        ) else (
            echo [OK] snow-ide-%%~nxd built successfully
        )
    )
)

echo.
echo =========================================
echo   Build complete!
echo =========================================
