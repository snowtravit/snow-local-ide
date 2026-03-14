#!/bin/bash
# SNOW IDE - Start Script (Linux/macOS)
# Automatically downloads Node.js and Docker if not installed

set -e

echo ""
echo "  ============================================"
echo "     SNOW IDE - Professional Code Editor"
echo "  ============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_DIR="$SCRIPT_DIR/node"
NODE_VERSION="v20.11.1"

# ============================================
#  Detect OS and architecture
# ============================================
detect_platform() {
    local OS ARCH
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    
    case "$OS" in
        Linux)  OS="linux" ;;
        Darwin) OS="darwin" ;;
        *)      echo "[ERROR] Unsupported OS: $OS"; exit 1 ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64)  ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        armv7l)        ARCH="armv7l" ;;
        *)             echo "[ERROR] Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    
    echo "${OS}-${ARCH}"
}

# ============================================
#  Check for local portable Node.js first
# ============================================
if [ -x "$NODE_DIR/bin/node" ]; then
    echo "[OK] Using portable Node.js (already installed)"
    export PATH="$NODE_DIR/bin:$PATH"
elif command -v node &> /dev/null; then
    echo "[OK] System Node.js found: $(node --version)"
else
    # ============================================
    #  Auto-download portable Node.js (first time only)
    # ============================================
    echo ""
    echo "  Node.js not found on this computer."
    echo "  Downloading portable Node.js automatically..."
    echo "  This will only happen ONCE on first launch."
    echo ""
    
    PLATFORM="$(detect_platform)"
    NODE_FOLDER="node-${NODE_VERSION}-${PLATFORM}"
    NODE_ARCHIVE="${NODE_FOLDER}.tar.xz"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_ARCHIVE}"
    
    echo "  Downloading from nodejs.org ..."
    echo "  URL: $NODE_URL"
    echo "  Please wait, this may take a few minutes..."
    echo ""
    
    # Download
    if command -v curl &> /dev/null; then
        curl -fSL --progress-bar -o "$SCRIPT_DIR/$NODE_ARCHIVE" "$NODE_URL"
    elif command -v wget &> /dev/null; then
        wget --show-progress -O "$SCRIPT_DIR/$NODE_ARCHIVE" "$NODE_URL"
    else
        echo "[ERROR] Neither curl nor wget found! Cannot download Node.js."
        echo "Please install Node.js manually from https://nodejs.org"
        exit 1
    fi
    
    if [ ! -f "$SCRIPT_DIR/$NODE_ARCHIVE" ]; then
        echo "[ERROR] Download failed!"
        echo "Please check your internet connection and try again."
        exit 1
    fi
    
    echo "  Extracting Node.js..."
    mkdir -p "$NODE_DIR"
    tar -xJf "$SCRIPT_DIR/$NODE_ARCHIVE" -C "$SCRIPT_DIR"
    
    # Move extracted files to node directory
    if [ -d "$SCRIPT_DIR/$NODE_FOLDER" ]; then
        cp -r "$SCRIPT_DIR/$NODE_FOLDER/"* "$NODE_DIR/"
        rm -rf "$SCRIPT_DIR/$NODE_FOLDER"
    fi
    
    # Clean up archive
    rm -f "$SCRIPT_DIR/$NODE_ARCHIVE"
    
    if [ -x "$NODE_DIR/bin/node" ]; then
        echo "  [OK] Portable Node.js installed successfully!"
        export PATH="$NODE_DIR/bin:$PATH"
    else
        echo "  [ERROR] Node.js installation failed!"
        echo "  Please install Node.js manually from https://nodejs.org"
        exit 1
    fi
fi

echo "[OK] Node.js: $(node --version)"
echo "[OK] npm: $(npm --version)"

# ============================================
#  Portable Runtimes (first time only)
# ============================================
echo ""
echo "  Checking portable runtimes..."
RUNTIMES_DIR="$SCRIPT_DIR/runtimes"
mkdir -p "$RUNTIMES_DIR"

PLATFORM="$(detect_platform)"
CURRENT_OS="$(uname -s)"

# Helper: download a file
download_file() {
    local url="$1" dest="$2"
    if command -v curl &> /dev/null; then
        curl -fSL --progress-bar -o "$dest" "$url"
    elif command -v wget &> /dev/null; then
        wget --show-progress -O "$dest" "$url"
    else
        echo "[WARN] Neither curl nor wget found, cannot download"
        return 1
    fi
}

# --- Python ---
if [ -x "$RUNTIMES_DIR/python/bin/python3" ] || [ -x "$RUNTIMES_DIR/python/bin/python" ]; then
    echo "[OK] Python (portable)"
elif command -v python3 &> /dev/null; then
    echo "[OK] Python (system): $(python3 --version)"
