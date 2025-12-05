#!/usr/bin/env python3
"""
Anonymize financial import files for testing.

Uses scrubadub for PII detection with custom detectors for bank-specific patterns.
Uses Faker with seeding for consistent fake data generation.

Default workflow:
    cd data && python anonymize.py
    # Processes raw/*.csv -> anonymized/
    # Tracks processed files in anonymized/manifest.json

Usage:
    python data/anonymize.py                  # Process all new files in raw/
    python data/anonymize.py --force          # Reprocess all files
    python data/anonymize.py --status         # Show what's processed/pending
    python data/anonymize.py input.csv out.csv  # Single file mode
"""

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

import scrubadub
from scrubadub.detectors import Detector
from scrubadub.filth import Filth, RegexFilth
from faker import Faker


# Default paths relative to this file (data/ directory)
DATA_DIR = Path(__file__).parent
RAW_DIR = DATA_DIR / "raw"
ANON_DIR = DATA_DIR / "anonymized"
MANIFEST_FILE = ANON_DIR / "manifest.json"


# =============================================================================
# Custom Filth Types
# =============================================================================

class MerchantFilth(Filth):
    type = 'merchant'


class BankIdFilth(Filth):
    type = 'bank_id'


class AccountNumberFilth(Filth):
    type = 'account_number'


class PersonNameFilth(Filth):
    type = 'person_name'


# =============================================================================
# Custom Detectors for Bank Statement Patterns
# =============================================================================

class PhoneFilth(Filth):
    type = 'phone'


class PhoneDetector(Detector):
    """Detects phone numbers in various formats"""
    name = 'phone_number'
    filth_cls = PhoneFilth

    def iter_filth(self, text, document_name=None):
        # +1XXXXXXXXXX format
        for match in re.finditer(r'\+1\d{10}', text):
            yield PhoneFilth(
                beg=match.start(),
                end=match.end(),
                text=match.group(),
                detector_name=self.name,
                document_name=document_name,
            )

        # XXX-XXX-XXXX format (may be adjacent to text)
        for match in re.finditer(r'\d{3}-\d{3}-\d{4}', text):
            yield PhoneFilth(
                beg=match.start(),
                end=match.end(),
                text=match.group(),
                detector_name=self.name,
                document_name=document_name,
            )

        # (XXX) XXX-XXXX format
        for match in re.finditer(r'\(\d{3}\)\s*\d{3}-\d{4}', text):
            yield PhoneFilth(
                beg=match.start(),
                end=match.end(),
                text=match.group(),
                detector_name=self.name,
                document_name=document_name,
            )


class BankIdDetector(Detector):
    """Detects bank ID patterns like XXXXX12345, ID:12345678"""
    name = 'bank_id'
    filth_cls = BankIdFilth

    def iter_filth(self, text, document_name=None):
        # XXXXX followed by digits (masked account numbers)
        for match in re.finditer(r'XXXXX\d+', text):
            yield BankIdFilth(
                beg=match.start(),
                end=match.end(),
                text=match.group(),
                detector_name=self.name,
                document_name=document_name,
            )

        # Standalone long numbers (5+ digits, not dates or amounts)
        for match in re.finditer(r'(?<![/\d,\.])\b\d{5,}\b(?![/\d])', text):
            num = match.group()
            # Skip years (2020-2030)
            if len(num) == 4 and num.startswith('20'):
                continue
            yield BankIdFilth(
                beg=match.start(),
                end=match.end(),
                text=num,
                detector_name=self.name,
                document_name=document_name,
            )


class IndnNameDetector(Detector):
    """Detects names in INDN: patterns (BOFA format)"""
    name = 'indn_name'
    filth_cls = PersonNameFilth

    def iter_filth(self, text, document_name=None):
        # INDN:NAME CO ID: pattern - allow &, -, and other common name chars
        pattern = r'INDN:([A-Za-z][A-Za-z0-9,\.\s\*\'\-&]+?)(?:\s+CO\s+ID:|$)'
        for match in re.finditer(pattern, text):
            name = match.group(1).strip()
            if len(name) > 2:  # Skip very short matches
                yield PersonNameFilth(
                    beg=match.start(1),
                    end=match.end(1),
                    text=name,
                    detector_name=self.name,
                    document_name=document_name,
                )


