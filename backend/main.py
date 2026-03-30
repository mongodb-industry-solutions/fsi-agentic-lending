"""LendFlow AI — FastAPI Backend."""
import asyncio
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from db.mdb import get_db

app = FastAPI(
    title="LendFlow AI",
    description="Agentic lending platform API powered by MongoDB Atlas and LangGraph",
    version="0.1.0",
)

# CORS
origins = os.getenv("ORIGINS", "http://localhost:3000").split(",")
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

app.include_router(applications_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(hitl_router, prefix="/api")
app.include_router(agent_router, prefix="/api")


@app.get("/")
async def health():
    try:
        db = get_db()
        await asyncio.to_thread(db.command, "ping")
        return {"status": "ok", "service": "lendflow-ai", "mongodb": "connected"}
    except Exception as e:
        return {"status": "degraded", "service": "lendflow-ai", "mongodb": f"error: {str(e)}"}
