ARG CONNECTOR_VERSION
ARG SCHOOL_MODULE_VERSION

FROM ghcr.io/nmshd/connector:${CONNECTOR_VERSION}

LABEL org.opencontainers.image.source="https://github.com/nmshd/connector-school-module"

USER root

RUN npm install @nmshd/connector-school-module@${SCHOOL_MODULE_VERSION} --omit=dev

USER node
