"""Look up player-market prices from the public price feed. No token needed.

    python3 examples/price_check.py canuto

Credit "Data: SC Market (sc-market.space)" when you publish the numbers.
"""

import sys

from sc_market_sdk import PRICES_ATTRIBUTION, PricesFeed

query = " ".join(sys.argv[1:]).strip().lower()
if not query:
    sys.exit("Usage: python3 examples/price_check.py <item name>")

index = PricesFeed().index()
matches = [i for i in index["items"] if query in i["name"].lower()][:10]
if not matches:
    sys.exit('No priced item matches "%s".' % query)


def auec(n):
    return "-" if n is None else "{:,.0f} aUEC".format(n)


for m in matches:
    print("%s: lowest ask %s, median %s, %d seller(s), confidence %s" % (m["name"], auec(m["lowest_ask"]), auec(m["median_ask"]), m["seller_count"], m["confidence"]))
    print("  " + m["page"])
print("\n%s. Snapshot %s." % (PRICES_ATTRIBUTION, index["date"]))
