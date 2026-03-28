/**
 * Point-in-polygon test using ray casting algorithm
 * Determines if a point [lat, lon] is inside a polygon
 */
export function isPointInPolygon(
	point: [number, number],
	polygon: (number[])[] | (number[][])[]
): boolean {
	const [lat, lon] = point;
	let isInside = false;

	// Flatten polygon if it's a multi-polygon or nested structure
	let coords = polygon as (number[])[];
	if (polygon.length > 0 && Array.isArray(polygon[0][0])) {
		// If it's a multi-polygon, use the first polygon
		coords = (polygon[0] as (number[])[]);
	}

	for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
		const coord_i = coords[i];
		const coord_j = coords[j];
		
		if (!Array.isArray(coord_i) || !Array.isArray(coord_j)) continue;
		
		const xi = coord_i[0] as number;
		const yi = coord_i[1] as number;
		const xj = coord_j[0] as number;
		const yj = coord_j[1] as number;

		const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
		if (intersect) isInside = !isInside;
	}

	return isInside;
}

/**
 * Checks if a point is within a GeoJSON feature's bounds
 */
export function isPointInGeometry(
	point: [number, number],
	geometry: any
): boolean {
	if (!geometry) return false;

	if (geometry.type === 'Polygon') {
		return isPointInPolygon(point, geometry.coordinates[0]);
	} else if (geometry.type === 'MultiPolygon') {
		// Check if point is in any of the polygons
		return geometry.coordinates.some((polygon: any) =>
			isPointInPolygon(point, polygon[0])
		);
	}

	return false;
}

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371; // Earth's radius in km
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

/**
 * Get the center point of a polygon
 */
export function getPolygonCenter(coordinates: (number[])[]): [number, number] {
	let sumLat = 0;
	let sumLon = 0;
	for (let i = 0; i < coordinates.length; i++) {
		sumLat += coordinates[i][1];
		sumLon += coordinates[i][0];
	}
	return [sumLon / coordinates.length, sumLat / coordinates.length];
}