class LocationFilth(Filth):
    type = 'location'


class LocationDetector(Detector):
    """Detects location names (City STATE) at end of descriptions"""
    name = 'location'
    filth_cls = LocationFilth

    # Common words that appear before locations but aren't locations
    SKIP_WORDS = {'PURCHASE', 'WITHDRWL', 'DEPOSIT', 'TRANSFER', 'PAYMENT', 'FEE', 'INTERNATIONAL',
                  'TRANSACTION', 'THE', 'AND', 'FOR', 'THANK', 'YOU', 'BANCO', 'NACIONAL', 'SUPER',
                  'LAFISE', 'WITHDRWL', 'ATM'}

    # Known California cities to catch (extend as needed)
    KNOWN_LOCATIONS = {'ENCINITAS', 'CARLSBAD', 'PUNTARENAS', 'ALAJUELA', 'SAN DIEGO', 'LA JOLLA',
                       'DEL MAR', 'SOLANA BEACH', 'CARDIFF', 'RANCHO SANTA FE', 'OCEANSIDE',
                       'VISTA', 'ESCONDIDO', 'SAN MARCOS', 'LEUCADIA'}

    def iter_filth(self, text, document_name=None):
        text_upper = text.upper()

        # First, catch known location names directly
        for loc in self.KNOWN_LOCATIONS:
            # Find all occurrences
            start = 0
            while True:
                idx = text_upper.find(loc, start)
                if idx == -1:
                    break
                yield LocationFilth(
                    beg=idx,
                    end=idx + len(loc),
                    text=text[idx:idx + len(loc)],
                    detector_name=self.name,
                    document_name=document_name,
                )
                start = idx + len(loc)

        # Match "City ST" or "City, ST" patterns (state abbrev at end)
        # Also match "City City ST" patterns (like "ENCINITAS ENCINITAS CA")
        pattern = r'([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+([A-Z]{2})(?:\s|$|,)'
        for match in re.finditer(pattern, text):
            city = match.group(1)
            state = match.group(2)
            # Skip if city part is all uppercase common words
            city_words = city.split()
            if all(w.upper() in self.SKIP_WORDS for w in city_words):
                continue
            # Skip very short cities (likely not real)
            if len(city) < 3:
                continue
            # Skip if already matched by known locations
            if city.upper() in self.KNOWN_LOCATIONS:
                continue
            yield LocationFilth(
                beg=match.start(1),
                end=match.end(1),
                text=city,
                detector_name=self.name,
                document_name=document_name,
            )


class MerchantDetector(Detector):
    """Detects merchant names at start of BOFA descriptions"""
    name = 'merchant'
    filth_cls = MerchantFilth

    def iter_filth(self, text, document_name=None):
        # Merchant before DES: pattern
        des_match = re.match(r'^([A-Z][A-Z0-9\s\.&\'-]+?)\s+DES:', text)
        if des_match:
            merchant = des_match.group(1).strip()
            if len(merchant) > 2:
                yield MerchantFilth(
                    beg=des_match.start(1),
                    end=des_match.end(1),
                    text=merchant,
                    detector_name=self.name,
                    document_name=document_name,
                )
            return

        # Merchant at start (first 1-3 words before location/ID patterns)
        parts = text.split()
        if not parts:
            return

        merchant_end = len(parts)
        for i, part in enumerate(parts):
            # Stop at things that look like locations, IDs, dates
            if re.match(r'^[A-Z]{2}$', part) and i > 0:  # State abbreviation
                merchant_end = i
                break
            if re.match(r'^\d{5}(-\d{4})?$', part):  # ZIP code
                merchant_end = i
                break
            if re.match(r'^#?\d+$', part) and i > 0:  # ID number
                merchant_end = i
                break
            if any(marker in part for marker in ['DES:', 'ID:', 'INDN:', 'DEPOSIT']):
                merchant_end = i
                break

        merchant_end = min(merchant_end, 4)  # Cap at 4 words

        if merchant_end > 0:
            merchant = ' '.join(parts[:merchant_end])
            if len(merchant) > 2:
                # Calculate actual position in text
                end_pos = len(merchant)
                yield MerchantFilth(
                    beg=0,
                    end=end_pos,
                    text=merchant,
                    detector_name=self.name,
                    document_name=document_name,
                )


