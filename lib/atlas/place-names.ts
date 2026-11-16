// The world's places by name, so a search can tell a place Explore doesn't
// cover from a word it doesn't know (lib/atlas/places.ts).
//
// One country per line: ISO 3166 numeric | region | name | other names.
// A name may carry "the" ("the Netherlands"); matching ignores it, and
// ignores case, accents and punctuation. US states and territories are listed
// separately (as the US layers key them), so "Georgia" is the state and
// "New Mexico" never reads as Mexico.
//
// Regions: EU Europe · AS Asia · ME Middle East · AF Africa · NA North America ·
// CA Central America · CB Caribbean · SA South America · OC Oceania.

const COUNTRIES = `
004|AS|Afghanistan
008|EU|Albania
012|AF|Algeria
020|EU|Andorra
024|AF|Angola
028|CB|Antigua and Barbuda|antigua
031|AS|Azerbaijan
032|SA|Argentina
036|OC|Australia
040|EU|Austria|osterreich
044|CB|the Bahamas|bahamas
048|ME|Bahrain
050|AS|Bangladesh
051|AS|Armenia
052|CB|Barbados
056|EU|Belgium|belgique|belgie
060|NA|Bermuda
064|AS|Bhutan
068|SA|Bolivia
070|EU|Bosnia and Herzegovina|bosnia
072|AF|Botswana
076|SA|Brazil|brasil
084|CA|Belize
090|OC|the Solomon Islands|solomon islands
092|CB|the British Virgin Islands|british virgin islands|bvi
096|AS|Brunei
100|EU|Bulgaria
104|AS|Myanmar|burma
108|AF|Burundi
112|EU|Belarus
116|AS|Cambodia
120|AF|Cameroon
124|NA|Canada
132|AF|Cabo Verde|cape verde
136|CB|the Cayman Islands|cayman islands|cayman
140|AF|the Central African Republic|central african republic
144|AS|Sri Lanka
148|AF|Chad
152|SA|Chile
156|AS|China|prc
158|AS|Taiwan
170|SA|Colombia
174|AF|Comoros
178|AF|the Republic of the Congo|republic of the congo|congo brazzaville|congo
180|AF|the Democratic Republic of the Congo|democratic republic of the congo|dr congo|drc|congo kinshasa|zaire
184|OC|the Cook Islands|cook islands
188|CA|Costa Rica
191|EU|Croatia|hrvatska
192|CB|Cuba
196|EU|Cyprus
203|EU|Czechia|czech republic
204|AF|Benin
208|EU|Denmark|danmark
212|CB|Dominica
214|CB|the Dominican Republic|dominican republic
218|SA|Ecuador
222|CA|El Salvador
226|AF|Equatorial Guinea
231|AF|Ethiopia
232|AF|Eritrea
233|EU|Estonia
234|EU|the Faroe Islands|faroe islands|faroes
238|SA|the Falkland Islands|falkland islands|falklands|malvinas
242|OC|Fiji
246|EU|Finland|suomi
250|EU|France
254|SA|French Guiana
258|OC|French Polynesia|tahiti
262|AF|Djibouti
266|AF|Gabon
268|AS|Georgia|republic of georgia|sakartvelo
270|AF|the Gambia|gambia
275|ME|Palestine|west bank|gaza
276|EU|Germany|deutschland
288|AF|Ghana
292|EU|Gibraltar
296|OC|Kiribati
300|EU|Greece|hellas
304|NA|Greenland
308|CB|Grenada
312|CB|Guadeloupe
320|CA|Guatemala
324|AF|Guinea
328|SA|Guyana
332|CB|Haiti
336|EU|Vatican City|vatican|holy see
340|CA|Honduras
344|AS|Hong Kong
348|EU|Hungary|magyarorszag
352|EU|Iceland
356|AS|India|bharat
360|AS|Indonesia
364|ME|Iran
368|ME|Iraq
372|EU|Ireland|eire|republic of ireland
376|ME|Israel
380|EU|Italy|italia
384|AF|Côte d'Ivoire|ivory coast
388|CB|Jamaica
392|AS|Japan
398|AS|Kazakhstan
400|ME|Jordan
404|AF|Kenya
408|AS|North Korea
410|AS|South Korea|korea|republic of korea
414|ME|Kuwait
417|AS|Kyrgyzstan
418|AS|Laos
422|ME|Lebanon
426|AF|Lesotho
428|EU|Latvia
430|AF|Liberia
434|AF|Libya
438|EU|Liechtenstein
440|EU|Lithuania
442|EU|Luxembourg
446|AS|Macao|macau
450|AF|Madagascar
454|AF|Malawi
458|AS|Malaysia
462|AS|the Maldives|maldives
466|AF|Mali
470|EU|Malta
474|CB|Martinique
478|AF|Mauritania
480|AF|Mauritius
484|NA|Mexico
492|EU|Monaco
496|AS|Mongolia
498|EU|Moldova
499|EU|Montenegro
500|CB|Montserrat
504|AF|Morocco
508|AF|Mozambique
512|ME|Oman
516|AF|Namibia
520|OC|Nauru
524|AS|Nepal
528|EU|the Netherlands|netherlands|holland|nederland
531|CB|Curaçao
533|CB|Aruba
540|OC|New Caledonia
548|OC|Vanuatu
554|OC|New Zealand|aotearoa
558|CA|Nicaragua
562|AF|Niger
566|AF|Nigeria
570|OC|Niue
578|EU|Norway|norge
586|AS|Pakistan
591|CA|Panama
598|OC|Papua New Guinea|png
600|SA|Paraguay
604|SA|Peru
608|AS|the Philippines|philippines
616|EU|Poland|polska
620|EU|Portugal
624|AF|Guinea-Bissau
626|AS|Timor-Leste|east timor
634|ME|Qatar
638|AF|Réunion
642|EU|Romania
643|EU|Russia|russian federation
646|AF|Rwanda
652|CB|Saint Barthélemy|st barts|st barths
654|AF|Saint Helena|st helena
659|CB|Saint Kitts and Nevis|st kitts and nevis|st kitts
660|CB|Anguilla
662|CB|Saint Lucia|st lucia
663|CB|Saint Martin|st martin|sint maarten
666|NA|Saint Pierre and Miquelon
670|CB|Saint Vincent and the Grenadines|st vincent and the grenadines|st vincent
674|EU|San Marino
678|AF|São Tomé and Príncipe|sao tome
682|ME|Saudi Arabia|ksa
686|AF|Senegal
688|EU|Serbia
690|AF|the Seychelles|seychelles
694|AF|Sierra Leone
702|AS|Singapore
703|EU|Slovakia|slovak republic
704|AS|Vietnam|viet nam
705|EU|Slovenia
706|AF|Somalia
710|AF|South Africa
716|AF|Zimbabwe
724|EU|Spain|espana
728|AF|South Sudan
729|AF|Sudan
732|AF|Western Sahara
740|SA|Suriname|surinam
748|AF|Eswatini|swaziland
752|EU|Sweden|sverige
756|EU|Switzerland|schweiz|suisse|svizzera
760|ME|Syria
762|AS|Tajikistan
764|AS|Thailand
768|AF|Togo
776|OC|Tonga
780|CB|Trinidad and Tobago|trinidad
784|ME|the United Arab Emirates|united arab emirates|uae|emirates|dubai|abu dhabi
788|AF|Tunisia
792|ME|Turkey|turkiye
795|AS|Turkmenistan
796|CB|the Turks and Caicos Islands|turks and caicos islands|turks and caicos
798|OC|Tuvalu
800|AF|Uganda
804|EU|Ukraine
807|EU|North Macedonia|macedonia
818|AF|Egypt
826|EU|the United Kingdom|united kingdom|uk|u k|great britain|britain|england|scotland|wales|northern ireland
831|EU|Guernsey
832|EU|Jersey
833|EU|the Isle of Man|isle of man
834|AF|Tanzania
840|NA|the United States|united states|united states of america|usa|us|u s|u s a|america
854|AF|Burkina Faso
858|SA|Uruguay
860|AS|Uzbekistan
862|SA|Venezuela
876|OC|Wallis and Futuna
882|OC|Samoa
887|ME|Yemen
894|AF|Zambia
XKX|EU|Kosovo
`;

