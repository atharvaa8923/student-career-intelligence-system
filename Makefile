# Portable root developer commands (GNU make + bash; Linux, macOS, CI).
# `make help` lists targets. Nothing here deploys or touches a hosted database.
SHELL := bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

JSOM_BE := implementations/jsom-planner/backend
JSOM_FE := implementations/jsom-planner/frontend
SYL_BE  := implementations/syllabus-check/backend
SYL_FE  := implementations/syllabus-check/frontend
PYTHON  ?= python3

.PHONY: help install install-node install-python test test-unit test-node test-python test-db \
        test-migrations lint build audit secrets health dev-up check

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-16s %s\n", $$1, $$2}'

install: install-node install-python ## Install all dependencies from lockfiles

install-node: ## npm ci for both apps
	cd $(JSOM_BE) && npm ci
	cd $(JSOM_FE) && npm ci --legacy-peer-deps
	cd $(SYL_FE) && npm ci

install-python: ## Create implementations/syllabus-check/.venv with backend requirements
	cd implementations/syllabus-check && $(PYTHON) -m venv .venv && .venv/bin/pip install -r backend/requirements.txt pytest

test: test-unit test-db ## Unit tests + SQL replay

test-unit: test-node test-python ## Fast tests (no database)

test-node: ## JSOM signup-role guard
	node --test implementations/tests/signup-roles.cjs

test-python: ## Standard-library guards + SyllabusCheck pytest
	$(PYTHON) -m unittest implementations.tests.test_signup_roles implementations.tests.test_route_authorization -v
	cd $(SYL_BE) && $(PYTHON) -m pytest tests -q

test-db: ## Replay migrations/import/SQL assertions (needs PG* env and pgvector)
	scripts/db-replay-test.sh

test-migrations: ## Legacy Alembic + JSOM bootstrap test (needs STEP2_PGHOST/PORT)
	$(PYTHON) -m unittest implementations.tests.test_schema_migrations -v

lint: ## Syntax checks
	find $(JSOM_BE)/src -name '*.js' -print0 | xargs -0 -n1 node --check
	$(PYTHON) -m compileall -q $(SYL_BE)
	bash -n scripts/*.sh

build: ## Production builds of both frontends
	cd $(JSOM_FE) && npm run build
	cd $(SYL_FE) && npm run build

audit: ## Dependency advisories (report; see docs for accepted backlog)
	cd $(JSOM_BE) && npm audit --omit=dev || true
	cd $(JSOM_FE) && npm audit --omit=dev || true
	cd $(SYL_FE) && npm audit --omit=dev || true

secrets: ## Pattern-based secret scan of tracked files
	scripts/secret-scan.sh

health: ## Aggregate health check (see scripts/health.sh for env vars)
	scripts/health.sh

dev-up: ## Start both apps locally from .env (see .env.example)
	scripts/dev-up.sh

check: lint test-unit secrets ## What CI's fast job runs
