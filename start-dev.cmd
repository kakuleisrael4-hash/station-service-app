@echo off
REM ---------------------------------------------------------------------
REM  Lanceur dev pour STATION KKC OIL.
REM  Le process de la preview MCP a un PATH obsolète qui ne trouve pas node/npm,
REM  donc on prepend l'install Node officielle avant de lancer Vite.
REM ---------------------------------------------------------------------
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
if not exist "node_modules" (
  echo [station] Installation des dependances...
  call npm install
)
echo [station] Demarrage de Vite sur http://localhost:3001 ...
call npm run dev
