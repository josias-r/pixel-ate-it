#!/bin/sh

# Start the Rust server in the background
/usr/local/bin/pixel-ate-it &

# Start Nginx in the foreground
exec nginx -g "daemon off;"
