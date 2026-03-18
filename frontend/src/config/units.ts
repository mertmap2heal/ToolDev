/**
 * Engineering units database.
 * Covers SI base, SI derived, Imperial, and common engineering units.
 * Used by UnitPicker for searchable autocomplete + custom-unit warnings.
 */

export interface UnitDef {
  symbol: string
  name: string
  category: 'SI Base' | 'SI Derived' | 'Imperial' | 'Common' | 'Special'
  quantity: string
  siBreakdown?: string  // e.g. 'kg·m²·s⁻³' for Watt
  aliases?: string[]    // alternate spellings / full names
}

export const ENGINEERING_UNITS: UnitDef[] = [
  // ── SI Base ────────────────────────────────────────────────────────────────
  { symbol: 'm',    name: 'metre',              category: 'SI Base',    quantity: 'length',                aliases: ['meter', 'meters', 'metres'] },
  { symbol: 'kg',   name: 'kilogram',           category: 'SI Base',    quantity: 'mass',                  aliases: ['kilograms', 'kilogramme'] },
  { symbol: 's',    name: 'second',             category: 'SI Base',    quantity: 'time',                  aliases: ['seconds', 'sec'] },
  { symbol: 'A',    name: 'ampere',             category: 'SI Base',    quantity: 'electric current',      aliases: ['amp', 'amps', 'amperes'] },
  { symbol: 'K',    name: 'kelvin',             category: 'SI Base',    quantity: 'temperature',           aliases: ['kelvins'] },
  { symbol: 'mol',  name: 'mole',               category: 'SI Base',    quantity: 'amount of substance',   aliases: ['moles'] },
  { symbol: 'cd',   name: 'candela',            category: 'SI Base',    quantity: 'luminous intensity',    aliases: ['candelas'] },

  // ── SI Derived ─────────────────────────────────────────────────────────────
  { symbol: 'rad',  name: 'radian',             category: 'SI Derived', quantity: 'angle',                 aliases: ['radians'] },
  { symbol: 'sr',   name: 'steradian',          category: 'SI Derived', quantity: 'solid angle' },
  { symbol: 'Hz',   name: 'hertz',              category: 'SI Derived', quantity: 'frequency',             siBreakdown: 's⁻¹' },
  { symbol: 'N',    name: 'newton',             category: 'SI Derived', quantity: 'force',                 siBreakdown: 'kg·m·s⁻²',    aliases: ['newtons'] },
  { symbol: 'Pa',   name: 'pascal',             category: 'SI Derived', quantity: 'pressure',              siBreakdown: 'kg·m⁻¹·s⁻²',  aliases: ['pascals'] },
  { symbol: 'J',    name: 'joule',              category: 'SI Derived', quantity: 'energy',                siBreakdown: 'kg·m²·s⁻²',   aliases: ['joules'] },
  { symbol: 'W',    name: 'watt',               category: 'SI Derived', quantity: 'power',                 siBreakdown: 'kg·m²·s⁻³',   aliases: ['watts'] },
  { symbol: 'C',    name: 'coulomb',            category: 'SI Derived', quantity: 'electric charge',       siBreakdown: 'A·s',          aliases: ['coulombs'] },
  { symbol: 'V',    name: 'volt',               category: 'SI Derived', quantity: 'voltage',               siBreakdown: 'kg·m²·s⁻³·A⁻¹', aliases: ['volts'] },
  { symbol: 'F',    name: 'farad',              category: 'SI Derived', quantity: 'capacitance',           siBreakdown: 'kg⁻¹·m⁻²·s⁴·A²', aliases: ['farads'] },
  { symbol: 'Ω',    name: 'ohm',               category: 'SI Derived', quantity: 'resistance',            siBreakdown: 'kg·m²·s⁻³·A⁻²', aliases: ['ohms', 'Ohm'] },
  { symbol: 'S',    name: 'siemens',            category: 'SI Derived', quantity: 'conductance',           siBreakdown: 'kg⁻¹·m⁻²·s³·A²' },
  { symbol: 'Wb',   name: 'weber',              category: 'SI Derived', quantity: 'magnetic flux',         siBreakdown: 'kg·m²·s⁻²·A⁻¹', aliases: ['webers'] },
  { symbol: 'T',    name: 'tesla',              category: 'SI Derived', quantity: 'magnetic flux density', siBreakdown: 'kg·s⁻²·A⁻¹',  aliases: ['teslas'] },
  { symbol: 'H',    name: 'henry',              category: 'SI Derived', quantity: 'inductance',            siBreakdown: 'kg·m²·s⁻²·A⁻²', aliases: ['henries'] },
  { symbol: '°C',   name: 'degree Celsius',     category: 'SI Derived', quantity: 'temperature',           aliases: ['celsius', 'degC', 'deg C'] },
  { symbol: 'lm',   name: 'lumen',              category: 'SI Derived', quantity: 'luminous flux',         siBreakdown: 'cd·sr',        aliases: ['lumens'] },
  { symbol: 'lx',   name: 'lux',                category: 'SI Derived', quantity: 'illuminance',           siBreakdown: 'cd·sr·m⁻²' },
  { symbol: 'Bq',   name: 'becquerel',          category: 'SI Derived', quantity: 'radioactivity',         siBreakdown: 's⁻¹' },
  { symbol: 'Gy',   name: 'gray',               category: 'SI Derived', quantity: 'absorbed dose',         siBreakdown: 'm²·s⁻²' },
  { symbol: 'Sv',   name: 'sievert',            category: 'SI Derived', quantity: 'dose equivalent',       siBreakdown: 'm²·s⁻²' },
  { symbol: 'kat',  name: 'katal',              category: 'SI Derived', quantity: 'catalytic activity',    siBreakdown: 'mol·s⁻¹' },
  // SI prefixed length
  { symbol: 'km',   name: 'kilometre',          category: 'SI Derived', quantity: 'length',                aliases: ['kilometer', 'kilometers', 'kilometres'] },
  { symbol: 'cm',   name: 'centimetre',         category: 'SI Derived', quantity: 'length',                aliases: ['centimeter'] },
  { symbol: 'mm',   name: 'millimetre',         category: 'SI Derived', quantity: 'length',                aliases: ['millimeter'] },
  { symbol: 'μm',   name: 'micrometre',         category: 'SI Derived', quantity: 'length',                aliases: ['micrometer', 'micron'] },
  { symbol: 'nm',   name: 'nanometre',          category: 'SI Derived', quantity: 'length',                aliases: ['nanometer'] },
  // SI prefixed mass
  { symbol: 'g',    name: 'gram',               category: 'SI Derived', quantity: 'mass',                  aliases: ['grams', 'gramme'] },
  { symbol: 'mg',   name: 'milligram',          category: 'SI Derived', quantity: 'mass',                  aliases: ['milligrams'] },
  { symbol: 't',    name: 'tonne',              category: 'SI Derived', quantity: 'mass',                  aliases: ['metric ton', 'megagram'] },
  // SI prefixed time
  { symbol: 'ms',   name: 'millisecond',        category: 'SI Derived', quantity: 'time',                  aliases: ['milliseconds'] },
  { symbol: 'μs',   name: 'microsecond',        category: 'SI Derived', quantity: 'time',                  aliases: ['microseconds'] },
  { symbol: 'ns',   name: 'nanosecond',         category: 'SI Derived', quantity: 'time',                  aliases: ['nanoseconds'] },
  { symbol: 'min',  name: 'minute',             category: 'SI Derived', quantity: 'time',                  aliases: ['minutes'] },
  { symbol: 'h',    name: 'hour',               category: 'SI Derived', quantity: 'time',                  aliases: ['hours', 'hr'] },
  // SI prefixed pressure
  { symbol: 'kPa',  name: 'kilopascal',         category: 'SI Derived', quantity: 'pressure',              siBreakdown: '1000 Pa' },
  { symbol: 'MPa',  name: 'megapascal',         category: 'SI Derived', quantity: 'pressure',              siBreakdown: '10⁶ Pa' },
  { symbol: 'GPa',  name: 'gigapascal',         category: 'SI Derived', quantity: 'pressure',              siBreakdown: '10⁹ Pa' },
  // SI prefixed energy
  { symbol: 'kJ',   name: 'kilojoule',          category: 'SI Derived', quantity: 'energy',                siBreakdown: '1000 J' },
  { symbol: 'MJ',   name: 'megajoule',          category: 'SI Derived', quantity: 'energy',                siBreakdown: '10⁶ J' },
  // SI prefixed power
  { symbol: 'kW',   name: 'kilowatt',           category: 'SI Derived', quantity: 'power',                 siBreakdown: '1000 W',       aliases: ['kilowatts'] },
  { symbol: 'MW',   name: 'megawatt',           category: 'SI Derived', quantity: 'power',                 siBreakdown: '10⁶ W',        aliases: ['megawatts'] },
  { symbol: 'mW',   name: 'milliwatt',          category: 'SI Derived', quantity: 'power',                 siBreakdown: '0.001 W' },
  // SI prefixed current
  { symbol: 'mA',   name: 'milliampere',        category: 'SI Derived', quantity: 'electric current',      aliases: ['milliamps', 'milliamperes'] },
  { symbol: 'μA',   name: 'microampere',        category: 'SI Derived', quantity: 'electric current',      aliases: ['microamps'] },
  { symbol: 'kA',   name: 'kiloampere',         category: 'SI Derived', quantity: 'electric current' },
  // SI prefixed voltage
  { symbol: 'mV',   name: 'millivolt',          category: 'SI Derived', quantity: 'voltage',               aliases: ['millivolts'] },
  { symbol: 'kV',   name: 'kilovolt',           category: 'SI Derived', quantity: 'voltage',               aliases: ['kilovolts'] },
  // SI prefixed frequency
  { symbol: 'kHz',  name: 'kilohertz',          category: 'SI Derived', quantity: 'frequency',             siBreakdown: '1000 s⁻¹' },
  { symbol: 'MHz',  name: 'megahertz',          category: 'SI Derived', quantity: 'frequency',             siBreakdown: '10⁶ s⁻¹' },
  { symbol: 'GHz',  name: 'gigahertz',          category: 'SI Derived', quantity: 'frequency',             siBreakdown: '10⁹ s⁻¹' },
  // Derived mechanics
  { symbol: 'm/s',  name: 'metre per second',   category: 'SI Derived', quantity: 'speed',                 siBreakdown: 'm·s⁻¹',        aliases: ['m/s', 'mps', 'meters per second'] },
  { symbol: 'km/h', name: 'kilometre per hour', category: 'SI Derived', quantity: 'speed',                 siBreakdown: '0.2778 m·s⁻¹', aliases: ['kph', 'kmh'] },
  { symbol: 'm/s²', name: 'metre per second squared', category: 'SI Derived', quantity: 'acceleration',    siBreakdown: 'm·s⁻²',        aliases: ['m/s2'] },
  { symbol: 'Nm',   name: 'newton metre',       category: 'SI Derived', quantity: 'torque',                siBreakdown: 'kg·m²·s⁻²',   aliases: ['N·m', 'N.m'] },
  { symbol: 'N/m',  name: 'newton per metre',   category: 'SI Derived', quantity: 'stiffness',             siBreakdown: 'kg·s⁻²' },
  { symbol: 'N/m²', name: 'newton per square metre', category: 'SI Derived', quantity: 'pressure',        siBreakdown: 'kg·m⁻¹·s⁻²' },
  { symbol: 'W/m²', name: 'watt per square metre', category: 'SI Derived', quantity: 'heat flux',         siBreakdown: 'kg·s⁻³' },
  { symbol: 'W/(m·K)', name: 'watt per metre kelvin', category: 'SI Derived', quantity: 'thermal conductivity' },
  { symbol: 'J/kg', name: 'joule per kilogram', category: 'SI Derived', quantity: 'specific energy',       siBreakdown: 'm²·s⁻²' },
  { symbol: 'J/(kg·K)', name: 'joule per kilogram kelvin', category: 'SI Derived', quantity: 'specific heat capacity' },
  { symbol: 'kg/m³', name: 'kilogram per cubic metre', category: 'SI Derived', quantity: 'density',       aliases: ['kg/m3'] },
  { symbol: 'mol/m³', name: 'mole per cubic metre', category: 'SI Derived', quantity: 'concentration' },

  // ── Imperial ───────────────────────────────────────────────────────────────
  { symbol: 'ft',   name: 'foot',               category: 'Imperial',   quantity: 'length',                aliases: ['feet', 'feet'] },
  { symbol: 'in',   name: 'inch',               category: 'Imperial',   quantity: 'length',                aliases: ['inches', '"'] },
  { symbol: 'yd',   name: 'yard',               category: 'Imperial',   quantity: 'length',                aliases: ['yards'] },
  { symbol: 'mi',   name: 'mile',               category: 'Imperial',   quantity: 'length',                aliases: ['miles'] },
  { symbol: 'lb',   name: 'pound',              category: 'Imperial',   quantity: 'mass',                  aliases: ['lbs', 'pounds', 'pound-mass', 'lbm'] },
  { symbol: 'oz',   name: 'ounce',              category: 'Imperial',   quantity: 'mass',                  aliases: ['ounces'] },
  { symbol: 'ton',  name: 'short ton',          category: 'Imperial',   quantity: 'mass',                  aliases: ['US ton'] },
  { symbol: 'lbf',  name: 'pound-force',        category: 'Imperial',   quantity: 'force',                 siBreakdown: '4.448 N',      aliases: ['pound force'] },
  { symbol: '°F',   name: 'degree Fahrenheit',  category: 'Imperial',   quantity: 'temperature',           aliases: ['fahrenheit', 'degF', 'deg F'] },
  { symbol: '°R',   name: 'degree Rankine',     category: 'Imperial',   quantity: 'temperature',           aliases: ['rankine'] },
  { symbol: 'psi',  name: 'pound per square inch', category: 'Imperial', quantity: 'pressure',             siBreakdown: '6894.76 Pa',   aliases: ['lb/in²', 'lb/in2'] },
  { symbol: 'ksi',  name: 'kilopound per square inch', category: 'Imperial', quantity: 'pressure',         siBreakdown: '6.895 MPa' },
  { symbol: 'psf',  name: 'pound per square foot', category: 'Imperial', quantity: 'pressure',             siBreakdown: '47.88 Pa' },
  { symbol: 'BTU',  name: 'British thermal unit', category: 'Imperial', quantity: 'energy',                siBreakdown: '1055.06 J',    aliases: ['Btu'] },
  { symbol: 'BTU/h', name: 'BTU per hour',      category: 'Imperial',   quantity: 'power',                 siBreakdown: '0.2931 W' },
  { symbol: 'hp',   name: 'horsepower',         category: 'Imperial',   quantity: 'power',                 siBreakdown: '745.7 W',      aliases: ['HP', 'bhp'] },
  { symbol: 'ft·lbf', name: 'foot pound-force', category: 'Imperial',  quantity: 'torque',                siBreakdown: '1.356 Nm',     aliases: ['ft-lbf', 'ft.lbf', 'ft lb'] },
  { symbol: 'in·lbf', name: 'inch pound-force', category: 'Imperial',  quantity: 'torque',                siBreakdown: '0.113 Nm',     aliases: ['in-lbf'] },
  { symbol: 'ft/s', name: 'foot per second',    category: 'Imperial',   quantity: 'speed',                 siBreakdown: '0.3048 m·s⁻¹', aliases: ['fps'] },
  { symbol: 'mph',  name: 'mile per hour',      category: 'Imperial',   quantity: 'speed',                 siBreakdown: '0.4470 m·s⁻¹' },
  { symbol: 'kn',   name: 'knot',               category: 'Imperial',   quantity: 'speed',                 siBreakdown: '0.5144 m·s⁻¹', aliases: ['kt', 'knots'] },
  { symbol: 'ft/s²', name: 'foot per second squared', category: 'Imperial', quantity: 'acceleration',      siBreakdown: '0.3048 m·s⁻²' },
  { symbol: 'lb/ft³', name: 'pound per cubic foot', category: 'Imperial', quantity: 'density',             siBreakdown: '16.018 kg/m³', aliases: ['lb/ft3'] },
  { symbol: 'gal',  name: 'US gallon',          category: 'Imperial',   quantity: 'volume',                siBreakdown: '3.785 L',      aliases: ['US gal'] },
  { symbol: 'fl oz', name: 'fluid ounce',       category: 'Imperial',   quantity: 'volume' },

  // ── Common Engineering ─────────────────────────────────────────────────────
  { symbol: 'rpm',  name: 'revolutions per minute', category: 'Common', quantity: 'rotational speed',     aliases: ['RPM', 'rev/min'] },
  { symbol: 'rps',  name: 'revolutions per second', category: 'Common', quantity: 'rotational speed',     aliases: ['rev/s'] },
  { symbol: 'bar',  name: 'bar',                category: 'Common',     quantity: 'pressure',              siBreakdown: '100000 Pa',    aliases: ['bars'] },
  { symbol: 'mbar', name: 'millibar',           category: 'Common',     quantity: 'pressure',              siBreakdown: '100 Pa' },
  { symbol: 'atm',  name: 'atmosphere',         category: 'Common',     quantity: 'pressure',              siBreakdown: '101325 Pa',    aliases: ['atmospheres'] },
  { symbol: 'Torr', name: 'torr',               category: 'Common',     quantity: 'pressure',              siBreakdown: '133.322 Pa' },
  { symbol: 'mmHg', name: 'millimetre of mercury', category: 'Common',  quantity: 'pressure',              siBreakdown: '133.322 Pa' },
  { symbol: 'dB',   name: 'decibel',            category: 'Common',     quantity: 'level (logarithmic)',   aliases: ['dBm', 'decibels'] },
  { symbol: 'dBm',  name: 'decibel-milliwatt',  category: 'Common',     quantity: 'power level' },
  { symbol: '%',    name: 'percent',            category: 'Common',     quantity: 'ratio',                 aliases: ['pct', 'per cent'] },
  { symbol: 'ppm',  name: 'parts per million',  category: 'Common',     quantity: 'concentration' },
  { symbol: 'ppb',  name: 'parts per billion',  category: 'Common',     quantity: 'concentration' },
  { symbol: '°',    name: 'degree (angle)',      category: 'Common',     quantity: 'angle',                 aliases: ['deg', 'degrees'] },
  { symbol: 'L',    name: 'litre',              category: 'Common',     quantity: 'volume',                siBreakdown: '0.001 m³',     aliases: ['liter', 'liters', 'litres'] },
  { symbol: 'mL',   name: 'millilitre',         category: 'Common',     quantity: 'volume',                siBreakdown: '0.000001 m³',  aliases: ['mL', 'ml', 'milliliter'] },
  { symbol: 'L/min', name: 'litre per minute',  category: 'Common',     quantity: 'flow rate' },
  { symbol: 'g',    name: 'standard gravity',   category: 'Common',     quantity: 'acceleration',          siBreakdown: '9.80665 m·s⁻²', aliases: ['G', 'g-force'] },
  { symbol: 'W·h',  name: 'watt-hour',          category: 'Common',     quantity: 'energy',                siBreakdown: '3600 J',       aliases: ['Wh'] },
  { symbol: 'kW·h', name: 'kilowatt-hour',      category: 'Common',     quantity: 'energy',                siBreakdown: '3.6 MJ',       aliases: ['kWh', 'kW·h'] },
  { symbol: 'Ah',   name: 'ampere-hour',        category: 'Common',     quantity: 'electric charge',       siBreakdown: '3600 C',       aliases: ['A·h'] },
  { symbol: 'mAh',  name: 'milliampere-hour',   category: 'Common',     quantity: 'electric charge',       aliases: ['mA·h'] },
  { symbol: 'cycles', name: 'cycles',           category: 'Common',     quantity: 'count' },
  { symbol: 'counts', name: 'counts (ADC)',     category: 'Common',     quantity: 'digital quantity' },
  { symbol: 'LSB',  name: 'least significant bit', category: 'Common',  quantity: 'digital resolution' },

  // ── Special / Dimensionless ────────────────────────────────────────────────
  { symbol: '-',    name: 'dimensionless',      category: 'Special',    quantity: 'none',                  aliases: ['none', 'n/a', 'unitless'] },
  { symbol: '1',    name: 'unity (dimensionless)', category: 'Special', quantity: 'none' },
]

