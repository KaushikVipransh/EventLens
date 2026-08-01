@echo off
cd /d d:\EventLens
npx tsx apps\worker\src\index.ts > d:\EventLens\worker.out.log 2>&1
