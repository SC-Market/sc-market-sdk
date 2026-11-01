from typing import Any

from ._operations import GeneratedScMarketClient
from .auth import bearer

DEFAULT_BASE_URL = "https://api.sc-market.space/api/public/v1"


class ScMarketClient(GeneratedScMarketClient):
    """The SC Market public API (shops, listings, stock, orders, offers).

    >>> sc = ScMarketClient(os.environ["SC_MARKET_TOKEN"])
    >>> me = sc.get_me()
    >>> for order in sc.iter_orders(role="seller", status="not-started"): ...

    Keyword options: ``base_url``, ``max_retries`` (default 3), ``max_retry_delay``
    (seconds, default 60), ``timeout`` (seconds, default 30), ``headers``,
    ``transport``, ``on_retry``.
    """

    _user_agent_name = "sc-market-sdk"

    def __init__(self, token: str, *, base_url: str = DEFAULT_BASE_URL, **options: Any):
        bearer(token)  # validates the prefix, raises a helpful ValueError
        super().__init__(base_url=base_url, token=token, **options)
