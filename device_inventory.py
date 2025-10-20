#!/usr/bin/env python3
"""Interactive helper to compare incoming and installed device lists.

The tool reads two spreadsheets in the current directory:
    - incoming.xlsx  (OOXML .xlsx)
    - installed.xls  (HTML table exported with .xls extension)

It then offers menu options to inspect the raw data or list devices that
are still in stock (present in the incoming sheet but missing from the
installed sheet). The script also persists stock snapshots locally so it can
flag previously saved devices that later appear in a new installed export.
"""

from __future__ import annotations

import json
import sys
import zipfile
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple
from xml.etree import ElementTree as ET


NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
STATE_PATH = Path(".fleet_stock_state.json")
STOCK_COLUMNS = ["IMEI", "Device Type", "Sim No", "Status"]


def load_shared_strings(zf: zipfile.ZipFile) -> List[str]:
    """Return the shared string table for an .xlsx workbook."""
    try:
        raw = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []
    root = ET.fromstring(raw)
    strings: List[str] = []
    for si in root.findall("main:si", NS):
        text = "".join(node.text or "" for node in si.iterfind(".//main:t", NS))
        strings.append(text)
    return strings


def column_ref_to_index(cell_ref: str) -> int:
    """Convert an Excel column reference (e.g., 'B2') into a zero-based index."""
    column = "".join(ch for ch in cell_ref if ch.isalpha())
    index = 0
    for ch in column.upper():
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def read_cell(cell: ET.Element, shared_strings: Sequence[str]) -> str:
    """Extract the textual value from a <c> cell element."""
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.iterfind(".//main:t", NS))
    if cell_type == "s":
        raw_val = cell.find("main:v", NS)
        if raw_val is None or raw_val.text is None:
            return ""
        index = int(raw_val.text)
        return shared_strings[index] if 0 <= index < len(shared_strings) else ""
    raw_val = cell.find("main:v", NS)
    return raw_val.text if raw_val is not None and raw_val.text is not None else ""


def read_xlsx_table(path: str) -> List[Dict[str, str]]:
    """Parse the first worksheet of an .xlsx file into a list of dict rows."""
    with zipfile.ZipFile(path) as zf:
        shared = load_shared_strings(zf)
        sheet = ET.fromstring(zf.read("xl/worksheets/sheet1.xml"))

    rows: List[List[str]] = []
    for row in sheet.find("main:sheetData", NS).findall("main:row", NS):
        cells: Dict[int, str] = {}
        for cell in row.findall("main:c", NS):
            ref = cell.attrib.get("r")
            if not ref:
                continue
            cells[column_ref_to_index(ref)] = read_cell(cell, shared)
        if not cells:
            continue
        max_index = max(cells)
        row_values = [cells.get(idx, "") for idx in range(max_index + 1)]
        rows.append(row_values)

    if not rows:
        return []

    headers = rows[0]
    data: List[Dict[str, str]] = []
    for row_values in rows[1:]:
        if len(row_values) < len(headers):
            row_values = row_values + [""] * (len(headers) - len(row_values))
        data.append(dict(zip(headers, row_values)))
    return data


class HTMLTableParser(HTMLParser):
    """Very small HTML table parser tailored for the installed.xls export."""

    def __init__(self) -> None:
        super().__init__()
        self._in_cell = False
        self._buffer: List[str] = []
        self.rows: List[List[str]] = []
        self._current_row: List[str] | None = None

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in ("td", "th"):
            self._in_cell = True
            self._buffer = []
        elif tag == "tr":
            self._current_row = []

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in ("td", "th") and self._in_cell:
            text = "".join(self._buffer).strip()
            if self._current_row is not None:
                self._current_row.append(text)
            self._in_cell = False
        elif tag == "tr" and self._current_row:
            self.rows.append(self._current_row)
            self._current_row = None


def read_html_table(path: str) -> List[Dict[str, str]]:
    """Parse an HTML table stored with a .xls extension."""
    parser = HTMLTableParser()
    with open(path, encoding="utf-8", errors="ignore") as handle:
        parser.feed(handle.read())

    if not parser.rows:
        return []

    headers = parser.rows[0]
    data: List[Dict[str, str]] = []
    for row in parser.rows[1:]:
        if len(row) < len(headers):
            row = row + [""] * (len(headers) - len(row))
        data.append(dict(zip(headers, row)))
    return data


