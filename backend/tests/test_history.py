"""Targeted history tests. No network calls or source-data fabrication in the UI."""
from pathlib import Path
import pytest
from app.tle_validation import validate_tle_lines

# 2021-format ISS-looking test fixture. Epoch edits below are clearly synthetic
# unit-test input, NOT data surfaced to APHELION users.
RAW_LINE_1 = '1 25544U 98067A   21275.51859137  .00001435  00000-0  33240-4 0  9993'
RAW_LINE_2 = '2 25544  51.6437  79.2033 0004819 190.2079 169.8807 15.48815372305678'


def checksum(line):
    prefix = line[:68]
    return prefix + str(sum(int(ch) if ch.isdigit() else (1 if ch == '-' else 0) for ch in prefix) % 10)


def sample(epoch='21275.51859137'):
    return 'ISS (ZARYA)\n' + checksum(RAW_LINE_1.replace('21275.51859137', epoch)) + '\n' + checksum(RAW_LINE_2) + '\n'


def test_tle_validation_checksum_and_catalogue():
    actual = validate_tle_lines(sample())
    assert len(actual) == 2 and all(line[2:7] == '25544' for line in actual)
    with pytest.raises(ValueError, match='checksum'):
        validate_tle_lines(sample()[:-2]+'9\n')
    with pytest.raises(ValueError, match='25544'):
        validate_tle_lines(sample().replace('25544U','25545U'))


def test_tle_rejects_malformed_or_extra_lines():
    with pytest.raises(ValueError): validate_tle_lines('garbage')
    with pytest.raises(ValueError): validate_tle_lines(sample()+'2 garbage\n')
    with pytest.raises(ValueError): validate_tle_lines('x'*513)


def test_archive_and_common_epoch_propagation(tmp_path, monkeypatch):
    pytest.importorskip('skyfield')
    from app import history
    monkeypatch.setattr(history, 'HISTORY_FILE', tmp_path / 'snapshots.json')
    a = history.import_snapshot(sample())
    assert history.import_snapshot(sample())['id'] == a['id']
    b = history.import_snapshot(sample('21276.51859137'))
    assert len(history.list_snapshots()) == 2
    assert b['id'] != a['id']
    with pytest.raises(ValueError, match='different recorded'):
        history.compare_history(a['id'],a['id'],3)
    comparison = history.compare_history(a['id'],b['id'],3)
    assert comparison['kind'] == 'sgp4_historical_snapshot_comparison'
    assert comparison['reference_track'][0]['time'] == comparison['numerical_track'][0]['time']
    assert comparison['epoch_utc'] == b['epoch_utc']
    assert len(comparison['diagnostics']) == 91
    assert all(x['separation_km'] >= 0 for x in comparison['diagnostics'])
    assert all(abs(x['separation_km'] ** 2 - (x['radial_km']**2 + x['along_track_km']**2 + x['cross_track_km']**2)) < 1e-3 for x in comparison['diagnostics'])
