"""Local file storage for profile and feed media."""

from pathlib import Path
from typing import Optional
from uuid import uuid4

from app.core.config import get_settings


class StorageService:
    """Store files under the configured root using relative storage keys."""

    def __init__(self) -> None:
        settings = get_settings()
        if settings.storage_provider != "local":
            raise RuntimeError("Only local file storage is configured")

        # Workspace root (e.g. Freely) where the 'uploads' folder lives
        self.workspace_root = Path(__file__).resolve().parents[3]
        if (self.workspace_root / "uploads").exists():
            self.root = self.workspace_root
        else:
            self.root = (Path(__file__).resolve().parents[2] / settings.storage_local_dir).resolve()

    def save(
        self,
        directory: str,
        extension: str,
        content: bytes,
        filename_prefix: str = "",
    ) -> str:
        """Save file under directory and return relative storage key with forward slashes."""
        normalized_dir = directory.replace("\\", "/").strip("/")
        if not extension.startswith("."):
            extension = f".{extension}"
        file_name = f"{filename_prefix}{uuid4().hex}{extension}"
        key = f"{normalized_dir}/{file_name}"
        path = self.path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return key

    def path_for(self, storage_key: str) -> Path:
        """Resolve a storage key to an absolute Path inside self.root."""
        normalized_key = storage_key.replace("\\", "/").lstrip("/")
        path = (self.root / normalized_key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError("Invalid storage key")
        return path

    def delete(self, storage_key: Optional[str]) -> None:
        """Safely delete the file at storage_key if it exists."""
        if not storage_key:
            return
        try:
            target = self.path_for(storage_key)
            if target.is_file():
                target.unlink(missing_ok=True)
        except (ValueError, OSError):
            # Ignore invalid keys or already-deleted files safely
            pass
