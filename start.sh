#!/bin/sh

if [ -n "$PUBLIC_URL" ]; then
    echo "Injecting PUBLIC_URL: $PUBLIC_URL"
    sed -i "s|__PUBLIC_URL_PLACEHOLDER__|$PUBLIC_URL|g" /usr/share/nginx/html/assets/*.js
else
    echo "No PUBLIC_URL provided, defaulting to https://your-production-domain.com/"
    sed -i "s|__PUBLIC_URL_PLACEHOLDER__|https://your-production-domain.com/|g" /usr/share/nginx/html/assets/*.js
fi

# Start the Rust server in the background
/usr/local/bin/pixel-ate-it &

# Start Nginx in the foreground
exec nginx -g "daemon off;"
