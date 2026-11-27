# Локальный CI на Linux

Из корня репозитория соберите образ. Повторяйте сборку после изменения исходников.
Docker кэширует слой с зависимостями отдельно от кода.

```sh
docker compose -f tools/ci-linux/compose.yaml build
```

Каждая команда запускает отдельный Linux-контейнер. Шард выполняет те же четыре
этапа, что и GitHub Actions. Код возврата ненулевой, если упал хотя бы один этап.
`engines` запускает набор CI для Firefox и WebKit.

```sh
docker compose -f tools/ci-linux/compose.yaml run --rm tests 1
docker compose -f tools/ci-linux/compose.yaml run --rm tests 2
docker compose -f tools/ci-linux/compose.yaml run --rm tests 3
docker compose -f tools/ci-linux/compose.yaml run --rm tests 4
docker compose -f tools/ci-linux/compose.yaml run --rm tests engines
```

При обновлении Playwright в lockfile обновите тег его Ubuntu-образа в Dockerfile.
Чтобы сохранить контейнер и снимки упавших тестов для разбора, опустите `--rm`.
