#!/usr/bin/env python3
"""Interactive helper to compare incoming and installed device lists.

The tool reads two spreadsheets in the current directory:
    - incoming.xlsx  (OOXML .xlsx)
    - installed.xls  (HTML table exported with .xls extension)

It then offers menu options to inspect the raw data or list devices that
are still in stock (present in the incoming sheet but missing from the
installed sheet).
"""

from __future__ import annotations

import sys
import zipfile
from html.parser import HTMLParser
from typing import Dict, Iterable, List, Sequence
from xml.etree import ElementTree as ET


NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


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


def compute_stock(incoming: Sequence[Dict[str, str]], installed: Sequence[Dict[str, str]]) -> List[Dict[str, str]]:
    """Return incoming device rows whose IMEI does not appear in installed data."""
    installed_imeis = {row.get("IMEI") for row in installed if row.get("IMEI")}
    return [row for row in incoming if row.get("IMEI") and row["IMEI"] not in installed_imeis]


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

    stock = compute_stock(incoming, installed)
    columns = ["IMEI", "Device Type", "Sim No", "Status"]

    while True:
        print("\nSelect an option:")
        print("  1. Show incoming device list")
        print("  2. Show installed device summary")
        print("  3. Show devices still in stock")
        print("  4. Quit")
        choice = input("Choice (1-4): ").strip()

        if choice == "1":
            print(f"\nIncoming devices: {len(incoming)} found.")
            print(format_table(incoming, columns))
        elif choice == "2":
            print(f"\nInstalled devices: {len(installed)} found.")
            summary_columns = ["IMEI", "Vehicles", "Device", "Installation"]
            print(format_table(installed, summary_columns, limit=10))
        elif choice == "3":
            print(f"\nDevices still in stock: {len(stock)}")
            print(format_table(stock, columns))
        elif choice == "4" or choice.lower() in {"q", "quit", "exit"}:
            print("Goodbye!")
            return
        else:
            print("Invalid choice. Enter a number between 1 and 4.")


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

