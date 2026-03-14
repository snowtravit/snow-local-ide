# ❄️ SNOW IDE

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.txt)
[![GitHub stars](https://img.shields.io/github/stars/YOUR_USERNAME/SNOW-IDE?style=social)](https://github.com/YOUR_USERNAME/SNOW-IDE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org)
![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/react-frontend-61DAFB)
![Node](https://img.shields.io/badge/node-%3E=18-green)
![Docker](https://img.shields.io/badge/docker-required-blue)

**A modern, secure, browser-based IDE that executes code instantly in isolated Docker containers.**

SNOW IDE brings the full power of a professional development environment to your browser. Write, edit, and run code in Python, Go, Java, C++, PHP, and C# — all powered by a secure, containerized backend. Built with industry-leading tools for speed, beauty, and developer delight.

---

## ✨ Features

- ⚡ **Instant execution** — Code runs in isolated Docker containers with zero setup
- 🌍 **Multi-language support** — Python, Go, Java, C++, PHP, C# (more coming soon)
- 🎨 **Beautiful modern UI** — Tailwind CSS + React for a pixel-perfect experience
- 🔒 **Enterprise-grade security** — Every execution happens in ephemeral Docker sandboxes
- 📁 **Full project workspace** — File explorer, folder support, and persistent sessions
- 📊 **Rich output** — Console, errors, and stdout with syntax highlighting

## 🏗️ Architecture


- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Monaco Editor
- **Backend**: Node.js + Express + Dockerode for container orchestration
- **Sandbox**: Lightweight, ephemeral Docker containers (one per execution)

## 📋 Supported Languages

| Language | Version     | Execution Environment      | Status |
|----------|-------------|----------------------------|--------|
| Python   | 3.12        | Official Python image      | ✅     |
| Go       | 1.22        | Official Golang image      | ✅     |
| Java     | 21          | OpenJDK                    | ✅     |
| C++      | GCC 13      | GCC image                  | ✅     |
| PHP      | 8.3         | Official PHP-CLI           | ✅     |
| C#       | .NET 8      | Official .NET SDK          | ✅     |

If Docker is not installed, download it from:

https://www.docker.com/get-started

## 📥 Installation & Quick Start WIN/LIN

```bash
# 1. download the folder from the repository
Download the folder from the "snow-local-ide" repository

# 2. Start Docker
Run Docker. It doesn't matter if you have Linux or Windows. I made it so it's equally easy.

# 3. Start the starter + Docker 
Open the folder and select
either
start.bat (if using Windows)
or
start.sh (if using Linux)

# 4. Loading modules
Please wait for all the data to load
and once it's done
you'll be taken to the SNOW IDE window
