import { Airport } from '../types';
import { cacheService } from './cache.service';

// Curated major world airports dataset
const AIRPORTS_DATA: Airport[] = [
  { id: 'KATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'United States', iata: 'ATL', icao: 'KATL', latitude: 33.6407, longitude: -84.4277, altitude: 313, type: 'large_airport' },
  { id: 'KLAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', iata: 'LAX', icao: 'KLAX', latitude: 33.9425, longitude: -118.4081, altitude: 38, type: 'large_airport' },
  { id: 'KORD', name: "O'Hare International", city: 'Chicago', country: 'United States', iata: 'ORD', icao: 'KORD', latitude: 41.9742, longitude: -87.9073, altitude: 205, type: 'large_airport' },
  { id: 'KDFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'United States', iata: 'DFW', icao: 'KDFW', latitude: 32.8968, longitude: -97.038, altitude: 182, type: 'large_airport' },
  { id: 'KDEN', name: 'Denver International', city: 'Denver', country: 'United States', iata: 'DEN', icao: 'KDEN', latitude: 39.8561, longitude: -104.6737, altitude: 1655, type: 'large_airport' },
  { id: 'KJFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', iata: 'JFK', icao: 'KJFK', latitude: 40.6413, longitude: -73.7781, altitude: 4, type: 'large_airport' },
  { id: 'KSFO', name: 'San Francisco International', city: 'San Francisco', country: 'United States', iata: 'SFO', icao: 'KSFO', latitude: 37.6213, longitude: -122.379, altitude: 4, type: 'large_airport' },
  { id: 'KSEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'United States', iata: 'SEA', icao: 'KSEA', latitude: 47.449, longitude: -122.3093, altitude: 133, type: 'large_airport' },
  { id: 'KMIA', name: 'Miami International', city: 'Miami', country: 'United States', iata: 'MIA', icao: 'KMIA', latitude: 25.7959, longitude: -80.287, altitude: 3, type: 'large_airport' },
  { id: 'KBOS', name: 'Boston Logan International', city: 'Boston', country: 'United States', iata: 'BOS', icao: 'KBOS', latitude: 42.3643, longitude: -71.0052, altitude: 9, type: 'large_airport' },
  { id: 'EGLL', name: 'London Heathrow', city: 'London', country: 'United Kingdom', iata: 'LHR', icao: 'EGLL', latitude: 51.4775, longitude: -0.4614, altitude: 25, type: 'large_airport' },
  { id: 'LFPG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', iata: 'CDG', icao: 'LFPG', latitude: 49.0097, longitude: 2.5478, altitude: 119, type: 'large_airport' },
  { id: 'EDDF', name: 'Frankfurt am Main', city: 'Frankfurt', country: 'Germany', iata: 'FRA', icao: 'EDDF', latitude: 50.0379, longitude: 8.5622, altitude: 111, type: 'large_airport' },
  { id: 'EHAM', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands', iata: 'AMS', icao: 'EHAM', latitude: 52.3105, longitude: 4.7683, altitude: -3, type: 'large_airport' },
  { id: 'LEMD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', iata: 'MAD', icao: 'LEMD', latitude: 40.4719, longitude: -3.5626, altitude: 610, type: 'large_airport' },
  { id: 'LIRF', name: 'Leonardo da Vinci International', city: 'Rome', country: 'Italy', iata: 'FCO', icao: 'LIRF', latitude: 41.8003, longitude: 12.2389, altitude: 13, type: 'large_airport' },
  { id: 'ZUUU', name: 'Chengdu Tianfu International', city: 'Chengdu', country: 'China', iata: 'TFU', icao: 'ZUUU', latitude: 30.3124, longitude: 104.4440, altitude: 450, type: 'large_airport' },
  { id: 'ZBAA', name: 'Beijing Capital International', city: 'Beijing', country: 'China', iata: 'PEK', icao: 'ZBAA', latitude: 40.0799, longitude: 116.6031, altitude: 35, type: 'large_airport' },
  { id: 'ZSPD', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', iata: 'PVG', icao: 'ZSPD', latitude: 31.1434, longitude: 121.8052, altitude: 4, type: 'large_airport' },
  { id: 'VHHH', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong', iata: 'HKG', icao: 'VHHH', latitude: 22.3089, longitude: 113.9144, altitude: 9, type: 'large_airport' },
  { id: 'RJTT', name: 'Tokyo Haneda International', city: 'Tokyo', country: 'Japan', iata: 'HND', icao: 'RJTT', latitude: 35.5533, longitude: 139.7811, altitude: 6, type: 'large_airport' },
  { id: 'RJAA', name: 'Narita International', city: 'Tokyo', country: 'Japan', iata: 'NRT', icao: 'RJAA', latitude: 35.7647, longitude: 140.3864, altitude: 43, type: 'large_airport' },
  { id: 'RKSI', name: 'Incheon International', city: 'Seoul', country: 'South Korea', iata: 'ICN', icao: 'RKSI', latitude: 37.4691, longitude: 126.4505, altitude: 7, type: 'large_airport' },
  { id: 'WSSS', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', iata: 'SIN', icao: 'WSSS', latitude: 1.3644, longitude: 103.9915, altitude: 7, type: 'large_airport' },
  { id: 'OMDB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates', iata: 'DXB', icao: 'OMDB', latitude: 25.2532, longitude: 55.3657, altitude: 19, type: 'large_airport' },
  { id: 'OOMS', name: 'Muscat International', city: 'Muscat', country: 'Oman', iata: 'MCT', icao: 'OOMS', latitude: 23.5933, longitude: 58.2844, altitude: 48, type: 'large_airport' },
  { id: 'VIDP', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', iata: 'DEL', icao: 'VIDP', latitude: 28.5665, longitude: 77.1031, altitude: 237, type: 'large_airport' },
  { id: 'VABB', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India', iata: 'BOM', icao: 'VABB', latitude: 19.0896, longitude: 72.8656, altitude: 11, type: 'large_airport' },
  { id: 'VOBL', name: 'Kempegowda International', city: 'Bangalore', country: 'India', iata: 'BLR', icao: 'VOBL', latitude: 13.1979, longitude: 77.7063, altitude: 915, type: 'large_airport' },
  { id: 'VOMM', name: 'Chennai International', city: 'Chennai', country: 'India', iata: 'MAA', icao: 'VOMM', latitude: 12.9941, longitude: 80.1709, altitude: 16, type: 'large_airport' },
  { id: 'SBGR', name: 'São Paulo/Guarulhos International', city: 'São Paulo', country: 'Brazil', iata: 'GRU', icao: 'SBGR', latitude: -23.4356, longitude: -46.4731, altitude: 750, type: 'large_airport' },
  { id: 'SAEZ', name: 'Ministro Pistarini International', city: 'Buenos Aires', country: 'Argentina', iata: 'EZE', icao: 'SAEZ', latitude: -34.8222, longitude: -58.5358, altitude: 20, type: 'large_airport' },
  { id: 'YSSY', name: 'Sydney Kingsford Smith International', city: 'Sydney', country: 'Australia', iata: 'SYD', icao: 'YSSY', latitude: -33.9399, longitude: 151.1753, altitude: 6, type: 'large_airport' },
  { id: 'YMML', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', iata: 'MEL', icao: 'YMML', latitude: -37.6733, longitude: 144.8433, altitude: 132, type: 'large_airport' },
  { id: 'CYYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada', iata: 'YYZ', icao: 'CYYZ', latitude: 43.6772, longitude: -79.6306, altitude: 173, type: 'large_airport' },
  { id: 'CYVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada', iata: 'YVR', icao: 'CYVR', latitude: 49.1939, longitude: -123.1844, altitude: 4, type: 'large_airport' },
  { id: 'UUEE', name: 'Sheremetyevo International', city: 'Moscow', country: 'Russia', iata: 'SVO', icao: 'UUEE', latitude: 55.9726, longitude: 37.4146, altitude: 192, type: 'large_airport' },
  { id: 'HAAB', name: 'Bole International', city: 'Addis Ababa', country: 'Ethiopia', iata: 'ADD', icao: 'HAAB', latitude: 8.9779, longitude: 38.799, altitude: 2334, type: 'large_airport' },
  { id: 'HECA', name: 'Cairo International', city: 'Cairo', country: 'Egypt', iata: 'CAI', icao: 'HECA', latitude: 30.1219, longitude: 31.4056, altitude: 114, type: 'large_airport' },
  { id: 'FAOR', name: 'O.R. Tambo International', city: 'Johannesburg', country: 'South Africa', iata: 'JNB', icao: 'FAOR', latitude: -26.1392, longitude: 28.246, altitude: 1694, type: 'large_airport' },
  { id: 'MMMX', name: 'Licenciado Benito Juárez International', city: 'Mexico City', country: 'Mexico', iata: 'MEX', icao: 'MMMX', latitude: 19.4363, longitude: -99.0721, altitude: 2230, type: 'large_airport' },
  { id: 'OTHH', name: 'Hamad International', city: 'Doha', country: 'Qatar', iata: 'DOH', icao: 'OTHH', latitude: 25.2731, longitude: 51.6081, altitude: 13, type: 'large_airport' },
  { id: 'OERK', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', iata: 'RUH', icao: 'OERK', latitude: 24.9576, longitude: 46.6988, altitude: 614, type: 'large_airport' },
  { id: 'VTBS', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', iata: 'BKK', icao: 'VTBS', latitude: 13.6811, longitude: 100.7475, altitude: 2, type: 'large_airport' },
  { id: 'WIII', name: 'Soekarno-Hatta International', city: 'Jakarta', country: 'Indonesia', iata: 'CGK', icao: 'WIII', latitude: -6.1256, longitude: 106.6559, altitude: 8, type: 'large_airport' },
  { id: 'RPLL', name: 'Ninoy Aquino International', city: 'Manila', country: 'Philippines', iata: 'MNL', icao: 'RPLL', latitude: 14.5086, longitude: 121.0197, altitude: 22, type: 'large_airport' },
];

export function getAirports(params?: { country?: string; type?: string }): Airport[] {
  const key = `airports_${params?.country || 'all'}_${params?.type || 'all'}`;
  const cached = cacheService.get<Airport[]>(key);
  if (cached) return cached;

  let result = AIRPORTS_DATA;

  if (params?.country) {
    const c = params.country.toLowerCase();
    result = result.filter(a => a.country.toLowerCase().includes(c));
  }
  if (params?.type) {
    result = result.filter(a => a.type === params.type);
  }

  cacheService.set(key, result, 3600);
  return result;
}

export function getAirportsByBbox(bbox: { lamin: number; lamax: number; lomin: number; lomax: number }): Airport[] {
  return AIRPORTS_DATA.filter(
    a => a.latitude >= bbox.lamin && a.latitude <= bbox.lamax &&
         a.longitude >= bbox.lomin && a.longitude <= bbox.lomax
  );
}
