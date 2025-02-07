FROM node:23 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/resources /app/resources
COPY --from=build /app/dist /app/dist

RUN apt-get update \
    && apt-get install -y graphicsmagick \
    && apt-get clean

VOLUME [ "/app/credentials" ]
VOLUME [ "/app/instances" ]
VOLUME [ "/app/logs" ]
VOLUME [ "/app/maps" ]

CMD [ "pnpm", "start" ]
