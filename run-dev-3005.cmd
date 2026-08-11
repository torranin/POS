@echo off
cd /d E:\ProjectPOS\NewPOS
if not exist .next mkdir .next
"C:\Users\Gear\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "E:\ProjectPOS\NewPOS\node_modules\next\dist\bin\next" dev --turbopack -H 0.0.0.0 -p 3005 > ".next\dev-server.out.log" 2> ".next\dev-server.err.log"
