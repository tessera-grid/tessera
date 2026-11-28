# Локальный CI на Linux

Для каждого полного прогона задайте новое общее имя проекта Compose через
`COMPOSE_PROJECT_NAME` во всех терминалах. У проекта свой том отчётов.
Из корня репозитория соберите образ. Повторяйте сборку после изменения исходников.
Docker кэширует слой с зависимостями отдельно от кода.

```sh
docker compose -f tools/ci-linux/compose.yaml build
```

Каждая команда запускает отдельный Linux-контейнер. Код возврата ненулевой, если упал хотя бы один этап.
`engines` запускает набор CI для Firefox и WebKit.

```sh
docker compose -f tools/ci-linux/compose.yaml run --rm tests 1
docker compose -f tools/ci-linux/compose.yaml run --rm tests 2
docker compose -f tools/ci-linux/compose.yaml run --rm tests 3
docker compose -f tools/ci-linux/compose.yaml run --rm tests 4
docker compose -f tools/ci-linux/compose.yaml run --rm tests engines
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
