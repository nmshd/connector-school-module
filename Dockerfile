FROM node:23.10.0 AS module-builder

WORKDIR /usr/app

COPY . .

RUN npm install && cd school-module && npm install && npx tsc

FROM ghcr.io/nmshd/connector:6.17.1

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=5 CMD [ "node", "/usr/app/dist/healthcheck.js" ]
LABEL org.opencontainers.image.source="https://github.com/nmshd/connector"

COPY --from=module-builder /usr/app/school-module/dist /usr/app/custom-modules/school-module/dist
COPY --from=module-builder /usr/app/school-module/package.json /usr/app/custom-modules/school-module/package.json

USER root

RUN cd /usr/app/custom-modules/school-module && npm install --omit=dev

USER node

ENTRYPOINT ["/usr/bin/tini", "--", "node", "/usr/app/dist/index.js"]
CMD ["start"]