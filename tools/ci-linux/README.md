# Локальный CI на Linux

Для каждого полного прогона задайте новое общее имя проекта Compose через
`COMPOSE_PROJECT_NAME` во всех терминалах. У проекта свой том отчётов.
Из корня репозитория соберите образ. Повторяйте сборку после изменения исходников.
Docker кэширует слой с зависимостями отдельно от кода.

```sh
docker compose -f tools/ci-linux/compose.yaml build
```

Каждая команда запускает отдельный Linux-контейнер. На машине с 20 логическими
CPU и 15,5 ГиБ для Docker запускайте `engines` (Firefox и WebKit) до старта
четырёх шардов или после их этапа unit/touch. При одновременном старте шести
контейнеров тесты сессий Firefox/WebKit превышали тайм-аут 15 с.
`checks` выполняет статику, сборку и проверки dist.
Том `tessera-ci-linux-checks-cache` хранит кэши Prettier, ESLint и TypeScript
между проектами Compose. После изменения lockfile или конфигурации проверок
создаётся новый каталог кэша. Отчёты гайдов хранятся отдельно для каждого прогона.

```sh
docker compose -f tools/ci-linux/compose.yaml run --rm tests 1
docker compose -f tools/ci-linux/compose.yaml run --rm tests 2
docker compose -f tools/ci-linux/compose.yaml run --rm tests 3
docker compose -f tools/ci-linux/compose.yaml run --rm tests 4
docker compose -f tools/ci-linux/compose.yaml run --rm tests engines
docker compose -f tools/ci-linux/compose.yaml run --rm tests checks
```

После успешного завершения всех четырёх шардов выполните общую сверку гайдов.
Контраст разбит на четыре равные части. Для проверки свежей таблицы шарды
получают по 4/1/1/4 истории из каждой десятки. Сверка проверяет состав частей,
baseline, состояния каталога и тестовые стенды по объединённым результатам.

```sh
docker compose -f tools/ci-linux/compose.yaml run --rm tests guides merge
```

При обновлении Playwright в lockfile обновите тег его Ubuntu-образа в Dockerfile.
Чтобы сохранить контейнер и снимки упавших тестов для разбора, опустите `--rm`.
