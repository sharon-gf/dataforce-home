#!/usr/bin/env python3
"""Refresh the Dataforce Jet Fuel snapshot from IATA's public monitor."""

from __future__ import annotations

import json
import re
import ssl
import sys
from datetime import datetime
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


SOURCE_URL = "https://www.iata.org/en/publications/economics/fuel-monitor/"
SNAPSHOT_PATH = Path(__file__).resolve().parents[1] / "jet-fuel" / "fuel-snapshots.json"
NY_TZ = ZoneInfo("America/New_York")


def normalize_html_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def fetch_iata_page() -> str:
    context = None
    try:
        import certifi

        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()

    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": "Dataforce Jet Fuel Monitor/1.0 (+https://dataforce.gsaforce.com/jet-fuel/)"
        },
    )
    with urlopen(request, timeout=30, context=context) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_fuel_analysis(html: str) -> dict[str, object]:
    heading_match = re.search(
        r"Fuel Price Analysis</h3>\s*<p>(.*?)</p>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not heading_match:
        raise ValueError("Could not find the IATA Fuel Price Analysis paragraph.")

    source_text = normalize_html_text(heading_match.group(1))
    value_match = re.search(
        r"last week\s+(rose|fell)\s+([0-9]+(?:\.[0-9]+)?)%\s+compared to the week before to\s+\$([0-9]+(?:\.[0-9]+)?)/bbl",
        source_text,
        flags=re.IGNORECASE,
    )
    if not value_match:
        raise ValueError(f"Could not parse price and weekly change from: {source_text}")

    direction, change_text, price_text = value_match.groups()
    change = float(change_text)
    if direction.lower() == "fell":
        change *= -1

    return {
        "reported_period": "latest reported week",
        "global_average_usd_per_bbl": round(float(price_text), 2),
        "week_over_week_change_pct": round(change, 1),
        "source_text_reference": source_text,
    }


def update_snapshot_file(snapshot: dict[str, object]) -> bool:
    today = datetime.now(NY_TZ).date().isoformat()
    data = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    data["last_checked_at"] = today
    snapshots = data.setdefault("snapshots", [])
    if not isinstance(snapshots, list):
        raise ValueError("fuel-snapshots.json has an invalid snapshots value.")

    snapshot = {"capture_date": today, **snapshot}
    latest = snapshots[-1] if snapshots else None
    comparable_keys = (
        "global_average_usd_per_bbl",
        "week_over_week_change_pct",
        "source_text_reference",
    )
    if latest and all(latest.get(key) == snapshot.get(key) for key in comparable_keys):
        latest["capture_date"] = today
    else:
        snapshots.append(snapshot)

    before = SNAPSHOT_PATH.read_text(encoding="utf-8")
    after = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if before == after:
        return False
    SNAPSHOT_PATH.write_text(after, encoding="utf-8")
    return True


def main() -> int:
    html = fetch_iata_page()
    snapshot = parse_fuel_analysis(html)
    changed = update_snapshot_file(snapshot)
    status = "updated" if changed else "already current"
    print(f"Jet fuel snapshot {status}: {snapshot['source_text_reference']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Jet fuel update failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
