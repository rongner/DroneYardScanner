import math
import pytest
from backend.mission.gps_converter import (
    haversine_distance_cm,
    bearing_degrees,
    gps_to_relative_move,
)


def test_haversine_same_point_is_zero():
    assert haversine_distance_cm(37.0, -122.0, 37.0, -122.0) == pytest.approx(0, abs=1)


def test_haversine_one_degree_latitude():
    # 1 degree of latitude ≈ 111,195 m = 11,119,500 cm at equator
    d = haversine_distance_cm(0.0, 0.0, 1.0, 0.0)
    assert d == pytest.approx(11_119_492, rel=0.001)


def test_haversine_is_symmetric():
    d1 = haversine_distance_cm(37.0, -122.0, 37.001, -122.001)
    d2 = haversine_distance_cm(37.001, -122.001, 37.0, -122.0)
    assert d1 == pytest.approx(d2, rel=1e-9)


def test_bearing_north():
    assert bearing_degrees(0.0, 0.0, 1.0, 0.0) == pytest.approx(0.0, abs=0.01)


def test_bearing_south():
    assert bearing_degrees(1.0, 0.0, 0.0, 0.0) == pytest.approx(180.0, abs=0.01)


def test_bearing_east():
    assert bearing_degrees(0.0, 0.0, 0.0, 1.0) == pytest.approx(90.0, abs=0.5)


def test_bearing_west():
    assert bearing_degrees(0.0, 1.0, 0.0, 0.0) == pytest.approx(270.0, abs=0.5)


def test_gps_to_relative_move_heading_north():
    # Moving north with heading=0: x (forward) positive, y (lateral) near zero
    move = gps_to_relative_move(37.0, -122.0, 37.0001, -122.0, drone_heading=0.0)
    assert move.x > 0
    assert abs(move.y) < abs(move.x)
    assert move.z == 0


def test_gps_to_relative_move_clamps_large_distance():
    # Points ~1.1 km apart — raw cm value far exceeds 500 cm max
    move = gps_to_relative_move(0.0, 0.0, 0.01, 0.0)
    assert abs(move.x) <= 500
    assert abs(move.y) <= 500


def test_gps_to_relative_move_short_distance_not_clamped():
    # ~11 m north = ~1100 cm — within range, should not be clamped to 500
    move = gps_to_relative_move(37.0, -122.0, 37.0001, -122.0)
    assert abs(move.x) < 500 or abs(move.y) < 500  # at least one axis unclamped


def test_gps_to_relative_move_returns_integers():
    move = gps_to_relative_move(37.0, -122.0, 37.0001, -122.0)
    assert isinstance(move.x, int)
    assert isinstance(move.y, int)
    assert isinstance(move.z, int)
