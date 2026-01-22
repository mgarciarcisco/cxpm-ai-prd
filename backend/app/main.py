from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import projects_router, meetings_router, meeting_items_router

app = FastAPI(
    title="CXPM AI PRD",
    description="Meeting Notes to Requirements API",
    version="1.0.0",
)

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# Register routers
app.include_router(projects_router)
app.include_router(meetings_router)
app.include_router(meeting_items_router)
