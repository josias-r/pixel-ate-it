# Stage 1: Build the Rust server
FROM rust:slim AS backend-builder
WORKDIR /usr/src/app

# Create a dummy project to cache dependencies
RUN cargo new server
WORKDIR /usr/src/app/server
COPY server/Cargo.toml server/Cargo.lock ./
# Build dependencies (this layer will be cached unless Cargo.toml/lock changes)
RUN cargo build --release
# Remove the dummy source
RUN rm src/*.rs

# Copy actual source code
COPY server/src ./src
# Touch main.rs to ensure Cargo knows it needs recompiling
RUN touch src/main.rs
# Build the actual application
RUN cargo build --release

# Stage 2: Build the frontend
FROM node:20 AS frontend-builder
WORKDIR /usr/src/app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json ./app/
RUN pnpm install --frozen-lockfile
COPY app ./app
WORKDIR /usr/src/app/app
# Create a dummy cert_hash.ts since it's gitignored but imported by network.ts
RUN echo 'export const hexHash = "__CERT_HASH_PLACEHOLDER__";' > src/cert_hash.ts
RUN pnpm run build

# Stage 3: Final image
FROM nginx:bookworm
# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy frontend build
COPY --from=frontend-builder /usr/src/app/app/dist /usr/share/nginx/html
# Copy rust binary
COPY --from=backend-builder /usr/src/app/server/target/release/pixel-ate-it /usr/local/bin/pixel-ate-it
# Copy start script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# The Rust server listens on 3000 by default, Nginx on 80
EXPOSE 80
EXPOSE 3000/udp

# Set the PORT for the rust server
ENV PORT=3000

CMD ["/start.sh"]
