# Stage 1: Prepare recipe with cargo-chef
FROM lukemathwalker/cargo-chef:latest-rust-1.97.1-slim AS chef
WORKDIR /usr/src/app/server

FROM chef AS planner
COPY server/Cargo.toml server/Cargo.lock ./
COPY server/src ./src
RUN cargo chef prepare --recipe-path recipe.json

# Stage 2: Build the Rust server
FROM chef AS backend-builder
# Build dependencies (this layer will be cached unless recipe.json changes)
COPY --from=planner /usr/src/app/server/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Build the actual application
COPY server/Cargo.toml server/Cargo.lock ./
COPY server/src ./src
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