# =============================================================================
# Consistent Replacement Generator
# =============================================================================

class ConsistentReplacer:
    """
    Generates consistent fake replacements using seeded Faker.
    Same input always produces same output within a session.
    """

    def __init__(self, seed: str = "anonymize"):
        self.seed = seed
        self.faker = Faker()
        Faker.seed(hash(seed) % (2**32))

        # Caches for consistent replacement
        self.merchant_map: dict[str, str] = {}
        self.person_map: dict[str, str] = {}
        self.id_map: dict[str, str] = {}
        self.location_map: dict[str, str] = {}

        self._id_counter = 0

    def get_merchant(self, original: str) -> str:
        key = original.upper().strip()
        if key not in self.merchant_map:
            self.merchant_map[key] = self.faker.company().upper()
        return self.merchant_map[key]

    def get_person(self, original: str) -> str:
        key = original.upper().strip()
        if key not in self.person_map:
            self.person_map[key] = self.faker.name().upper()
        return self.person_map[key]

    def get_id(self, original: str) -> str:
        key = original.strip()
        if key not in self.id_map:
            self._id_counter += 1
            # Preserve format (XXXXX prefix if present)
            if original.startswith('XXXXX'):
                self.id_map[key] = f"XXXXX{self._id_counter:08d}"
            else:
                self.id_map[key] = f"{self._id_counter:08d}"
        return self.id_map[key]

    def get_location(self, original: str) -> str:
        key = original.upper().strip()
        if key not in self.location_map:
            # Generate a fake city name, preserving word count if multiple words
            words = key.split()
            if len(words) > 1:
                fake_city = ' '.join(self.faker.city().upper().split()[0] for _ in words)
            else:
                fake_city = self.faker.city().upper()
            self.location_map[key] = fake_city
        return self.location_map[key]

    def get_stats(self) -> dict:
        return {
            "merchants": len(self.merchant_map),
            "persons": len(self.person_map),
            "ids": len(self.id_map),
            "locations": len(self.location_map),
        }


# =============================================================================
# Custom Scrubber
# =============================================================================

def create_scrubber(replacer: ConsistentReplacer) -> scrubadub.Scrubber:
    """Create a scrubber with custom detectors and consistent replacements."""

    class ConsistentPostProcessor(scrubadub.post_processors.PostProcessor):
        name = 'consistent_replacer'

        def process_filth(self, filth_list):
            for filth in filth_list:
                if isinstance(filth, MerchantFilth):
                    filth.replacement_string = replacer.get_merchant(filth.text)
                elif isinstance(filth, PersonNameFilth):
                    filth.replacement_string = replacer.get_person(filth.text)
                elif isinstance(filth, BankIdFilth):
                    filth.replacement_string = replacer.get_id(filth.text)
                elif isinstance(filth, AccountNumberFilth):
                    filth.replacement_string = replacer.get_id(filth.text)
                elif isinstance(filth, PhoneFilth):
                    filth.replacement_string = replacer.faker.phone_number()
                elif isinstance(filth, LocationFilth):
                    filth.replacement_string = replacer.get_location(filth.text)
                # Let other filth types use default replacement
            return filth_list

    scrubber = scrubadub.Scrubber(post_processor_list=[
        ConsistentPostProcessor(),
    ])

    # Remove default detectors we don't need (keep email, phone, ssn, credit_card)
    detectors_to_remove = [
        'address', 'date_of_birth', 'drivers_licence', 'national_insurance_number',
        'passport', 'tax_reference_number', 'twitter', 'url', 'vehicle_licence_plate'
    ]
    for det in detectors_to_remove:
        try:
            scrubber.remove_detector(det)
        except KeyError:
            pass  # Detector not present in this version

    # Add our custom detectors
    scrubber.add_detector(PhoneDetector())
    scrubber.add_detector(BankIdDetector())
    scrubber.add_detector(IndnNameDetector())
    scrubber.add_detector(MerchantDetector())
    scrubber.add_detector(LocationDetector())

    return scrubber


