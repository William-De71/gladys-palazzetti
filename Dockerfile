# -----------------------------------------------------------------------------
# Palazzetti integration image.
#
# Gladys sandbox constraints ("the sandbox is the defense"):
#   - rootfs mounted READ-ONLY -> never write outside /data
#   - a single writable volume: /data
#   - runs as a non-root user
#   - multi-arch image (linux/amd64 + linux/arm64), see build.yml
#
# No extra system package is needed: the Connection Box speaks plain HTTP/JSON,
# reached with Node's built-in fetch.
# -----------------------------------------------------------------------------

FROM node:24-alpine

# The version label and the manifest label are added by build.yml.
LABEL org.opencontainers.image.title="gladys-palazzetti" \
      org.opencontainers.image.description="Local control of Palazzetti pellet stoves through their Connection Box, in Gladys Assistant" \
      org.opencontainers.image.source="https://github.com/William-De71/gladys-palazzetti" \
      org.opencontainers.image.licenses="Apache-2.0"

# dumb-init: correct signal handling (SIGTERM) for a graceful shutdown, which
# here means writing the pellet history to /data before the container stops.
RUN apk add --no-cache dumb-init

WORKDIR /app

# Install the PROD dependencies first (better build cache). `npm ci` only:
# a lockfile out of sync with package.json must fail the build, not be
# silently re-resolved into an untested dependency tree.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Then the integration code.
COPY index.js ./
COPY src ./src
COPY gladys-assistant-integration.json LICENSE NOTICE ./

# The only writable location allowed at runtime. Docker creates a new volume
# with the owner of the image's /data, so it must belong to `node`, and before
# VOLUME: changes made to /data after it are discarded.
ENV NODE_ENV=production
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

# Run as an unprivileged user (already present in the node image).
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
