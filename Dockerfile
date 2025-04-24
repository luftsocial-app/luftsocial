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
RUN ls dist/
RUN ls dist/src
RUN npm prune --production

#PROD
FROM $IMAGE AS prod
COPY --chown=node:node --from=prod-build /app/dist /app/dist
COPY --chown=node:node --from=prod-build /app/node_modules /app/node_modules
RUN ls /app
RUN ls /app/dist
RUN ls /app/dist/src
# COPY --chown=node:node --from=prod-build /app/.env /app/dist/.env

USER node
ENV NODE_ENV=production
# ENTRYPOINT ["node ./main.js"]
CMD [ "node", "dist/src/main.js" ]


