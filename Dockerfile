FROM node:23.10.0 AS module-builder

WORKDIR /usr/app

COPY . .

RUN npm install && npx tsc

FROM ghcr.io/nmshd/connector:6.17.1

LABEL org.opencontainers.image.source="https://github.com/nmshd/connector-school-module"

COPY --from=module-builder /usr/app/dist /usr/app/custom-modules/school-module/dist
COPY --from=module-builder /usr/app/package.json /usr/app/custom-modules/school-module/package.json
COPY --from=module-builder /usr/app/package-lock.json /usr/app/custom-modules/school-module/package-lock.json

USER root

RUN cd /usr/app/custom-modules/school-module && npm install --omit=dev

USER node
