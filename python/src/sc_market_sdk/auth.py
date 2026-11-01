"""SC Market public API tokens: ``scmp_live_...`` (Settings -> API tokens on sc-market.space)."""

from typing import Dict

TOKEN_PREFIX = "scmp_"


def is_api_token(token: object) -> bool:
    """True for a string shaped like a public API token. Doesn't check it with the server."""
    return (
        isinstance(token, str)
        and token.startswith(TOKEN_PREFIX)
        and len(token) > len(TOKEN_PREFIX)
        and not any(c.isspace() for c in token)
    )


def bearer(token: str) -> str:
    """The ``Authorization`` header value for a token, for your own HTTP client.

    Raises ValueError for anything that isn't an ``scmp_`` token (legacy ``scm_``
    tokens are refused by the public API).
    """
    if not is_api_token(token):
        hint = " Legacy scm_ tokens don't work with the public API." if isinstance(token, str) and token.startswith("scm_") else ""
        raise ValueError(
            "SC Market API tokens start with %s (create one under Settings -> API tokens on sc-market.space).%s" % (TOKEN_PREFIX, hint)
        )
    return "Bearer " + token


def auth_headers(token: str) -> Dict[str, str]:
    """``{"Authorization": "Bearer scmp_..."}``."""
    return {"Authorization": bearer(token)}
