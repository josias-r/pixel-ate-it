#!/bin/sh

if [ -n "$PUBLIC_URL" ]; then
    echo "Injecting PUBLIC_URL: $PUBLIC_URL"
    sed -i "s|__PUBLIC_URL_PLACEHOLDER__|$PUBLIC_URL|g" /usr/share/nginx/html/assets/*.js
else
    echo "No PUBLIC_URL provided, defaulting to https://your-production-domain.com/"
    sed -i "s|__PUBLIC_URL_PLACEHOLDER__|https://your-production-domain.com/|g" /usr/share/nginx/html/assets/*.js
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
