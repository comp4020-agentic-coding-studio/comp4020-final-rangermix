# syntax = docker/dockerfile:1

# Three stages: the client (TypeScript, built by Vite), the server (one Rust
# binary), and the slim image Fly runs. The course's fixed shape still holds:
# HTTP on 0.0.0.0:$PORT, state only under /data, README.md published at /readme/.

FROM node:24-slim AS client
WORKDIR /src
RUN npm install -g pnpm@11.9.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY client/package.json client/
RUN pnpm install --frozen-lockfile --filter cafe-client
COPY client/ client/
COPY content/ content/
RUN pnpm -C client build

FROM rust:1.93-slim-bookworm AS server
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY server/Cargo.toml server/
# Build the dependencies on their own first, so a code change doesn't rebuild them.
RUN mkdir -p server/src && echo 'fn main() {}' > server/src/main.rs \
    && cargo build --release -p cafe \
    && rm -rf server/src
COPY server/ server/
RUN touch server/src/main.rs && cargo build --release -p cafe

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=server /src/target/release/cafe /app/cafe
COPY --from=client /src/client/dist /app/client
COPY content/ /app/content/
COPY README.md /app/README.md
COPY docs/ /app/docs/
ENV PORT=8080 \
    DATA_DIR=/data \
    CONTENT_DIR=/app/content \
    CLIENT_DIR=/app/client \
    README_PATH=/app/README.md \
    DOCS_DIR=/app/docs
EXPOSE 8080
CMD ["/app/cafe"]
