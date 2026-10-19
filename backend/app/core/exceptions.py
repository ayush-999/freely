"""Domain exceptions mapped to HTTP responses."""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base application error carrying an HTTP status code."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, detail: str = "Internal server error") -> None:
        super().__init__(detail)
        self.detail = detail


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND

    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(detail)


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT

    def __init__(self, detail: str = "Resource conflict") -> None:
        super().__init__(detail)


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN

    def __init__(self, detail: str = "Permission denied") -> None:
        super().__init__(detail)


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED

    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(detail)


class UnprocessableError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT

    def __init__(self, detail: str = "Unprocessable request") -> None:
        super().__init__(detail)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
