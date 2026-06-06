FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

FROM deps AS build
COPY . .
RUN yarn build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    CONFIG_DIR=/config \
    PORT=6614
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn workspaces focus --all --production
COPY --from=build /app/dist ./dist
EXPOSE 6614
CMD ["node", "dist/server/main.js"]
