ARG CONNECTOR_VERSION=non-existing-default-tag

FROM ghcr.io/nmshd/connector:${CONNECTOR_VERSION}

ARG SCHOOL_MODULE_VERSION

LABEL org.opencontainers.image.source="https://github.com/nmshd/connector-school-module"

USER root

RUN npm install --save-exact @nmshd/connector-school-module@${SCHOOL_MODULE_VERSION} --omit=dev

USER node
