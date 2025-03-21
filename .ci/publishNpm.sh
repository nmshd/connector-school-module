set -e
set -x

if [ -z "$VERSION" ]; then
    echo "The environment variable 'VERSION' must be set."
    exit 1
fi

npm version $VERSION --no-git-tag-version
npx enhanced-publish --if-possible --use-preid-as-tag
