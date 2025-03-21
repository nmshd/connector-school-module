#!/usr/bin/env bash
set -e

if [ -z "$SCHOOL_MODULE_VERSION" ]; then
    echo "The environment variable 'SCHOOL_MODULE_VERSION' must be set."
    exit 1
fi

case "$SCHOOL_MODULE_VERSION" in
*-alpha*) BASE_TAG=alpha ;;
*-beta*) BASE_TAG=beta ;;
*-rc*) BASE_TAG=rc ;;
*) BASE_TAG=latest ;;
esac

echo "pushing tag '$BUILD_NUMBER' and '$COMMIT_HASH'"

REPO="ghcr.io/nmshd/connector-school-module"

TAGS="-t $REPO:$BUILD_NUMBER -t $REPO:$COMMIT_HASH"

OUTPUT="$(DOCKER_CLI_EXPERIMENTAL=enabled docker manifest inspect $REPO:${SCHOOL_MODULE_VERSION} 2>&1)" || true
if [[ $OUTPUT =~ (no such manifest: ghcr.io/nmshd/connector-school-module:) ]] || [[ $OUTPUT == "manifest unknown" ]]; then # manifest not found -> push
    echo "pushing tag '${BASE_TAG}' and '${SCHOOL_MODULE_VERSION}'"

    TAGS="$TAGS -t $REPO:$BASE_TAG -t $REPO:$SCHOOL_MODULE_VERSION"
elif [[ $OUTPUT =~ (\{) ]]; then # manifest found -> ignore
    echo "image '$SCHOOL_MODULE_VERSION' already exists"
else # other error
    echo $OUTPUT
fi

# TODO: enable provenance when open source: --provenance=true
docker buildx build --push \
    --sbom=true \
    --platform linux/amd64,linux/arm64 \
    $TAGS \
    $(sed 's/^/--build-arg /' .env.connector) \
    --build-arg SCHOOL_MODULE_VERSION=$SCHOOL_MODULE_VERSION .
