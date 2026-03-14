@echo off
chcp 65001 >nul 2>nul
title SNOW IDE
color 0B

echo.
echo  ============================================
echo     SNOW IDE - Professional Code Editor
echo  ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "NODE_DIR=%SCRIPT_DIR%node"
set "NODE_VERSION=v20.11.1"
set "NODE_ARCH=win-x64"
set "NODE_FOLDER=node-%NODE_VERSION%-%NODE_ARCH%"
set "NODE_ZIP=%NODE_FOLDER%.zip"
set "NODE_URL=https://nodejs.org/dist/%NODE_VERSION%/%NODE_ZIP%"

REM ============================================
REM  Check Node.js
REM ============================================
if exist "%NODE_DIR%\node.exe" (
    echo [OK] Using portable Node.js ^(already installed^)
    set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"
    goto :node_ready
)

where node >nul 2>nul
if not errorlevel 1 (
    echo [OK] System Node.js found
    goto :node_ready
)

REM ============================================
REM  Auto-download portable Node.js (first time only)
REM ============================================
echo.
echo  Node.js not found. Downloading automatically...
echo  This will only happen ONCE on first launch.
echo.

if not exist "%NODE_DIR%" mkdir "%NODE_DIR%"

echo  Downloading Node.js from nodejs.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%SCRIPT_DIR%%NODE_ZIP%' -UseBasicParsing; Write-Host '[OK] Download complete' } catch { Write-Host '[ERROR] Download failed:' $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :node_failed

