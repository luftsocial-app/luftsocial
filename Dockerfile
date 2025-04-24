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
RUN npm run build
RUN npm prune --production

#PROD
FROM $IMAGE AS prod
COPY --chown=node:node --from=prod-build /app/dist /app/dist
COPY --chown=node:node --from=prod-build /app/node_modules /app/node_modules
COPY --chown=node:node --from=prod-build /app/.env /app/dist/.env

USER node
ENV NODE_ENV=production
WORKDIR /app/dist
ENTRYPOINT ["sh", "-c", "npm run:migration && exec node ./main.js"]
CMD [""]


