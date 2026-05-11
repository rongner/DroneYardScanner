import math
from dataclasses import dataclass


@dataclass
class RelativeMove:
    x: int  # cm, positive = forward
    y: int  # cm, positive = left
    z: int  # cm, positive = up (0 = maintain altitude)


def haversine_distance_cm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in centimetres between two GPS coordinates."""
    R = 6_371_000_00  # Earth radius in centimetres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns bearing in degrees (0 = North, 90 = East) from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    x = math.sin(dlambda) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def gps_to_relative_move(
    lat1: float, lon1: float,
    lat2: float, lon2: float,
    drone_heading: float = 0.0,  # degrees from North
) -> RelativeMove:
    """
    Converts two GPS coordinates to a Tello-relative move.
    The Tello's x axis is forward (in the direction it's facing), y is left.
    """
    distance_cm = haversine_distance_cm(lat1, lon1, lat2, lon2)
    target_bearing = bearing_degrees(lat1, lon1, lat2, lon2)

    # Angle relative to drone heading
    relative_angle = math.radians(target_bearing - drone_heading)

    x = int(distance_cm * math.cos(relative_angle))  # forward component
    y = int(distance_cm * math.sin(relative_angle))  # lateral component

    # Clamp to Tello's supported range (20–500 cm per move)
    max_move = 500
    if abs(x) > max_move or abs(y) > max_move:
        scale = max_move / max(abs(x), abs(y))
        x, y = int(x * scale), int(y * scale)

    return RelativeMove(x=x, y=y, z=0)
