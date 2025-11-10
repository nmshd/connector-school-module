ARG CONNECTOR_VERSION=non-existing-default-tag

FROM ghcr.io/nmshd/connector:${CONNECTOR_VERSION}

ARG SCHOOL_MODULE_VERSION

LABEL org.opencontainers.image.source="https://github.com/nmshd/connector-school-module"

ADD bundled.config.json /usr/app/bundled.config.json

ADD bundled_assets /usr/app/bundled_assets

USER root

RUN npm install --save-exact @nmshd/connector-school-module@${SCHOOL_MODULE_VERSION} --omit=dev

USER node
