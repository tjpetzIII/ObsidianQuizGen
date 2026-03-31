import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError, jwk
from pydantic import BaseModel
from app.config import settings

security = HTTPBearer()

# Cache for JWKS keys
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


def _get_signing_key(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    jwks = _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise ValueError(f"No matching key found for kid={kid}")


class CurrentUser(BaseModel):
    user_id: str
    email: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> CurrentUser:
    token = credentials.credentials
    try:
        key = _get_signing_key(token)
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "RS256")

        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub")
        email: str = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return CurrentUser(user_id=user_id, email=email)
    except (JWTError, ValueError) as e:
        print(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