else
    echo "  Downloading portable Python..."
    PYTHON_URL=""
    case "$PLATFORM" in
        linux-x64)  PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.12.1+20240107-x86_64-unknown-linux-gnu-install_only.tar.gz" ;;
        linux-arm64) PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.12.1+20240107-aarch64-unknown-linux-gnu-install_only.tar.gz" ;;
        darwin-x64)  PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.12.1+20240107-x86_64-apple-darwin-install_only.tar.gz" ;;
        darwin-arm64) PYTHON_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-3.12.1+20240107-aarch64-apple-darwin-install_only.tar.gz" ;;
    esac
    if [ -n "$PYTHON_URL" ]; then
        download_file "$PYTHON_URL" "$RUNTIMES_DIR/python.tar.gz" && {
            tar -xzf "$RUNTIMES_DIR/python.tar.gz" -C "$RUNTIMES_DIR/"
            rm -f "$RUNTIMES_DIR/python.tar.gz"
            if [ -x "$RUNTIMES_DIR/python/bin/python3" ]; then
                echo "  [OK] Python installed"
            else
                echo "  [WARN] Python extraction failed"
            fi
        } || echo "  [WARN] Python download failed"
    else
        echo "  [WARN] No Python build available for $PLATFORM"
    fi
fi

# --- Go ---
if [ -x "$RUNTIMES_DIR/go/bin/go" ]; then
    echo "[OK] Go (portable)"
elif command -v go &> /dev/null; then
    echo "[OK] Go (system): $(go version)"
else
    echo "  Downloading Go 1.22..."
    GO_URL=""
    case "$PLATFORM" in
        linux-x64)   GO_URL="https://go.dev/dl/go1.22.0.linux-amd64.tar.gz" ;;
        linux-arm64) GO_URL="https://go.dev/dl/go1.22.0.linux-arm64.tar.gz" ;;
        darwin-x64)  GO_URL="https://go.dev/dl/go1.22.0.darwin-amd64.tar.gz" ;;
        darwin-arm64) GO_URL="https://go.dev/dl/go1.22.0.darwin-arm64.tar.gz" ;;
    esac
    if [ -n "$GO_URL" ]; then
        download_file "$GO_URL" "$RUNTIMES_DIR/go.tar.gz" && {
            tar -xzf "$RUNTIMES_DIR/go.tar.gz" -C "$RUNTIMES_DIR/"
            rm -f "$RUNTIMES_DIR/go.tar.gz"
            if [ -x "$RUNTIMES_DIR/go/bin/go" ]; then
                echo "  [OK] Go installed"
            else
                echo "  [WARN] Go extraction failed"
            fi
        } || echo "  [WARN] Go download failed"
    fi
fi

# --- Java (Adoptium JDK 21) ---
if [ -x "$RUNTIMES_DIR/java/bin/javac" ]; then
    echo "[OK] Java 21 (portable)"
elif command -v javac &> /dev/null; then
    echo "[OK] Java (system)"
else
    echo "  Downloading Java 21 (Adoptium JDK)..."
    JAVA_URL=""
    JAVA_DIR_NAME=""
    case "$PLATFORM" in
        linux-x64)
            JAVA_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_linux_hotspot_21.0.2_13.tar.gz"
            JAVA_DIR_NAME="jdk-21.0.2+13"
            ;;
        linux-arm64)
            JAVA_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_aarch64_linux_hotspot_21.0.2_13.tar.gz"
            JAVA_DIR_NAME="jdk-21.0.2+13"
            ;;
        darwin-x64)
            JAVA_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_x64_mac_hotspot_21.0.2_13.tar.gz"
            JAVA_DIR_NAME="jdk-21.0.2+13"
            ;;
        darwin-arm64)
            JAVA_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.2%2B13/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.2_13.tar.gz"
            JAVA_DIR_NAME="jdk-21.0.2+13"
            ;;
    esac
    if [ -n "$JAVA_URL" ]; then
        download_file "$JAVA_URL" "$RUNTIMES_DIR/java.tar.gz" && {
            tar -xzf "$RUNTIMES_DIR/java.tar.gz" -C "$RUNTIMES_DIR/"
            rm -f "$RUNTIMES_DIR/java.tar.gz"
            # Handle macOS vs Linux directory structure
            if [ -d "$RUNTIMES_DIR/$JAVA_DIR_NAME/Contents/Home" ]; then
                mv "$RUNTIMES_DIR/$JAVA_DIR_NAME/Contents/Home" "$RUNTIMES_DIR/java"
                rm -rf "$RUNTIMES_DIR/$JAVA_DIR_NAME"
            elif [ -d "$RUNTIMES_DIR/$JAVA_DIR_NAME" ]; then
                mv "$RUNTIMES_DIR/$JAVA_DIR_NAME" "$RUNTIMES_DIR/java"
            fi
            if [ -x "$RUNTIMES_DIR/java/bin/javac" ]; then
                echo "  [OK] Java 21 installed"
            else
                echo "  [WARN] Java extraction failed"
            fi
        } || echo "  [WARN] Java download failed"
    fi
