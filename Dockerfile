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
WORKDIR /app/dist
COPY --chown=node:node --from=prod-build /app/node_modules /app/node_modules
COPY --chown=node:node --from=prod-build /app/dist /app/dist
COPY --chown=node:node --from=prod-build /app/config /app/dist/config

# Create the uploads directory with the correct permissions
RUN mkdir -p /app/dist/tmp/uploads && chown -R node:node /app/dist/tmp/uploads

ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "src/main.js"]
CMD [""]



