#!/bin/sh

if [ -n "$PUBLIC_WT_URL" ]; then
    echo "Injecting PUBLIC_WT_URL: $PUBLIC_WT_URL"
    sed -i "s|__PUBLIC_WT_URL_PLACEHOLDER__|$PUBLIC_WT_URL|g" /usr/share/nginx/html/assets/*.js
else
    echo "ERROR: PUBLIC_WT_URL environment variable is required!"
    exit 1
fi

if [ -n "$PUBLIC_WS_URL" ]; then
    echo "Injecting PUBLIC_WS_URL: $PUBLIC_WS_URL"
    sed -i "s|__PUBLIC_WS_URL_PLACEHOLDER__|$PUBLIC_WS_URL|g" /usr/share/nginx/html/assets/*.js
else
    echo "ERROR: PUBLIC_WS_URL environment variable is required!"
    exit 1
fi

export CERT_HASH_PATH=/tmp/cert_hash.txt

# Start the Rust server in the background
/usr/local/bin/pixel-ate-it &

echo "Waiting for Rust server to generate cert hash..."
while [ ! -f /tmp/cert_hash.txt ]; do
  sleep 0.1
done

HASH=$(cat /tmp/cert_hash.txt)
echo "Got cert hash: $HASH"
sed -i "s|__CERT_HASH_PLACEHOLDER__|$HASH|g" /usr/share/nginx/html/assets/*.js

# Start Nginx in the foreground
exec nginx -g "daemon off;"
