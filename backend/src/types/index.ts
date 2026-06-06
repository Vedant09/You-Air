export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number | null;
  latitude: number | null;
  baroAltitude: number | null;
  onGround: boolean;
  velocity: number | null;
  trueTrack: number | null;
  verticalRate: number | null;
  geoAltitude: number | null;
  squawk: string | null;
  spi: boolean;
  positionSource: number;
}

export interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | null)[][] | null;
}

export interface Airport {
  id: string;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: number;
  longitude: number;
  altitude: number;
  type: 'large_airport' | 'medium_airport' | 'small_airport' | 'heliport';
}

export interface FlightStats {
  totalFlights: number;
  onGround: number;
  airborne: number;
  topCountries: { country: string; count: number }[];
  updatedAt: number;
}

export interface BoundingBox {
  lamin: number;
  lamax: number;
  lomin: number;
  lomax: number;
}
