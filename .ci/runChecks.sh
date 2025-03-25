set -e
set -x

npm i

# linting
npx tsc
npx prettier . --check

# auditing
npx better-npm-audit audit
