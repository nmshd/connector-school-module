set -e
set -x

npm i

# linting
npm run lint:tsc
npm run lint:eslint
npm run lint:prettier

# auditing
npx license-check
npx better-npm-audit audit
