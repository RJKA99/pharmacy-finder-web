export interface PharmacyLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string | null;
  source: "overture";
}

export interface Pharmacy extends PharmacyLocation {
  distanceMeters: number;
}

export interface PharmacySearchResult {
  pharmacies: Pharmacy[];
  searchRadiusMeters: number;
  generatedAt: string;
}