export interface CountryName { iso: string; region: string; name: string; aliases: string[] }
export const COUNTRY_NAMES: CountryName[] = COUNTRIES.trim().split("\n").map((line) => {
  const [iso, region, name, ...aliases] = line.split("|");
  return { iso, region, name, aliases };
});

/** US states and territories, as the US layers key them. */
export const STATE_NAME: Record<string, string> = {
  AK: "Alaska", AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California", CO: "Colorado", CT: "Connecticut", DC: "District of Columbia", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi", MT: "Montana", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin", WV: "West Virginia", WY: "Wyoming", VI: "US Virgin Islands", GU: "Guam", AS: "American Samoa", MP: "Northern Mariana Islands", FM: "Micronesia", MH: "Marshall Islands", PW: "Palau",
};
export const STATE_ALIASES: Record<string, string[]> = { DC: ["washington dc", "washington d c", "dc", "d c"], VI: ["virgin islands", "usvi"], MP: ["mariana islands", "saipan"] };

/** Regions by name: the region codes above, plus any US states in them. */
export interface RegionName { name: string; aliases: string[]; regions: string[]; isos?: string[]; states?: string[] }
export const REGION_NAMES: RegionName[] = [
  { name: "Europe", aliases: ["europe", "european union", "eu", "eurozone"], regions: ["EU"] },
  { name: "Asia", aliases: ["asia"], regions: ["AS", "ME"] },
  { name: "the Middle East", aliases: ["middle east", "gulf", "gcc"], regions: ["ME"] },
  { name: "Africa", aliases: ["africa"], regions: ["AF"] },
  { name: "North America", aliases: ["north america"], regions: ["NA", "CA", "CB"], states: ["PR", "VI"] },
  { name: "Central America", aliases: ["central america"], regions: ["CA"] },
  { name: "the Caribbean", aliases: ["caribbean", "west indies"], regions: ["CB"], states: ["PR", "VI"] },
  { name: "South America", aliases: ["south america"], regions: ["SA"] },
  { name: "Latin America", aliases: ["latin america", "latam", "latinoamerica"], regions: ["SA", "CA"], isos: ["484", "192", "214"], states: ["PR"] },
  { name: "Oceania", aliases: ["oceania", "pacific", "pacific islands", "australasia"], regions: ["OC"], states: ["GU", "AS", "MP", "FM", "MH", "PW"] },
];
