@echo off
cd /d d:\EventLens
npx tsx apps\api\src\index.ts > d:\EventLens\api.out.log 2>&1