def format_table(rows: Sequence[Dict[str, str]], columns: Sequence[str], limit: int | None = None) -> str:
    """Return a simple ASCII table for a list of dict rows."""
    if not rows:
        return "No records found."

    selected = rows if limit is None else list(rows[:limit])
    col_widths = {
        column: max(len(column), *(len(str(row.get(column, ""))) for row in selected))
        for column in columns
    }
    header = " | ".join(column.ljust(col_widths[column]) for column in columns)
    divider = "-+-".join("-" * col_widths[column] for column in columns)
    lines = [header, divider]
    for row in selected:
        line = " | ".join(str(row.get(column, "")).ljust(col_widths[column]) for column in columns)
        lines.append(line)
    if limit is not None and len(rows) > limit:
        lines.append(f"... ({len(rows) - limit} more rows)")
    return "\n".join(lines)


def sanitize_value(value: Any) -> str:
    """Normalize cell values into stripped strings."""
    if value is None:
        return ""
    return str(value).strip()


def canonical_stock_row(row: Dict[str, Any]) -> Dict[str, str] | None:
    """Extract the core stock columns from an arbitrary row."""
    normalized: Dict[str, str] = {}
    for key, value in row.items():
        if not isinstance(key, str):
            continue
        key_normalized = key.strip().lower()
        if not key_normalized:
            continue
        normalized[key_normalized] = sanitize_value(value)

    imei = normalized.get("imei", "")
    if not imei:
        return None

    def pick(*candidates: str) -> str:
        for candidate in candidates:
            candidate_lower = candidate.strip().lower()
            value = normalized.get(candidate_lower, "")
            if value:
                return value
        return ""

    return {
        "IMEI": imei,
        "Device Type": pick("device type", "device", "model", "device model", "unit type", "type"),
        "Sim No": pick(
            "sim no",
            "sim",
            "sim number",
            "mobile no",
            "mobile number",
            "phone no",
            "phone",
        ),
        "Status": pick("status", "plan", "package", "subscription", "comment"),
    }


def load_state(path: Path = STATE_PATH) -> Dict[str, Any]:
    """Load persisted stock data if available."""
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return {}
    except OSError as exc:  # pragma: no cover - environment specific
        print(f"Warning: unable to read {path}: {exc}", file=sys.stderr)
        return {}

    try:
        state = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"Warning: ignoring corrupted state file {path}: {exc}", file=sys.stderr)
        return {}

    if not isinstance(state, dict):
        return {}
    return state


def save_state(state: Dict[str, Any], path: Path = STATE_PATH) -> None:
    """Persist stock data for future runs."""
    try:
        path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    except OSError as exc:  # pragma: no cover - environment specific
        print(f"Warning: unable to write {path}: {exc}", file=sys.stderr)


def reconcile_stock(
    incoming: Sequence[Dict[str, Any]],
    installed: Sequence[Dict[str, Any]],
    previous_stock: Sequence[Dict[str, Any]],
) -> Tuple[List[Dict[str, str]], List[Dict[str, str]], List[Dict[str, str]]]:
    """Combine historical stock with the latest files and report changes."""
    stock_by_imei: Dict[str, Dict[str, str]] = {}
    previous_stock_map: Dict[str, Dict[str, str]] = {}
    for row in previous_stock:
        canonical = canonical_stock_row(row) if row else None
        if canonical:
            stock_by_imei[canonical["IMEI"]] = canonical
            previous_stock_map[canonical["IMEI"]] = canonical

    previous_stock_imeis = set(previous_stock_map)

    added_from_incoming: List[Dict[str, str]] = []
    newly_added_imeis: set[str] = set()
    for row in incoming:
        canonical = canonical_stock_row(row)
        if not canonical:
            continue
        imei = canonical["IMEI"]
        if imei not in stock_by_imei:
            if imei not in newly_added_imeis:
                added_from_incoming.append(canonical)
                newly_added_imeis.add(imei)
        stock_by_imei[imei] = canonical

    consumed_from_stock: List[Dict[str, str]] = []
    installed_imeis: set[str] = set()
    for row in installed:
        canonical = canonical_stock_row(row)
        if not canonical:
            continue
        imei = canonical["IMEI"]
        installed_imeis.add(imei)
        if imei in stock_by_imei:
            if imei in previous_stock_imeis:
                consumed_from_stock.append(previous_stock_map.get(imei, stock_by_imei[imei]))
            stock_by_imei.pop(imei, None)

    if installed_imeis:
        added_from_incoming = [
            row for row in added_from_incoming if row["IMEI"] not in installed_imeis
        ]

    remaining_stock = sorted(stock_by_imei.values(), key=lambda item: item["IMEI"])
    return remaining_stock, consumed_from_stock, added_from_incoming