# =============================================================================
# File Processing
# =============================================================================

def file_hash(filepath: Path) -> str:
    """Calculate SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def load_manifest(manifest_path: Path) -> dict:
    """Load the processing manifest."""
    if manifest_path.exists():
        with open(manifest_path) as f:
            return json.load(f)
    return {"files": {}, "tokenizer_seed": "anonymize", "last_run": None}


def save_manifest(manifest_path: Path, manifest: dict):
    """Save the processing manifest."""
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)


def find_header_row(content: list[list[str]]) -> int:
    """Find the actual header row, skipping summary sections."""
    for i, row in enumerate(content[:20]):
        row_str = ','.join(h.lower() for h in row)
        if 'date' in row_str and ('description' in row_str or 'amount' in row_str):
            return i
        if 'running bal' in row_str:
            return i
        if 'card member' in row_str:
            return i
        if 'posted date' in row_str and 'payee' in row_str:
            return i
    return 0


def detect_format(content: list[list[str]]) -> tuple[str, int]:
    """Detect CSV format. Returns (format, header_row_index)."""
    if not content:
        return "unknown", 0

    header_idx = find_header_row(content)
    headers = [h.lower() for h in content[header_idx]]
    header_str = ','.join(headers)

    if 'running bal' in header_str:
        return "bofa", header_idx
    if 'card member' in header_str or 'account #' in header_str:
        return "amex", header_idx
    if 'posted date' in header_str and 'payee' in header_str:
        return "bofa_cc", header_idx

    return "unknown", header_idx


def anonymize_file(input_path: Path, output_path: Path, scrubber: scrubadub.Scrubber, replacer: ConsistentReplacer) -> dict:
    """Anonymize a single file."""

    with open(input_path, 'r', newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        return {"status": "empty", "rows": 0}

    fmt, header_idx = detect_format(rows)

    # Find columns to anonymize
    headers = [h.lower().strip() for h in rows[header_idx]] if header_idx < len(rows) else []

    # Column indices
    col_indices = {
        'desc': None,
        'member': None,
        'account': None,
        'ref': None,
        'extended': None,
        'statement_as': None,
        'address': None,
        'city_state': None,
        'zip': None,
        'payee': None,
    }

    for i, h in enumerate(headers):
        if 'description' in h:
            col_indices['desc'] = i
        elif 'card member' in h:
            col_indices['member'] = i
        elif 'account' in h and '#' in h:
            col_indices['account'] = i
        elif h == 'reference' or 'reference number' in h:
            col_indices['ref'] = i
        elif 'extended' in h:
            col_indices['extended'] = i
        elif 'appears on' in h or 'statement as' in h:
            col_indices['statement_as'] = i
        elif h == 'address':
            col_indices['address'] = i
        elif 'city' in h or 'state' in h:
            col_indices['city_state'] = i
        elif 'zip' in h:
            col_indices['zip'] = i
        elif h == 'payee':
            col_indices['payee'] = i

    # Default for BOFA: description is column 1
    if col_indices['desc'] is None and fmt == "bofa" and len(headers) > 1:
        col_indices['desc'] = 1

    result = []

    # Copy rows before header (summary section)
    for row in rows[:header_idx]:
        result.append(row)

    # Copy header
    if header_idx < len(rows):
        result.append(rows[header_idx])

    # Process data rows
    for row in rows[header_idx + 1:]:
        new_row = row.copy()

        # Scrub description column
        if col_indices['desc'] is not None and col_indices['desc'] < len(new_row) and new_row[col_indices['desc']]:
            new_row[col_indices['desc']] = scrubber.clean(new_row[col_indices['desc']])

        # Scrub card member column (AMEX)
        if col_indices['member'] is not None and col_indices['member'] < len(new_row) and new_row[col_indices['member']]:
            new_row[col_indices['member']] = replacer.get_person(new_row[col_indices['member']])

        # Scrub account number column (AMEX)
        if col_indices['account'] is not None and col_indices['account'] < len(new_row) and new_row[col_indices['account']]:
            new_row[col_indices['account']] = replacer.get_id(new_row[col_indices['account']])

        # Scrub reference column (AMEX)
        if col_indices['ref'] is not None and col_indices['ref'] < len(new_row) and new_row[col_indices['ref']]:
            new_row[col_indices['ref']] = replacer.get_id(new_row[col_indices['ref']])

        # Scrub extended details (AMEX) - contains phone numbers, addresses
        if col_indices['extended'] is not None and col_indices['extended'] < len(new_row) and new_row[col_indices['extended']]:
            new_row[col_indices['extended']] = scrubber.clean(new_row[col_indices['extended']])

        # Scrub "Appears on statement as" (AMEX)
        if col_indices['statement_as'] is not None and col_indices['statement_as'] < len(new_row) and new_row[col_indices['statement_as']]:
            new_row[col_indices['statement_as']] = scrubber.clean(new_row[col_indices['statement_as']])

        # Scrub address (AMEX)
        if col_indices['address'] is not None and col_indices['address'] < len(new_row) and new_row[col_indices['address']]:
            new_row[col_indices['address']] = replacer.get_merchant(new_row[col_indices['address']])  # Replace with fake address

        # Scrub city/state (AMEX)
        if col_indices['city_state'] is not None and col_indices['city_state'] < len(new_row) and new_row[col_indices['city_state']]:
            new_row[col_indices['city_state']] = replacer.faker.city() + ", " + replacer.faker.state_abbr()

        # Scrub zip code (AMEX)
        if col_indices['zip'] is not None and col_indices['zip'] < len(new_row) and new_row[col_indices['zip']]:
            new_row[col_indices['zip']] = replacer.faker.zipcode()

        # Scrub payee column (BOFA CC) - replace entire value since it's just merchant name
        if col_indices['payee'] is not None and col_indices['payee'] < len(new_row) and new_row[col_indices['payee']]:
            new_row[col_indices['payee']] = replacer.get_merchant(new_row[col_indices['payee']])

        result.append(new_row)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerows(result)

    data_rows = len(rows) - header_idx - 1 if header_idx < len(rows) else 0

    return {
        "status": "ok",
        "format": fmt,
        "rows": data_rows,
        "header_row": header_idx,
    }


def process_directory(raw_dir: Path, anon_dir: Path, manifest_path: Path,
                      force: bool = False, verbose: bool = False) -> dict:
    """Process all files in raw_dir, output to anon_dir."""

    manifest = load_manifest(manifest_path)
    seed = manifest.get("tokenizer_seed", "anonymize")

    # Create scrubber and replacer (shared across files for consistency)
    replacer = ConsistentReplacer(seed=seed)
    scrubber = create_scrubber(replacer)

    input_files = list(raw_dir.glob("*.csv")) + list(raw_dir.glob("*.CSV"))

    if not input_files:
        return {"processed": 0, "skipped": 0, "errors": 0, "message": "No CSV files found in data/raw/"}

    processed = 0
    skipped = 0
    errors = 0

    for input_path in sorted(input_files):
        input_hash = file_hash(input_path)
        output_name = f"{input_path.stem}_anon{input_path.suffix}"
        output_path = anon_dir / output_name

        file_record = manifest["files"].get(input_path.name, {})
        if not force and file_record.get("input_hash") == input_hash:
            if verbose:
                print(f"  Skipped (unchanged): {input_path.name}")
            skipped += 1
            continue

        try:
            result = anonymize_file(input_path, output_path, scrubber, replacer)

            manifest["files"][input_path.name] = {
                "input_hash": input_hash,
                "output_file": output_name,
                "output_hash": file_hash(output_path),
                "format": result.get("format", "unknown"),
                "rows": result.get("rows", 0),
                "processed_at": datetime.now().isoformat(),
            }

            processed += 1
            if verbose:
                print(f"  Processed: {input_path.name} -> {output_name} ({result.get('rows', 0)} rows, {result.get('format', 'unknown')})")
            else:
                print(f"  {input_path.name} -> {output_name}")

        except Exception as e:
            errors += 1
            print(f"  Error processing {input_path.name}: {e}", file=sys.stderr)
            if verbose:
                import traceback
                traceback.print_exc()

    manifest["last_run"] = datetime.now().isoformat()
    manifest["stats"] = replacer.get_stats()
    save_manifest(manifest_path, manifest)

    return {
        "processed": processed,
        "skipped": skipped,
        "errors": errors,
        "total_files": len(input_files),
    }


def show_status(raw_dir: Path, anon_dir: Path, manifest_path: Path):
    """Show status of what's processed vs pending."""

    manifest = load_manifest(manifest_path)
    input_files = list(raw_dir.glob("*.csv")) + list(raw_dir.glob("*.CSV"))

    print(f"Raw data directory: {raw_dir}")
    print(f"Anonymized output:  {anon_dir}")
    print(f"Manifest:           {manifest_path}")
    print()

    if not input_files:
        print("No CSV files found in data/raw/")
        print("Place your real financial CSVs there to anonymize them.")
        return

    pending = []
    up_to_date = []
    changed = []

    for input_path in sorted(input_files):
        input_hash = file_hash(input_path)
        file_record = manifest["files"].get(input_path.name, {})

        if not file_record:
            pending.append(input_path.name)
        elif file_record.get("input_hash") != input_hash:
            changed.append(input_path.name)
        else:
            up_to_date.append((input_path.name, file_record))

    if pending:
        print(f"Pending ({len(pending)}):")
        for name in pending:
            print(f"  + {name}")
        print()

    if changed:
        print(f"Changed (will reprocess) ({len(changed)}):")
        for name in changed:
            print(f"  ~ {name}")
        print()

    if up_to_date:
        print(f"Up to date ({len(up_to_date)}):")
        for name, record in up_to_date:
            rows = record.get("rows", "?")
            fmt = record.get("format", "?")
            print(f"  ✓ {name} ({rows} rows, {fmt})")
        print()

    if manifest.get("last_run"):
        print(f"Last run: {manifest['last_run']}")

    if manifest.get("stats"):
        stats = manifest["stats"]
        print(f"Tokenization: {stats.get('merchants', 0)} merchants, {stats.get('persons', 0)} persons, {stats.get('ids', 0)} IDs")


