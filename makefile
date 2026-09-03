####################################################################
# FSI Agentic Lending — makefile
# One FastAPI backend (uv) + Next.js frontend + BIAN migration tooling.
####################################################################

# Target database for the migration/index targets. Override per invocation:
#   make load-data DB=fin_migration
DB ?= leafy_bank_bian

MIGRATION_DIR = ../../../bian-data-model/migration/lending

# ---------- BIAN collection naming ----------
# The migration renamed every collection but the code resolves names through
# env vars (COLL_<LOGICAL>), so the rename is config-only. This block is the
# single source of truth for that mapping — the same values belong in
# backend/.env for docker, and in the Kanopy secret for staging/prod.
#
# Passing them on the command line is safe even when backend/.env also sets
# them: load_dotenv() does NOT override an already-set variable, so make wins.
#
# ⚠️ Reading these in one place is not the same as applying them. If a rename
# looks like it had no effect, find the code that actually opens the collection
# (see defects.md `saver-ignores-collection-env`).
BIAN_ENV = \
	DATABASE_NAME=$(DB) \
	COLL_APPLICATIONS=loans \
	COLL_CREDIT_REPORTS=creditReports \
	COLL_PAYMENTS=loanRepayments \
	COLL_DOCUMENTS=lendingDocuments \
	COLL_UNDERWRITING_POLICIES=lendingUnderwritingPolicies \
	COLL_AGENT_ACTIVITY=lendingAgentActivity \
	COLL_CONVERSATIONS=lendingConversations \
	COLL_INTERVENTIONS=lendingInterventions \
	COLL_HITL_AUDIT=lendingHitlAudit \
	COLL_PIPELINE_LOCKS=lendingPipelineLocks \
	COLL_OFFICERS=lendingOfficers \
	COLL_RENEWALS=lendingRenewals \
	DOCUMENTS_VECTOR_INDEX=lendingDocumentsVectorIdx \
	POLICIES_VECTOR_INDEX=lendingPoliciesVectorIdx

# `uv run python -m uvicorn`, NOT `uv run uvicorn` and NOT .venv/bin/uvicorn.
# `python -m` uses the interpreter directly and ignores console-script shebangs,
# so a relocated or copied venv cannot misdirect it. Same lesson as the
# leaf-bank-bian makefile (2026-08-31).
UVICORN = uv run python -m uvicorn

# ---------- Docker (all services) ----------
build:
	docker compose build

up:
	docker compose up --build -d

start:
	docker compose start

stop:
	docker compose stop

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	docker compose down --rmi all -v

# ---------- Local dev ----------
# Backend on 8000: frontend/next.config.mjs rewrites /api/backend/* to
# $NEXT_PUBLIC_BACKEND_URL/api/*, defaulting to http://localhost:8000.
# Change the port here and the frontend proxy breaks silently.
dev-backend:
	cd backend && $(BIAN_ENV) $(UVICORN) main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

kill-ports:
	@for port in 3000 8000; do \
		pids=$$(lsof -ti :$$port 2>/dev/null); \
		if [ -n "$$pids" ]; then \
			echo "Killing process on port $$port (PID $$pids)"; \
			kill -9 $$pids 2>/dev/null || true; \
		fi; \
	done

dev: kill-ports
	trap 'kill 0' INT; \
	(cd backend && $(BIAN_ENV) $(UVICORN) main:app --reload --host 0.0.0.0 --port 8000) & \
	(cd frontend && npm run dev) & \
	wait

# ---------- Setup ----------
install-backend:
	cd backend && uv sync

install-frontend:
	cd frontend && npm install --no-audit

setup: install-backend install-frontend

install-uv:
	curl -LsSf https://astral.sh/uv/install.sh | sh

uv-update:
	cd backend && uv lock --upgrade

# ---------- BIAN migration ----------
# Requires MONGODB_URI exported. The cluster comes from the URI; the database
# from DB (default leafy_bank_bian).

# Parse and validate the prepared JSON without connecting. Needs no URI.
load-dry:
	cd $(MIGRATION_DIR) && python3 load.py --db $(DB) --dry-run

# Upsert all 10 prepared collections. Idempotent — safe to re-run.
# `customers` is $$setOnInsert only (the accounts service owns that directory)
# and is gated by a conflict pre-flight on both customerId and fullName.
load-data:
	cd $(MIGRATION_DIR) && python3 load.py --db $(DB)

# Regenerate the prepared JSON from the dump. Pure file-to-file, no DB access.
transform:
	cd $(MIGRATION_DIR) && python3 transform.py && python3 transform_agentic.py

validate-data:
	cd $(MIGRATION_DIR) && python3 validate.py

# Create collections + regular indexes + both vector indexes, and seed the
# officer. Run AFTER load-data: Atlas Search builds take minutes and do not
# need an empty collection.
create-indexes:
	cd backend && $(BIAN_ENV) uv run python -m scripts.create_indexes

# ---------- Verify ----------
# Doc counts, index counts, orphan-FK check, and vector index status.
verify:
	@mongosh "$$MONGODB_URI" --quiet --eval ' \
		const d = db.getSiblingDB("$(DB)"); \
		const expect = {loans:17, creditReports:29, loanRepayments:180, \
			lendingDocuments:237, lendingUnderwritingPolicies:16, \
			lendingAgentActivity:741, lendingConversations:5, \
			lendingInterventions:20, lendingHitlAudit:2}; \
		let bad = 0; \
		for (const [c, n] of Object.entries(expect)) { \
			const got = d[c].countDocuments({}); \
			const ok = got >= n; \
			if (!ok) bad++; \
			print((ok ? "  ok   " : "  FAIL ") + c.padEnd(30) + got + "/" + n + \
				"  idx:" + d[c].getIndexes().length); \
		} \
		const orphans = d.loanRepayments.aggregate([ \
			{$$lookup:{from:"loans",localField:"loanId",foreignField:"loansId",as:"l"}}, \
			{$$match:{l:{$$size:0}}},{$$count:"n"}]).toArray(); \
		print(orphans.length === 0 ? "  ok   loanRepayments -> loans FK: no orphans" \
			: "  FAIL orphan repayments: " + JSON.stringify(orphans)); \
		for (const c of ["lendingDocuments","lendingUnderwritingPolicies"]) { \
			d[c].getSearchIndexes().forEach(i => \
				print("  " + (i.status === "READY" ? "ok  " : "wait") + "  " + c + \
					" search idx " + i.name + " [" + i.status + "]")); \
		} \
		if (bad) { print("\n" + bad + " collection(s) below expected count"); quit(1); } \
	'

# Which collections in the target DB are not ours? The BIAN DB is shared, so a
# count above our own is expected — this shows what else is in there.
survey:
	@mongosh "$$MONGODB_URI" --quiet --eval ' \
		const d = db.getSiblingDB("$(DB)"); \
		d.getCollectionNames().sort().forEach(c => \
			print("  " + c.padEnd(34) + d[c].countDocuments({}))); \
	'

# ---------- Sanity ----------
check:
	cd backend && $(BIAN_ENV) uv run python -c "from main import app; print('OK backend imports')"

# Show the resolved collection mapping without running anything.
show-env:
	@echo "DB = $(DB)"
	@for kv in $(BIAN_ENV); do echo "  $$kv"; done

.PHONY: build up start stop down logs clean \
	dev dev-backend dev-frontend kill-ports \
	install-backend install-frontend setup install-uv uv-update \
	load-dry load-data transform validate-data create-indexes \
	verify survey check show-env
