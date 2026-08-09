ARG NODE_VERSION=18

FROM node:${NODE_VERSION}-bookworm AS dependencies

WORKDIR /src
COPY .npmrc package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm AS build

WORKDIR /src
COPY --from=dependencies /src/node_modules ./node_modules
COPY . .

ARG VERSION=0.0.0
ARG DEPLOY_TIME=UNKNOWN
ENV NEXT_TELEMETRY_DISABLED=1

RUN sed -i \
      -e "s|^const DEPLOY_TIME: string = .*|const DEPLOY_TIME: string = \"${DEPLOY_TIME}\";|" \
      -e "s|^const VERSION: string = .*|const VERSION: string = \"${VERSION}\";|" \
      app/debug/page.tsx \
    && npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

WORKDIR /app
ENV HOSTNAME=0.0.0.0 \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

COPY --from=build --chown=node:node /src/public ./public
COPY --from=build --chown=node:node /src/.next/standalone ./
COPY --from=build --chown=node:node /src/.next/static ./.next/static

USER node
EXPOSE 3000

CMD ["node", "server.js"]
