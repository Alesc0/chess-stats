FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
