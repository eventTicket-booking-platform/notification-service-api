FROM node:20-alpine AS deps
WORKDIR /home/node/app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /home/node/app

COPY --chown=node:node --from=deps /home/node/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src

USER node
EXPOSE 9094

CMD ["node", "src/server.js"]