fi

# --- C++ (g++) ---
if command -v g++ &> /dev/null; then
    echo "[OK] C++ / g++ (system)"
else
    echo "[INFO] g++ not found."
    if [ "$CURRENT_OS" = "Linux" ]; then
        echo "  Attempting to install g++ via apt..."
        sudo apt-get update -qq && sudo apt-get install -y -qq g++ 2>/dev/null && {
            echo "  [OK] g++ installed"
        } || echo "  [WARN] Could not install g++. Run: sudo apt install g++"
    elif [ "$CURRENT_OS" = "Darwin" ]; then
        echo "  Run: xcode-select --install"
    fi
fi

# --- PHP ---
if command -v php &> /dev/null; then
    echo "[OK] PHP (system): $(php -v | head -1)"
else
    echo "[INFO] PHP not found."
    if [ "$CURRENT_OS" = "Linux" ]; then
        echo "  Attempting to install PHP via apt..."
        sudo apt-get update -qq && sudo apt-get install -y -qq php-cli 2>/dev/null && {
            echo "  [OK] PHP installed"
        } || echo "  [WARN] Could not install PHP. Run: sudo apt install php-cli"
    elif [ "$CURRENT_OS" = "Darwin" ]; then
        if command -v brew &> /dev/null; then
            brew install php 2>/dev/null && echo "  [OK] PHP installed" || echo "  [WARN] Run: brew install php"
        else
            echo "  Run: brew install php"
        fi
    fi
fi

# --- .NET SDK 8.0 (C#) ---
if [ -x "$RUNTIMES_DIR/dotnet/dotnet" ]; then
    echo "[OK] .NET SDK 8.0 (portable)"
elif command -v dotnet &> /dev/null; then
    echo "[OK] .NET SDK (system)"
else
    echo "  Downloading .NET SDK 8.0..."
    DOTNET_URL=""
    case "$PLATFORM" in
        linux-x64)   DOTNET_URL="https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-linux-x64.tar.gz" ;;
        linux-arm64) DOTNET_URL="https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-linux-arm64.tar.gz" ;;
        darwin-x64)  DOTNET_URL="https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-osx-x64.tar.gz" ;;
        darwin-arm64) DOTNET_URL="https://dotnetcli.azureedge.net/dotnet/Sdk/8.0.404/dotnet-sdk-8.0.404-osx-arm64.tar.gz" ;;
    esac
    if [ -n "$DOTNET_URL" ]; then
        mkdir -p "$RUNTIMES_DIR/dotnet"
        download_file "$DOTNET_URL" "$RUNTIMES_DIR/dotnet.tar.gz" && {
            tar -xzf "$RUNTIMES_DIR/dotnet.tar.gz" -C "$RUNTIMES_DIR/dotnet/"
            rm -f "$RUNTIMES_DIR/dotnet.tar.gz"
            if [ -x "$RUNTIMES_DIR/dotnet/dotnet" ]; then
                echo "  [OK] .NET SDK 8.0 installed"
            else
                echo "  [WARN] .NET SDK extraction failed"
            fi
        } || echo "  [WARN] .NET SDK download failed"
    fi
fi

echo ""
echo "[OK] Portable runtimes ready!"

echo ""
echo "  [1/5] Checking backend dependencies..."
echo "  ----------------------------------------"
cd "$SCRIPT_DIR/backend"
if [ -d "node_modules" ]; then
    echo "[OK] Backend dependencies already installed (portable)"
else
    echo "  Installing backend dependencies..."
    npm install --legacy-peer-deps
    echo "[OK] Backend dependencies installed"
fi

echo ""
echo "  [2/5] Checking frontend dependencies..."
echo "  ------------------------------------------"
cd "$SCRIPT_DIR/frontend"
if [ -d "node_modules" ]; then
    echo "[OK] Frontend dependencies already installed (portable)"
else
    echo "  Installing frontend dependencies..."
    npm install --legacy-peer-deps
    echo "[OK] Frontend dependencies installed"
fi

