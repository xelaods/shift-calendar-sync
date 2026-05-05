@echo off
cd /d "c:\vscodeapp"
node calendar-sync.js >> "%~dp0sync-log.txt" 2>&1
