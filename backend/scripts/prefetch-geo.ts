/**
 * Pre-downloads ADM1 (state/province) boundaries for all countries from GeoBoundaries.
 * Run once: npx ts-node scripts/prefetch-geo.ts
 * Re-running is safe — already-cached countries are skipped.
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const GEO_CACHE_DIR = path.join(__dirname, '../data/geo');
fs.mkdirSync(GEO_CACHE_DIR, { recursive: true });

const ISO2_TO_ISO3: Record<string, string> = {
  AF:'AFG', AL:'ALB', DZ:'DZA', AD:'AND', AO:'AGO', AG:'ATG', AR:'ARG', AM:'ARM',
  AU:'AUS', AT:'AUT', AZ:'AZE', BS:'BHS', BH:'BHR', BD:'BGD', BB:'BRB', BY:'BLR',
  BE:'BEL', BZ:'BLZ', BJ:'BEN', BT:'BTN', BO:'BOL', BA:'BIH', BW:'BWA', BR:'BRA',
  BN:'BRN', BG:'BGR', BF:'BFA', BI:'BDI', CV:'CPV', KH:'KHM', CM:'CMR', CA:'CAN',
  CF:'CAF', TD:'TCD', CL:'CHL', CN:'CHN', CO:'COL', KM:'COM', CD:'COD', CG:'COG',
  CR:'CRI', CI:'CIV', HR:'HRV', CU:'CUB', CY:'CYP', CZ:'CZE', DK:'DNK', DJ:'DJI',
  DM:'DMA', DO:'DOM', EC:'ECU', EG:'EGY', SV:'SLV', GQ:'GNQ', ER:'ERI', EE:'EST',
  SZ:'SWZ', ET:'ETH', FJ:'FJI', FI:'FIN', FR:'FRA', GA:'GAB', GM:'GMB', GE:'GEO',
  DE:'DEU', GH:'GHA', GR:'GRC', GD:'GRD', GT:'GTM', GN:'GIN', GW:'GNB', GY:'GUY',
  HT:'HTI', HN:'HND', HU:'HUN', IS:'ISL', IN:'IND', ID:'IDN', IR:'IRN', IQ:'IRQ',
  IE:'IRL', IL:'ISR', IT:'ITA', JM:'JAM', JP:'JPN', JO:'JOR', KZ:'KAZ', KE:'KEN',
  KI:'KIR', KP:'PRK', KR:'KOR', KW:'KWT', KG:'KGZ', LA:'LAO', LV:'LVA', LB:'LBN',
  LS:'LSO', LR:'LBR', LY:'LBY', LI:'LIE', LT:'LTU', LU:'LUX', MG:'MDG', MW:'MWI',
  MY:'MYS', MV:'MDV', ML:'MLI', MT:'MLT', MH:'MHL', MR:'MRT', MU:'MUS', MX:'MEX',
  FM:'FSM', MD:'MDA', MC:'MCO', MN:'MNG', ME:'MNE', MA:'MAR', MZ:'MOZ', MM:'MMR',
  NA:'NAM', NR:'NRU', NP:'NPL', NL:'NLD', NZ:'NZL', NI:'NIC', NE:'NER', NG:'NGA',
  MK:'MKD', NO:'NOR', OM:'OMN', PK:'PAK', PW:'PLW', PA:'PAN', PG:'PNG', PY:'PRY',
  PE:'PER', PH:'PHL', PL:'POL', PT:'PRT', QA:'QAT', RO:'ROU', RU:'RUS', RW:'RWA',
  KN:'KNA', LC:'LCA', VC:'VCT', WS:'WSM', SM:'SMR', ST:'STP', SA:'SAU', SN:'SEN',
  RS:'SRB', SC:'SYC', SL:'SLE', SG:'SGP', SK:'SVK', SI:'SVN', SB:'SLB', SO:'SOM',
  ZA:'ZAF', SS:'SSD', ES:'ESP', LK:'LKA', SD:'SDN', SR:'SUR', SE:'SWE', CH:'CHE',
  SY:'SYR', TW:'TWN', TJ:'TJK', TZ:'TZA', TH:'THA', TL:'TLS', TG:'TGO', TO:'TON',
  TT:'TTO', TN:'TUN', TR:'TUR', TM:'TKM', TV:'TUV', UG:'UGA', UA:'UKR', AE:'ARE',
  GB:'GBR', US:'USA', UY:'URY', UZ:'UZB', VU:'VUT', VE:'VEN', VN:'VNM', YE:'YEM',
  ZM:'ZMB', ZW:'ZWE',
};

async function fetchCountry(iso2: string, iso3: string): Promise<void> {
  const diskPath = path.join(GEO_CACHE_DIR, `${iso3}.json`);
  if (fs.existsSync(diskPath)) {
    process.stdout.write(`  SKIP ${iso2}/${iso3}\n`);
    return;
  }

  const url =
    `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main` +
    `/releaseData/gbOpen/${iso3}/ADM1/geoBoundaries-${iso3}-ADM1_simplified.geojson`;

  try {
    const res = await axios.get(url, { timeout: 60_000, responseType: 'text' });
    const geojson = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    fs.writeFileSync(diskPath, JSON.stringify(geojson));
    process.stdout.write(`  OK   ${iso2}/${iso3} (${geojson.features?.length ?? '?'} features)\n`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stdout.write(`  FAIL ${iso2}/${iso3}: ${msg}\n`);
  }
}

async function main(): Promise<void> {
  const entries = Object.entries(ISO2_TO_ISO3);
  const BATCH = 4; // 4 parallel — polite to the GitHub CDN
  let done = 0;

  console.log(`Prefetching ADM1 boundaries for ${entries.length} countries → ${GEO_CACHE_DIR}`);

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await Promise.all(batch.map(([iso2, iso3]) => fetchCountry(iso2, iso3)));
    done += batch.length;
    console.log(`[${done}/${entries.length}]`);
    if (i + BATCH < entries.length) {
      // 800ms pause between batches — avoids hammering the CDN
      await new Promise(r => setTimeout(r, 800));
    }
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