def menu_loop(incoming_path: str, installed_path: str) -> None:
    """Drive a simple text-based menu workflow."""
    try:
        incoming = read_xlsx_table(incoming_path)
    except FileNotFoundError:
        print(f"Cannot find {incoming_path!r}. Place the file in the current directory and retry.")
        return
    except Exception as exc:  # pragma: no cover - defensive for malformed files
        print(f"Failed to read {incoming_path!r}: {exc}")
        return

    try:
        installed = read_html_table(installed_path)
    except FileNotFoundError:
        print(f"Cannot find {installed_path!r}. Place the file in the current directory and retry.")
        return
    except Exception as exc:  # pragma: no cover - defensive for malformed files
        print(f"Failed to read {installed_path!r}: {exc}")
        return

    state = load_state()
    raw_previous_stock = state.get("pending_stock") if isinstance(state, dict) else []
    if not isinstance(raw_previous_stock, list):
        raw_previous_stock = []

    stock, consumed_stock, added_stock = reconcile_stock(incoming, installed, raw_previous_stock)

    state["pending_stock"] = stock
    state["last_run"] = {
        "incoming_path": incoming_path,
        "installed_path": installed_path,
        "timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "consumed": [row["IMEI"] for row in consumed_stock],
        "added": [row["IMEI"] for row in added_stock],
    }
    save_state(state)

    print()
    if consumed_stock:
        print(
            f"{len(consumed_stock)} device(s) from previous stock now appear in the installed sheet."
        )
    else:
        print("No devices from the previously saved stock were marked as installed.")
    if added_stock:
        print(f"{len(added_stock)} device(s) from the incoming sheet were added to stock.")
    print(f"Current stock count: {len(stock)} device(s).")

    while True:
        print("\nSelect an option:")
        print("  1. Show incoming device list")
        print("  2. Show installed device summary")
        print("  3. Show devices still in stock")
        print("  4. Show stock used since last run")
        print("  5. Quit")
        choice = input("Choice (1-5): ").strip()

        if choice == "1":
            print(f"\nIncoming devices: {len(incoming)} found.")
            print(format_table(incoming, STOCK_COLUMNS))
        elif choice == "2":
            print(f"\nInstalled devices: {len(installed)} found.")
            summary_columns = ["IMEI", "Vehicles", "Device", "Installation"]
            print(format_table(installed, summary_columns, limit=10))
        elif choice == "3":
            print(f"\nDevices still in stock: {len(stock)}")
            if added_stock:
                print(f"Added from latest incoming sheet: {len(added_stock)}")
            if consumed_stock:
                print(f"Consumed since last run: {len(consumed_stock)}")
            print(format_table(stock, STOCK_COLUMNS))
        elif choice == "4":
            if consumed_stock:
                print(f"\nPreviously saved stock now installed: {len(consumed_stock)}")
                print(format_table(consumed_stock, STOCK_COLUMNS, limit=20))
            else:
                print("\nNo devices from previous stock were installed since the last update.")
        elif choice == "5" or choice.lower() in {"q", "quit", "exit"}:
            print("Goodbye!")
            return
        else:
            print("Invalid choice. Enter a number between 1 and 5.")


def main(argv: Sequence[str]) -> int:
    if len(argv) > 3:
        print("Usage: python device_inventory.py [incoming.xlsx] [installed.xls]")
        return 1

    incoming_path = argv[1] if len(argv) > 1 else "incoming.xlsx"
    installed_path = argv[2] if len(argv) > 2 else "installed.xls"

    menu_loop(incoming_path, installed_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
