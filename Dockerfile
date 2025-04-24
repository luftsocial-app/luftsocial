ARG IMAGE=node:22-alpine

#COMMON
FROM $IMAGE AS builder
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .

#DEVELOPMENT
FROM builder AS dev 
CMD [""]

#PROD MIDDLE STEP
FROM builder AS prod-build
RUN rm -rf dist
RUN npm run build
RUN npm prune --omit=dev

#PROD
FROM $IMAGE AS prod
WORKDIR /app
COPY --chown=node:node --from=prod-build /app/node_modules /app/node_modules
COPY --chown=node:node --from=prod-build /app/dist ./dist
COPY --chown=node:node --from=prod-build /app/config ./dist/config

# Create uploads directory in /tmp (writable by default)
RUN mkdir -p /tmp/uploads

ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "dist/src/main.js"]
CMD [""]



