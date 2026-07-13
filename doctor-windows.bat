@echo off
setlocal
cd /d "%~dp0"
node --version
pnpm --version
call pnpm test
call pnpm typecheck
call pnpm build
pause
