#!/usr/bin/env bash

set -e

export $(cat .env.connector | xargs)

if [ -z "$CONNECTOR_VERSION" ]; then
    echo "The environment variable 'CONNECTOR_VERSION' must be set."
    exit 1
fi

if [ -z "$SCHOOL_MODULE_VERSION" ]; then
    echo "The environment variable 'SCHOOL_MODULE_VERSION' must be set."
    exit 1
fi

mkdir zipworkdir && cd zipworkdir

wget https://github.com/nmshd/connector/releases/download/${CONNECTOR_VERSION}/connector-${CONNECTOR_VERSION}.zip

unzip connector-${CONNECTOR_VERSION}.zip

npm install --save-exact @nmshd/connector-school-module@${SCHOOL_MODULE_VERSION} --omit=dev
cat ../bundled.config.json | jq -r 'del(.modules.school.assetsLocation)' >./bundled.config.json

zip -r "../connector-${SCHOOL_MODULE_VERSION}.zip" dist package.json package-lock.json bundled.config.json

cd .. && rm -rf zipworkdir
