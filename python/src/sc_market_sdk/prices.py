"""The public player-market price feed: no token, free to use, attribution requested.

Item documents are typed from the site API spec (``_prices_types``, generated). The
index has no published schema, so its types are written by hand here, from the
documented envelope; keep them in step with the live feed.
"""

from typing import Any, Dict, List, Optional
from urllib.parse import quote

from ._http import BaseClient
from ._prices_types import PriceOracleItem, PriceOracleMethodology, PublicFeedInfo

try:
    from typing import Literal, TypedDict
except ImportError:  # pragma: no cover
    from typing_extensions import Literal, TypedDict  # type: ignore

PRICES_BASE_URL = "https://api.sc-market.space/api/public/prices"
#: The attribution line to show when you publish the data.
PRICES_ATTRIBUTION = "Data: SC Market (sc-market.space)"

PriceConfidence = Literal["none", "low", "medium", "high"]


class PriceIndexItem(TypedDict):
    """One row of the index. All prices in aUEC per unit."""

    slug: str
    name: str
    type: Optional[str]
    page: str
    json: str
    ask_count: int
    seller_count: int
    confidence: PriceConfidence
    lowest_ask: Optional[float]
    median_ask: Optional[float]
    median_30d: Optional[float]
    change_pct_30d: Optional[float]


class PriceIndex(TypedDict):
    """GET /api/public/prices/index.json"""

    feed: PublicFeedInfo
    date: Optional[str]
    as_of: Optional[str]
    currency: Literal["aUEC"]
    unit_note: str
    count: int
    coverage: Dict[str, int]
    items: List[PriceIndexItem]
    methodology: PriceOracleMethodology
    attribution: str


class PricesFeed(BaseClient):
    """The price feed. Never sends a token. 60 requests a minute per IP; the numbers
    change once a day, so cache them."""

    _user_agent_name = "sc-market-sdk"

    def __init__(self, *, base_url: str = PRICES_BASE_URL, **options: Any):
        options.pop("token", None)
        super().__init__(base_url=base_url, token=None, **options)

    def index(self) -> PriceIndex:
        """Every priced item of the latest daily snapshot."""
        return self._send("GET", "/index.json")

    def index_csv(self) -> str:
        return self._send("GET", "/index.csv", accept="text/csv")

    def index_markdown(self) -> str:
        return self._send("GET", "/index.md", accept="text/markdown")

    def item(self, item_id: str) -> PriceOracleItem:
        """One game item's document. ``item_id`` is the short slug, its 8-hex prefix or
        the item UUID. Unknown items raise ApiError with code NOT_FOUND."""
        return self._send("GET", "/%s.json" % quote(item_id.lower(), safe=""))
