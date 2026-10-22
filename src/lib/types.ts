export interface Pharmacy {
  id: string;
  name: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  address: string | null;
  source: "osm";
}

export interface PharmacySearchResult {
  pharmacies: Pharmacy[];
  searchRadiusMeters: number;
  generatedAt: string;
}

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}
