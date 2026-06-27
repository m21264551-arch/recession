"""Explicit, credential-free snapshot acquisition; never runs while serving the site."""

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=GS10,TB3MS,USREC"
SOURCES = [
    {
        "series": "GS10",
        "url": "https://fred.stlouisfed.org/series/GS10",
        "unit": "percent",
        "frequency": "monthly",
        "basis": "10-year constant-maturity Treasury, investment basis",
    },
    {
        "series": "TB3MS",
        "url": "https://fred.stlouisfed.org/series/TB3MS",
        "unit": "percent",
        "frequency": "monthly",
        "basis": "3-month Treasury bill secondary-market rate, discount basis",
    },
    {
        "series": "USREC",
        "url": "https://fred.stlouisfed.org/series/USREC",
        "unit": "0/1",
        "frequency": "monthly",
        "basis": "NBER recession indicator, peak-to-trough convention via FRED",
    },
]


def record_snapshot(path):
    raw = Path(path).read_bytes()
    if raw.splitlines()[0] != b"observation_date,GS10,TB3MS,USREC":
        raise ValueError("Unexpected FRED CSV header; refusing to publish")
    manifest = {
        "schemaVersion": 1,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "downloadUrl": URL,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "sources": SOURCES,
        "vintage": "Downloaded data vintage, not a real-time vintage reconstruction",
    }
    Path(path).with_suffix(".manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    return manifest


def acquire():
    path = ROOT / "data/raw/fred-monthly.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(
        Request(URL, headers={"User-Agent": "YieldCurveResearch/1.0"}), timeout=90
    ) as response:
        raw = response.read()
    if not raw.startswith(b"observation_date,GS10,TB3MS,USREC"):
        raise ValueError(
            "FRED did not return the requested CSV. Existing snapshot preserved."
        )
    path.write_bytes(raw)
    return record_snapshot(path)


if __name__ == "__main__":
    print(json.dumps(acquire(), indent=2))
