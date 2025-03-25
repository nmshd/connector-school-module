set -e
set -x

npm i
npm i --prefix school-module

# linting
npx tsc -p school-module/tsconfig.json
npx prettier . --check

# auditing
npx better-npm-audit audit && cd school-module && npx better-npm-audit audit && cd ..
