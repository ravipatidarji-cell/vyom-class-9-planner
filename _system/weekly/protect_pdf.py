import os
import secrets
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def protect(path, password):
    reader = PdfReader(path)
    if reader.is_encrypted and not reader.decrypt(password):
        raise ValueError(f"Cannot unlock existing key: {path.name}")
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(password, owner_password=secrets.token_urlsafe(32), algorithm="AES-256")
    staged = path.with_suffix(".encrypted.new")
    try:
        with staged.open("wb") as output:
            writer.write(output)
        locked = PdfReader(staged)
        if not locked.is_encrypted or locked.decrypt("incorrect-password"):
            raise ValueError("PDF password protection verification failed")
        if not locked.decrypt(password) or len(locked.pages) != len(reader.pages):
            raise ValueError("PDF password or page verification failed")
        os.replace(staged, path)
    finally:
        staged.unlink(missing_ok=True)


if __name__ == "__main__":
    password = sys.stdin.read()
    if not password:
        raise ValueError("Parent PDF password is required")
    for filename in sys.argv[1:]:
        protect(Path(filename), password)
