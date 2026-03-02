FROM oven/bun:1-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json ./
RUN bun install --production

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["bun", "src/index.js"]