echo  Extracting Node.js...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path '%SCRIPT_DIR%%NODE_ZIP%' -DestinationPath '%SCRIPT_DIR%' -Force; Write-Host '[OK] Extraction complete' } catch { Write-Host '[ERROR] Extraction failed:' $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :node_failed

if exist "%SCRIPT_DIR%%NODE_FOLDER%" (
    xcopy /E /Y /Q "%SCRIPT_DIR%%NODE_FOLDER%\*" "%NODE_DIR%\" >nul
    rmdir /S /Q "%SCRIPT_DIR%%NODE_FOLDER%"
)
if exist "%SCRIPT_DIR%%NODE_ZIP%" del /Q "%SCRIPT_DIR%%NODE_ZIP%"

if not exist "%NODE_DIR%\node.exe" goto :node_failed

echo  [OK] Portable Node.js installed!
set "PATH=%NODE_DIR%;%NODE_DIR%\node_modules\.bin;%PATH%"
goto :node_ready

:node_failed
echo  [ERROR] Node.js installation failed!
echo  Please install Node.js manually from https://nodejs.org
if exist "%SCRIPT_DIR%%NODE_ZIP%" del /Q "%SCRIPT_DIR%%NODE_ZIP%"
pause
exit /b 1

:node_ready
echo [OK] Node.js: & node --version
echo [OK] npm: & call npm --version

REM ============================================
REM  Portable Runtimes (first time only)
REM ============================================
echo.
echo  Checking portable runtimes...
set "RUNTIMES_DIR=%SCRIPT_DIR%runtimes"
if not exist "%RUNTIMES_DIR%" mkdir "%RUNTIMES_DIR%"

REM --- Python 3.12 ---
if exist "%RUNTIMES_DIR%\python\python.exe" (
    echo [OK] Python 3.12 ^(portable^)
) else (
    echo  Downloading Python 3.12 embeddable...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip' -OutFile '%RUNTIMES_DIR%\python.zip' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :python_done
    if not exist "%RUNTIMES_DIR%\python" mkdir "%RUNTIMES_DIR%\python"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%RUNTIMES_DIR%\python.zip' -DestinationPath '%RUNTIMES_DIR%\python' -Force"
    del /Q "%RUNTIMES_DIR%\python.zip" 2>nul
    REM Enable standard library imports
    if exist "%RUNTIMES_DIR%\python\python312._pth" (
        echo import site >> "%RUNTIMES_DIR%\python\python312._pth"
    )
    if exist "%RUNTIMES_DIR%\python\python.exe" (
        echo [OK] Python 3.12 installed
    ) else (
        echo [WARN] Python extraction failed
    )
)
:python_done

REM --- Go 1.22 ---
if exist "%RUNTIMES_DIR%\go\bin\go.exe" (
    echo [OK] Go 1.22 ^(portable^)
) else (
    echo  Downloading Go 1.22...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://go.dev/dl/go1.22.0.windows-amd64.zip' -OutFile '%RUNTIMES_DIR%\go.zip' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :go_done
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%RUNTIMES_DIR%\go.zip' -DestinationPath '%RUNTIMES_DIR%' -Force"
    del /Q "%RUNTIMES_DIR%\go.zip" 2>nul
    if exist "%RUNTIMES_DIR%\go\bin\go.exe" (
        echo [OK] Go 1.22 installed
    ) else (
        echo [WARN] Go extraction failed
    )
)
:go_done

REM --- Java (Adoptium JDK 21) ---
if exist "%RUNTIMES_DIR%\java\bin\javac.exe" (
    echo [OK] Java 21 ^(portable^)
) else (
    echo  Downloading Java 21 ^(Adoptium JDK^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%%2B13/OpenJDK21U-jdk_x64_windows_hotspot_21.0.2_13.zip' -OutFile '%RUNTIMES_DIR%\java.zip' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :java_done
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%RUNTIMES_DIR%\java.zip' -DestinationPath '%RUNTIMES_DIR%' -Force"
    del /Q "%RUNTIMES_DIR%\java.zip" 2>nul
    REM Rename extracted folder to java
    if exist "%RUNTIMES_DIR%\jdk-21.0.2+13" (
        ren "%RUNTIMES_DIR%\jdk-21.0.2+13" "java"
    )
    if exist "%RUNTIMES_DIR%\java\bin\javac.exe" (
        echo [OK] Java 21 installed
    ) else (
        echo [WARN] Java extraction failed
    )
)
:java_done

REM --- C++ (w64devkit / MinGW) ---
if exist "%RUNTIMES_DIR%\mingw\bin\g++.exe" (
    echo [OK] C++ / g++ ^(portable^)
) else (
    echo  Downloading C++ compiler ^(w64devkit^)...
    REM w64devkit v2.0+ ships as a self-extracting 7z archive (.7z.exe).
    REM The self-extractor is a GUI app and does not work in console scripts.
    REM Use 7zr.exe (command-line 7-zip) to extract it instead.
    REM Step 1: Download 7zr.exe (standalone command-line 7-zip extractor)
    if not exist "%RUNTIMES_DIR%\7zr.exe" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://www.7-zip.org/a/7zr.exe' -OutFile '%RUNTIMES_DIR%\7zr.exe' -UseBasicParsing; Write-Host '[OK] 7zr downloaded' } catch { Write-Host '[WARN] 7zr download failed'; exit 1 }"
        if errorlevel 1 goto :cpp_done
    )
    REM Step 2: Download w64devkit archive
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://github.com/skeeto/w64devkit/releases/download/v2.5.0/w64devkit-x64-2.5.0.7z.exe' -OutFile '%RUNTIMES_DIR%\w64devkit.7z.exe' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :cpp_done
    REM Step 3: Extract using 7zr
    echo  Extracting C++ compiler...
    "%RUNTIMES_DIR%\7zr.exe" x "%RUNTIMES_DIR%\w64devkit.7z.exe" -o"%RUNTIMES_DIR%" -y >nul 2>&1
    del /Q "%RUNTIMES_DIR%\w64devkit.7z.exe" 2>nul
    del /Q "%RUNTIMES_DIR%\7zr.exe" 2>nul
    REM Rename w64devkit to mingw
    if exist "%RUNTIMES_DIR%\w64devkit" (
        ren "%RUNTIMES_DIR%\w64devkit" "mingw"
    )
    if exist "%RUNTIMES_DIR%\mingw\bin\g++.exe" (
        echo [OK] C++ compiler installed
    ) else (
        echo [WARN] C++ compiler extraction failed
    )
)
:cpp_done

REM --- PHP 8.3 ---
if exist "%RUNTIMES_DIR%\php\php.exe" (
    echo [OK] PHP 8.3 ^(portable^)
) else (
    echo  Downloading PHP 8.3...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://windows.php.net/downloads/releases/php-8.3.29-nts-Win32-vs16-x64.zip' -OutFile '%RUNTIMES_DIR%\php.zip' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :php_done
    if not exist "%RUNTIMES_DIR%\php" mkdir "%RUNTIMES_DIR%\php"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%RUNTIMES_DIR%\php.zip' -DestinationPath '%RUNTIMES_DIR%\php' -Force"
    del /Q "%RUNTIMES_DIR%\php.zip" 2>nul
    if exist "%RUNTIMES_DIR%\php\php.exe" (
        echo [OK] PHP 8.3 installed
    ) else (
        echo [WARN] PHP extraction failed
    )
)
:php_done

REM --- .NET SDK 8.0 (C#) ---
if exist "%RUNTIMES_DIR%\dotnet\dotnet.exe" (
    echo [OK] .NET SDK 8.0 ^(portable^)
) else (
    echo  Downloading .NET SDK 8.0...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-win-x64.zip' -OutFile '%RUNTIMES_DIR%\dotnet.zip' -UseBasicParsing; Write-Host '[OK] Downloaded' } catch { Write-Host '[WARN] Download failed'; exit 1 }"
    if errorlevel 1 goto :dotnet_done
    if not exist "%RUNTIMES_DIR%\dotnet" mkdir "%RUNTIMES_DIR%\dotnet"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '%RUNTIMES_DIR%\dotnet.zip' -DestinationPath '%RUNTIMES_DIR%\dotnet' -Force"
    del /Q "%RUNTIMES_DIR%\dotnet.zip" 2>nul
    if exist "%RUNTIMES_DIR%\dotnet\dotnet.exe" (
        echo [OK] .NET SDK 8.0 installed
    ) else (
        echo [WARN] .NET SDK extraction failed
    )
)
:dotnet_done

echo.
echo [OK] Portable runtimes ready!

REM ============================================
REM  Step 1: Install backend
REM ============================================
echo.
echo  [1/5] Checking backend dependencies...
cd /d "%SCRIPT_DIR%backend"
if exist "node_modules" (
    echo [OK] Backend dependencies already installed ^(portable^)
    goto :backend_ready
)
echo  Installing backend dependencies...
call npm install --legacy-peer-deps 2>nul
if not exist "node_modules" (
    echo [ERROR] Backend installation failed!
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed
:backend_ready

REM ============================================
REM  Step 2: Install frontend
REM ============================================
echo.
echo  [2/5] Checking frontend dependencies...
cd /d "%SCRIPT_DIR%frontend"
if exist "node_modules" (
    echo [OK] Frontend dependencies already installed ^(portable^)
    goto :frontend_ready
)
echo  Installing frontend dependencies...
call npm install --legacy-peer-deps 2>nul
if not exist "node_modules" (
    echo [ERROR] Frontend installation failed!
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed
:frontend_ready

REM ============================================
REM  Step 3: Docker setup
REM ============================================
echo.
echo  [3/5] Checking Docker...
where docker >nul 2>nul
if not errorlevel 1 goto :docker_exists

echo  Docker not found. Downloading Docker Desktop installer (~600MB)...
echo  Download progress will be shown below:
echo.

REM Use BITS transfer for reliable download with progress
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
    "$url = 'https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe';" ^
    "$outFile = '%SCRIPT_DIR%DockerDesktopInstaller.exe';" ^
    "try {" ^
    "  Import-Module BitsTransfer -ErrorAction Stop;" ^
    "  Start-BitsTransfer -Source $url -Destination $outFile -DisplayName 'Docker Desktop' -Description 'Downloading...';" ^
    "  Write-Host '  [OK] Docker Desktop downloaded!';" ^
    "} catch {" ^
    "  Write-Host '  BITS failed, trying WebClient...';" ^
    "  try {" ^
    "    $wc = New-Object System.Net.WebClient;" ^
    "    $total = 0; $lastPrint = 0;" ^
    "    Register-ObjectEvent $wc DownloadProgressChanged -Action {" ^
    "      $p = $EventArgs.ProgressPercentage;" ^
    "      if ($p -ge ($script:lastPrint + 5)) {" ^
    "        $script:lastPrint = $p;" ^
    "        $mbDone = [math]::Round($EventArgs.BytesReceived/1MB);" ^
    "        $mbTotal = [math]::Round($EventArgs.TotalBytesToReceive/1MB);" ^
    "        Write-Host ('  Progress: {0}%% ({1}MB / {2}MB)' -f $p, $mbDone, $mbTotal);" ^
    "      }" ^
    "    } | Out-Null;" ^
    "    $wc.DownloadFileAsync((New-Object Uri $url), $outFile);" ^
    "    while ($wc.IsBusy) { Start-Sleep -Milliseconds 500 };" ^
    "    Write-Host '  [OK] Docker Desktop downloaded!';" ^
    "  } catch {" ^
    "    Write-Host ('  [WARN] Download failed: ' + $_.Exception.Message);" ^
    "    exit 1;" ^
    "  }" ^
    "}"

if errorlevel 1 goto :docker_skip
if not exist "%SCRIPT_DIR%DockerDesktopInstaller.exe" goto :docker_skip

echo.
echo  Running Docker Desktop installer...
echo  Follow the installer prompts on screen.
echo.
start /wait "" "%SCRIPT_DIR%DockerDesktopInstaller.exe" install --accept-license
del /Q "%SCRIPT_DIR%DockerDesktopInstaller.exe" 2>nul
echo  [OK] Docker installer finished.
echo  NOTE: You may need to restart your PC for Docker to work.
goto :docker_check

:docker_skip
echo  [INFO] Skipping Docker. Running in simulation mode.
echo         Install Docker Desktop from https://docker.com for full execution.
del /Q "%SCRIPT_DIR%DockerDesktopInstaller.exe" 2>nul
goto :docker_done

:docker_exists
echo  [OK] Docker found.

:docker_check
REM ============================================
REM  Step 4: Build Docker images
REM ============================================
echo.
echo  [4/5] Building Docker images...
where docker >nul 2>nul
if errorlevel 1 goto :docker_not_available
docker info >nul 2>nul
if not errorlevel 1 goto :docker_running

REM Docker is installed but daemon is not running - try to start it
echo  [INFO] Docker daemon not running. Attempting to start Docker Desktop...

REM Try common Docker Desktop locations
set "DOCKER_DESKTOP_FOUND=0"
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    set "DOCKER_DESKTOP_FOUND=1"
)
if "%DOCKER_DESKTOP_FOUND%"=="0" (
    if exist "%LOCALAPPDATA%\Docker\Docker Desktop.exe" (
        start "" "%LOCALAPPDATA%\Docker\Docker Desktop.exe"
        set "DOCKER_DESKTOP_FOUND=1"
    )
)
if "%DOCKER_DESKTOP_FOUND%"=="0" (
    if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
        set "DOCKER_DESKTOP_FOUND=1"
    )
)

if "%DOCKER_DESKTOP_FOUND%"=="0" (
    echo  [WARN] Docker Desktop executable not found.
    echo         Please start Docker Desktop manually and re-run start.bat.
    goto :docker_not_available
)

echo  [INFO] Docker Desktop is starting. Waiting up to 60 seconds...
set "DOCKER_WAIT=0"
:docker_wait_loop
if %DOCKER_WAIT% GEQ 60 goto :docker_start_timeout
timeout /t 3 /nobreak >nul
set /a DOCKER_WAIT+=3
docker info >nul 2>nul
if not errorlevel 1 (
    echo  [OK] Docker Desktop started successfully!
    goto :docker_running
)
echo  [INFO] Waiting for Docker... (%DOCKER_WAIT%s / 60s)
goto :docker_wait_loop

:docker_start_timeout
echo  [WARN] Docker Desktop did not start within 60 seconds.
echo         It may still be loading. You can re-run start.bat later.
goto :docker_not_available

:docker_running
echo  [OK] Docker is running! Building language images...
call "%SCRIPT_DIR%docker\build-images.bat"
goto :docker_done

:docker_not_available
echo  [INFO] Docker not available. Starting in simulation mode.
echo         Start Docker Desktop and re-run start.bat for full execution.

:docker_done

REM ============================================
REM  Step 5: Start everything (single window)
REM ============================================
echo.
echo  [5/5] Starting SNOW IDE...
echo.

REM Start backend as minimized background process
cd /d "%SCRIPT_DIR%backend"
start /min "" cmd /c "title SnowIDE-Backend && npm run dev"

echo  Waiting for backend...
timeout /t 4 /nobreak >nul

REM Start frontend as minimized background process
cd /d "%SCRIPT_DIR%frontend"
start /min "" cmd /c "title SnowIDE-Frontend && npm run dev"

echo  Waiting for frontend...
timeout /t 4 /nobreak >nul

REM Open browser
start "" "http://localhost:3000" 2>nul

echo.
echo  ============================================
echo     SNOW IDE is running!
echo.
echo     http://localhost:3000
echo.
echo     Press any key to STOP and exit...
echo  ============================================

pause >nul

echo.
echo  Stopping...
taskkill /FI "WINDOWTITLE eq SnowIDE-Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq SnowIDE-Frontend*" /F >nul 2>nul
taskkill /IM "node.exe" /F >nul 2>nul
echo  [OK] Stopped.
