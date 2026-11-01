"""Print your shops' orders that haven't been started yet.

    SC_MARKET_TOKEN=scmp_live_... python3 examples/new_orders.py

Token scope: orders:read.
"""

import os

from sc_market_sdk import ScMarketClient

sc = ScMarketClient(os.environ["SC_MARKET_TOKEN"])
for order in sc.iter_orders(role="seller", status="not-started", sort_by="created_at", sort_order="asc"):
    print("%s  %s  %s  %s aUEC  https://sc-market.space/order/%s" % (
        order["created_at"], order["buyer_username"], order["title"], "{:,.0f}".format(order["total_price"]), order["order_id"]))
