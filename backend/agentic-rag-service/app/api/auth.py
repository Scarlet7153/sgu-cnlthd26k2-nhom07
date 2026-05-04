"""Authentication dependency for agentic-rag-service."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


def require_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract and validate Bearer token. Returns account_id derived from token.

    For development, accepts any non-empty Bearer token.
    In production, this should verify the JWT signature against the auth service's secret.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # In development, return a placeholder account_id.
    # In production, decode the JWT and extract the user's ID from the payload.
    #   payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    #   return payload.get("sub") or payload.get("user_id")

    logger.info(f"Authenticated request with token={token[:20]}...")
    return "authenticated"
