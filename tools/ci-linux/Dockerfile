FROM node:25.9.0-bookworm-slim AS node
FROM mcr.microsoft.com/playwright:v1.63.0-noble

COPY --from=node /usr/local/ /usr/local/
WORKDIR /workspace
COPY package.json package-lock.json .nvmrc ./
RUN npm ci --no-audit --no-fund && node -e "const fs = require('node:fs'); const assert = require('node:assert/strict'); assert.equal(process.versions.node.split('.')[0], fs.readFileSync('.nvmrc', 'utf8').trim()); for (const browser of ['chromium', 'firefox', 'webkit']) fs.accessSync(require('playwright')[browser].executablePath(), fs.constants.X_OK)"
COPY . .

ENV CI=true TZ=UTC
ENTRYPOINT ["bash", "tools/ci-linux/run.sh"]
