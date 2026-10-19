"""Development launcher for the Freely API.

Equivalent to running:
    uvicorn app.main:app --reload
from the backend/ directory.
"""

import uvicorn

from app.core.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