def main():
    parser = argparse.ArgumentParser(
        description="Anonymize financial import files for testing (uses scrubadub)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Default workflow (no arguments):
  Processes data/raw/*.csv -> data/anonymized/
  Tracks file hashes in manifest.json to skip unchanged files

Examples:
  %(prog)s                          # Process new/changed files
  %(prog)s --status                 # Show what's processed/pending
  %(prog)s --force                  # Reprocess all files
  %(prog)s input.csv output.csv     # Single file mode
        """
    )
    parser.add_argument('input', nargs='?', type=Path, help='Input CSV file (single file mode)')
    parser.add_argument('output', nargs='?', type=Path, help='Output file (single file mode)')
    parser.add_argument('--status', action='store_true', help='Show processing status')
    parser.add_argument('--force', '-f', action='store_true', help='Reprocess all files')
    parser.add_argument('--seed', '-s', default='anonymize', help='Seed for consistent tokenization')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--raw-dir', type=Path, default=RAW_DIR, help='Raw data directory')
    parser.add_argument('--anon-dir', type=Path, default=ANON_DIR, help='Anonymized output directory')

    args = parser.parse_args()

    if args.status:
        show_status(args.raw_dir, args.anon_dir, MANIFEST_FILE)
        return

    if args.input and args.output:
        replacer = ConsistentReplacer(seed=args.seed)
        scrubber = create_scrubber(replacer)
        result = anonymize_file(args.input, args.output, scrubber, replacer)
        print(f"Created {args.output} ({result.get('rows', 0)} transactions, {result.get('format', 'unknown')} format)")
        return

    if not args.raw_dir.exists():
        print(f"Raw directory not found: {args.raw_dir}", file=sys.stderr)
        print("Create it and add CSV files to anonymize.", file=sys.stderr)
        sys.exit(1)

    print(f"Processing: {args.raw_dir} -> {args.anon_dir}")
    if args.force:
        print("(Force mode: reprocessing all files)")
    print()

    result = process_directory(
        args.raw_dir,
        args.anon_dir,
        MANIFEST_FILE,
        force=args.force,
        verbose=args.verbose
    )

    print()
    print(f"Done: {result['processed']} processed, {result['skipped']} skipped, {result['errors']} errors")


if __name__ == "__main__":
    main()
