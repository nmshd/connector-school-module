set -e
set -x

npm i

# linting
npm run lint:tsc
npm run lint:eslint
npm run lint:prettier

# auditing
npx license-check --include-dev --ignoreLicenses="BSD*"
npx better-npm-audit audit
