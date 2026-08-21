#!/bin/bash
# FAGE Ghana Backend - Server Startup Script
# Usage: bash start-server.sh [port]

PORT=${1:-8000}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting FAGE Ghana API on port $PORT..."
echo "Directory: $DIR"
echo ""

cd "$DIR"

# Check if already running
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "Port $PORT is already in use. Stopping existing process..."
    kill $(lsof -t -i :$PORT) 2>/dev/null
    sleep 2
fi

# Start the server
php artisan serve --host=0.0.0.0 --port=$PORT

echo ""
echo "Server stopped."
