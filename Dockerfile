FROM nginx:bookworm

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy frontend build from host (built by GitHub Actions)
COPY app/dist /usr/share/nginx/html

# Copy rust binary from host (built by GitHub Actions)
COPY server/target/release/pixel-ate-it /usr/local/bin/pixel-ate-it

# Copy start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# The Rust server listens on 3000 by default, Nginx on 80
EXPOSE 80
EXPOSE 3000/udp
EXPOSE 3001/tcp

# Set the PORT for the rust server
ENV PORT=3000
ENV WS_PORT=3001

CMD ["/start.sh"]
