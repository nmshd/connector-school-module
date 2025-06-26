set -e
set -x

npm i

# linting
npm run lint:tsc
npm run lint:eslint
npm run lint:prettier

# auditing
npx license-check --include-dev --ignoreLicenses "BSD*" "(MIT OR GPL-3.0)" "(MIT OR GPL-3.0-or-later)" --ignorePackages eu.enmeshed.connectorui@1.0.0 buffers@0.1.1
npx better-npm-audit audit
