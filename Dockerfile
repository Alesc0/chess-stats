FROM oven/bun:1-alpine

ARG VERSION
LABEL org.opencontainers.image.version="${VERSION}"

WORKDIR /app

# Install fonts required for SVG->PNG text rendering (resvg needs system fonts)
RUN apk add --no-cache fontconfig ttf-dejavu

# Install production dependencies only
COPY package.json ./
RUN bun install --production

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "src/index.js"]
