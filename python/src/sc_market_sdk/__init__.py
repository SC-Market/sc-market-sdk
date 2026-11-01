"""Typed client for the SC Market public API and public price feed.

https://sc-market.space/developers
"""

from ._http import ApiError, RateLimitError, parse_retry_after
from ._types import *  # noqa: F401,F403  (the generated response types)
from ._version import __version__
from .auth import TOKEN_PREFIX, auth_headers, bearer, is_api_token
from .client import DEFAULT_BASE_URL, ScMarketClient
from .prices import PRICES_ATTRIBUTION, PRICES_BASE_URL, PriceIndex, PriceIndexItem, PricesFeed

__all__ = [
    "ApiError",
    "RateLimitError",
    "parse_retry_after",
    "ScMarketClient",
    "DEFAULT_BASE_URL",
    "PricesFeed",
    "PriceIndex",
    "PriceIndexItem",
    "PRICES_BASE_URL",
    "PRICES_ATTRIBUTION",
    "TOKEN_PREFIX",
    "bearer",
    "auth_headers",
    "is_api_token",
    "__version__",
]
