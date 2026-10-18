"""Format and checksum validation for historical ISS two-line element records."""


def validate_tle_lines(raw: str) -> list[str]:
    """Validate NORAD 25544 records before passing them to SGP4."""
    if len(raw) > 512:
        raise ValueError('TLE input too long')
    lines = [line.rstrip() for line in raw.replace('\r', '').split('\n') if line.strip()]
    if len(lines) == 3 and not lines[0].startswith(('1 ', '2 ')):
        lines = lines[1:]
    if len(lines) != 2 or not lines[0].startswith('1 ') or not lines[1].startswith('2 '):
        raise ValueError('Supply one ISS two-line element set (optional name line)')
    for number, line in enumerate(lines, 1):
        if len(line) != 69 or line[0] != str(number) or line[2:7] != '25544':
            raise ValueError('Both lines must be 69-character NORAD 25544 elements')
        if not line[-1].isdigit():
            raise ValueError('Invalid TLE checksum digit')
        checksum = sum(int(ch) if ch.isdigit() else (1 if ch == '-' else 0) for ch in line[:68]) % 10
        if checksum != int(line[-1]):
            raise ValueError(f'Invalid checksum on TLE line {number}')
    return lines