// ── Lookup helpers ────────────────────────────────────────────────────────────

const _symbolMap = new Map<string, UnitDef>()
const _aliasMap  = new Map<string, UnitDef>()

for (const u of ENGINEERING_UNITS) {
  _symbolMap.set(u.symbol.toLowerCase(), u)
  for (const a of (u.aliases ?? [])) {
    _aliasMap.set(a.toLowerCase(), u)
  }
}

export function findUnit(symbol: string): UnitDef | undefined {
  const key = symbol.trim().toLowerCase()
  return _symbolMap.get(key) ?? _aliasMap.get(key)
}

export function isKnownUnit(symbol: string): boolean {
  return findUnit(symbol) !== undefined
}

export function getSIBreakdown(symbol: string): string | null {
  return findUnit(symbol)?.siBreakdown ?? null
}

/** Fuzzy search across symbol, name, quantity, and aliases. */
export function searchUnits(query: string): UnitDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return ENGINEERING_UNITS.slice(0, 20)

  const scored: Array<{ unit: UnitDef; score: number }> = []
  for (const u of ENGINEERING_UNITS) {
    let score = 0
    if (u.symbol.toLowerCase() === q) score = 100
    else if (u.symbol.toLowerCase().startsWith(q)) score = 80
    else if (u.name.toLowerCase().startsWith(q)) score = 70
    else if (u.symbol.toLowerCase().includes(q)) score = 50
    else if (u.name.toLowerCase().includes(q)) score = 40
    else if (u.quantity.toLowerCase().includes(q)) score = 20
    else if (u.aliases?.some(a => a.toLowerCase().includes(q))) score = 35
    if (score > 0) scored.push({ unit: u, score })
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(x => x.unit)
}

/** For a typed unit that is not in the standard list, suggest the closest match. */
export function suggestUnit(input: string): UnitDef | null {
  const q = input.trim().toLowerCase()
  if (!q || isKnownUnit(input)) return null
  // Try alias first
  for (const u of ENGINEERING_UNITS) {
    if (u.aliases?.some(a => a.toLowerCase() === q)) return u
    if (u.name.toLowerCase() === q) return u
  }
  // Partial name match
  for (const u of ENGINEERING_UNITS) {
    if (u.name.toLowerCase().startsWith(q) || q.startsWith(u.name.toLowerCase())) return u
  }
  return null
}
