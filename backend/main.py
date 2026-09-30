"""Agentic Lending Platform — FastAPI Backend."""
import asyncio
import logging
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

# Structured logging
try:
    from pythonjsonlogger import jsonlogger
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter(
        fmt='%(asctime)s %(levelname)s %(name)s %(message)s',
        rename_fields={'asctime': 'timestamp', 'levelname': 'level'},
    ))
    logging.root.handlers = [handler]
    logging.root.setLevel(logging.INFO)
except ImportError:
    logging.basicConfig(level=logging.INFO)

from db.mdb import get_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: log the collection boundary early.

    A wrong DATABASE_NAME or missing COLL_* mapping is the fastest way to get
    silent empty reads ("No documents found", empty chat checklist, zero-doc
    demo submits). Surface it at boot instead of at the first user click.
    """
    from db.mdb import verify_db_config
    try:
        verify_db_config()
    except Exception as e:  # pragma: no cover — safety net for a flaky boot
        logger.warning("Startup collection verification skipped: %s", e)
    yield
    # Shutdown
    from agents.llm import shutdown_llm
    from db.mdb import close_db
    shutdown_llm()
    close_db()


app = FastAPI(
    title="Agentic Lending Platform",
    description="Agentic lending platform API powered by MongoDB Atlas and LangGraph",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
origins = [o.strip() for o in os.getenv("ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
from routes.applications import router as applications_router
from routes.documents import router as documents_router
from routes.hitl import router as hitl_router
from routes.agent import router as agent_router
from routes.chat import router as chat_router
from routes.officers import router as officers_router
from routes.renewals import router as renewals_router
# BIAN service-domain routes — mounted at the root (no /api prefix) so URLs are
# exactly POST /ConsumerLoan/Initiate, GET /CustomerCreditRating/{id}/Retrieve, etc.
from routes.bian_consumer_loan import router as bian_consumer_loan_router
from routes.bian_customer_credit_rating import router as bian_customer_credit_rating_router

app.include_router(applications_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(hitl_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(officers_router, prefix="/api")
app.include_router(renewals_router, prefix="/api")
app.include_router(bian_consumer_loan_router)
app.include_router(bian_customer_credit_rating_router)


@app.get("/")
@app.get("/api")
async def health():
    try:
        db = get_db()
        await asyncio.to_thread(db.command, "ping")
        return {
            "status": "ok",
            "service": "lendflow-ai",
            "mongodb": "connected",
            "bianVersion": "v14",
            "bian": ["ConsumerLoan", "CustomerCreditRating"],
        }
    except Exception as e:
        logger.error("Health check failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "service": "lendflow-ai", "mongodb": "unavailable"}
        )


@app.get("/ready")
async def readiness():
    """Readiness probe — checks MongoDB + graph can be built."""
    try:
        db = get_db()
        await asyncio.to_thread(db.command, "ping")
        from agents.graph import get_graph
        get_graph()
        return {"status": "ready"}
    except Exception as e:
        logger.error("Readiness check failed: %s", e)
        return JSONResponse(status_code=503, content={"status": "not_ready"})