echo ""
echo "  [3/5] Setting up Docker..."
echo "  ---------------------------"
if ! command -v docker &> /dev/null; then
    echo "[INFO] Docker not found. Installing Docker automatically..."
    echo ""
    
    CURRENT_OS="$(uname -s)"
    
    if [ "$CURRENT_OS" = "Linux" ]; then
        echo "  Installing Docker via official install script..."
        echo "  This may ask for your sudo password."
        echo ""
        
        if command -v curl &> /dev/null; then
            curl -fsSL https://get.docker.com -o "$SCRIPT_DIR/get-docker.sh"
        elif command -v wget &> /dev/null; then
            wget -qO "$SCRIPT_DIR/get-docker.sh" https://get.docker.com
        fi
        
        if [ -f "$SCRIPT_DIR/get-docker.sh" ]; then
            sudo sh "$SCRIPT_DIR/get-docker.sh" || {
                echo "[WARN] Docker installation failed."
                echo "[INFO] Continuing without Docker (simulation mode)."
            }
            rm -f "$SCRIPT_DIR/get-docker.sh"
            
            # Add current user to docker group so sudo isn't needed
            if command -v docker &> /dev/null; then
                sudo usermod -aG docker "$USER" 2>/dev/null || true
                echo ""
                echo "  [OK] Docker installed successfully!"
                echo "  NOTE: You may need to log out and log back in (or run 'newgrp docker')"
                echo "        for Docker to work without sudo."
                echo ""
                
                # Start Docker service
                sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
            fi
        else
            echo "[WARN] Could not download Docker install script."
            echo "[INFO] Continuing without Docker (simulation mode)."
        fi
        
    elif [ "$CURRENT_OS" = "Darwin" ]; then
        # macOS - try Homebrew first, then suggest Docker Desktop
        if command -v brew &> /dev/null; then
            echo "  Installing Docker via Homebrew..."
            brew install --cask docker || {
                echo "[WARN] Homebrew Docker install failed."
                echo "[INFO] Please install Docker Desktop manually from https://docker.com/products/docker-desktop"
                echo "[INFO] Continuing without Docker (simulation mode)."
            }
            
            if [ -d "/Applications/Docker.app" ]; then
                echo "  [OK] Docker Desktop installed!"
                echo "  Starting Docker Desktop..."
                open /Applications/Docker.app
                echo "  Waiting for Docker to start (this may take up to 60 seconds)..."
                for i in $(seq 1 30); do
                    if docker info &> /dev/null; then
                        echo "  [OK] Docker is running!"
                        break
                    fi
                    sleep 2
                done
            fi
        else
            echo "[INFO] Homebrew not found."
            echo "[INFO] Please install Docker Desktop manually from https://docker.com/products/docker-desktop"
            echo "[INFO] Continuing without Docker (simulation mode)."
        fi
    fi
    echo ""
fi

echo ""
echo "  [4/5] Building Docker images..."
echo "  ---------------------------------"
if ! command -v docker &> /dev/null; then
    echo "[INFO] Docker not available - running in simulation mode"
elif docker info &> /dev/null; then
    echo "[OK] Docker is running! Building language images..."
    bash "$SCRIPT_DIR/docker/build-images.sh"
else
    echo "[INFO] Docker installed but daemon not running. Attempting to start..."
    
    DOCKER_STARTED=0
    CURRENT_OS="$(uname -s)"
    
    if [ "$CURRENT_OS" = "Linux" ]; then
        sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    elif [ "$CURRENT_OS" = "Darwin" ]; then
        if [ -d "/Applications/Docker.app" ]; then
            open /Applications/Docker.app 2>/dev/null
        fi
    fi
    
    echo "  Waiting up to 60 seconds for Docker to start..."
    for i in $(seq 1 20); do
        if docker info &> /dev/null; then
            echo "  [OK] Docker started successfully!"
            DOCKER_STARTED=1
            break
        fi
        echo "  Waiting... ($((i*3))s / 60s)"
        sleep 3
    done
    
    if [ "$DOCKER_STARTED" = "1" ]; then
        echo "[OK] Docker is running! Building language images..."
        bash "$SCRIPT_DIR/docker/build-images.sh"
    else
        echo "[INFO] Docker did not start within 60 seconds."
        echo "       Please start Docker manually and re-run start.sh."
        echo "       Starting in simulation mode for now..."
    fi
fi

echo ""
echo "  [5/5] Starting SNOW IDE..."
echo "  ----------------------------"

# Start backend
cd "$SCRIPT_DIR/backend"
npm run dev &
BACKEND_PID=$!

# Wait for backend
echo "Waiting for backend to start..."
sleep 5

# Start frontend
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend
sleep 5

# Try to open browser
if command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:3000" 2>/dev/null &
elif command -v open &> /dev/null; then
    open "http://localhost:3000" 2>/dev/null &
fi

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

echo ""
echo "  ============================================"
echo "     SNOW IDE is running!"
echo ""
echo "     Open in browser:"
echo "     http://localhost:3000"
echo ""
echo "     Backend API:"
echo "     http://localhost:4000/api"
echo ""
echo "     Access from other devices:"
echo "     http://$LOCAL_IP:3000"
echo ""
echo "     Press Ctrl+C to stop all services..."
echo "  ============================================"

# Cleanup on exit
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "[OK] All services stopped."
}

trap cleanup EXIT INT TERM

# Wait for processes
wait
