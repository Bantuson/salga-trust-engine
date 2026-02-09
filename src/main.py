"""SALGA Trust Engine - FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown events."""
    # Startup
    print(f"Starting SALGA Trust Engine - Environment: {settings.ENVIRONMENT}")
    yield
    # Shutdown
    print("Shutting down SALGA Trust Engine")


# Create FastAPI application
app = FastAPI(
    title="SALGA Trust Engine",
    version="0.1.0",
    description="AI-powered municipal service management platform for South Africa",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT
    }


# API routers will be added in subsequent plans
