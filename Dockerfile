FROM ghcr.io/nmshd/connector:6.18.0

ARG SCHOOL_MODULE_VERSION

LABEL org.opencontainers.image.source="https://github.com/nmshd/connector-school-module"

USER root

RUN npm install @nmshd/connector-school-module@${SCHOOL_MODULE_VERSION}

USER node
