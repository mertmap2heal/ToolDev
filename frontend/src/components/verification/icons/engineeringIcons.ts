// Engineering icon SVG definitions
// These are used when Lucide icons are not available

export const engineeringIcons = {
  // Electrical Symbols
  ground: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="2" x2="12" y2="10"/>
    <line x1="6" y1="10" x2="18" y2="10"/>
    <line x1="8" y1="14" x2="16" y2="14"/>
    <line x1="10" y1="18" x2="14" y2="18"/>
  </svg>`,

  switch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="6" cy="12" r="2"/>
    <circle cx="18" cy="12" r="2"/>
    <line x1="8" y1="12" x2="16" y2="6"/>
  </svg>`,

  fuse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="8" width="16" height="8" rx="1"/>
    <line x1="12" y1="8" x2="12" y2="16"/>
  </svg>`,

  resistor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="6" y2="12"/>
    <polyline points="6,12 7,8 9,16 11,8 13,16 15,8 17,16 18,12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
  </svg>`,

  capacitor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="10" y2="12"/>
    <line x1="10" y1="6" x2="10" y2="18"/>
    <line x1="14" y1="6" x2="14" y2="18"/>
    <line x1="14" y1="12" x2="22" y2="12"/>
  </svg>`,

  inductor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="5" y2="12"/>
    <path d="M5,12 Q7,6 9,12 Q11,18 13,12 Q15,6 17,12 Q19,18 19,12"/>
    <line x1="19" y1="12" x2="22" y2="12"/>
  </svg>`,

  diode: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="8" y2="12"/>
    <polygon points="8,6 16,12 8,18" fill="none"/>
    <line x1="16" y1="6" x2="16" y2="18"/>
    <line x1="16" y1="12" x2="22" y2="12"/>
  </svg>`,

  transistor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="8" y2="12"/>
    <line x1="8" y1="6" x2="8" y2="18"/>
    <line x1="8" y1="8" x2="16" y2="4"/>
    <line x1="8" y1="16" x2="16" y2="20"/>
    <line x1="16" y1="4" x2="16" y2="2"/>
    <line x1="16" y1="20" x2="16" y2="22"/>
  </svg>`,

  // Sensor Symbols
  strainGauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M8,8 L8,16 L10,16 L10,8 L12,8 L12,16 L14,16 L14,8 L16,8"/>
  </svg>`,

  voltageSensor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">V</text>
  </svg>`,

  currentSensor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">A</text>
  </svg>`,

  flowSensor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <path d="M8,12 L16,12 M14,9 L16,12 L14,15"/>
  </svg>`,

  // Connector Symbols
  plug: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="8" y="2" width="8" height="12" rx="1"/>
    <line x1="10" y1="14" x2="10" y2="18"/>
    <line x1="14" y1="14" x2="14" y2="18"/>
    <line x1="6" y1="18" x2="18" y2="18"/>
    <line x1="6" y1="18" x2="6" y2="22"/>
    <line x1="18" y1="18" x2="18" y2="22"/>
  </svg>`,

  terminalBlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="6" width="16" height="12" rx="1"/>
    <line x1="8" y1="6" x2="8" y2="2"/>
    <line x1="12" y1="6" x2="12" y2="2"/>
    <line x1="16" y1="6" x2="16" y2="2"/>
    <line x1="8" y1="18" x2="8" y2="22"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="16" y1="18" x2="16" y2="22"/>
  </svg>`,

  bus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="12" x2="20" y2="12" stroke-width="4"/>
    <line x1="6" y1="12" x2="6" y2="6"/>
    <line x1="10" y1="12" x2="10" y2="6"/>
    <line x1="14" y1="12" x2="14" y2="6"/>
    <line x1="18" y1="12" x2="18" y2="6"/>
  </svg>`,

  dbConnector: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6,4 L18,4 L20,8 L20,16 L18,20 L6,20 L4,16 L4,8 Z"/>
    <circle cx="8" cy="9" r="1" fill="currentColor"/>
    <circle cx="12" cy="9" r="1" fill="currentColor"/>
    <circle cx="16" cy="9" r="1" fill="currentColor"/>
    <circle cx="10" cy="15" r="1" fill="currentColor"/>
    <circle cx="14" cy="15" r="1" fill="currentColor"/>
  </svg>`,

  // Equipment Symbols
  oscilloscope: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="4" width="20" height="14" rx="2"/>
    <path d="M5,14 L8,8 L11,14 L14,6 L17,14 L19,10"/>
    <line x1="6" y1="20" x2="6" y2="22"/>
    <line x1="18" y1="20" x2="18" y2="22"/>
  </svg>`,

  plc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <rect x="6" y="4" width="12" height="6" rx="1"/>
    <circle cx="8" cy="14" r="1" fill="currentColor"/>
    <circle cx="12" cy="14" r="1" fill="currentColor"/>
    <circle cx="16" cy="14" r="1" fill="currentColor"/>
    <circle cx="8" cy="18" r="1" fill="currentColor"/>
    <circle cx="12" cy="18" r="1" fill="currentColor"/>
    <circle cx="16" cy="18" r="1" fill="currentColor"/>
  </svg>`,

  signalGenerator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="6" width="20" height="12" rx="2"/>
    <path d="M6,12 Q8,6 10,12 Q12,18 14,12 Q16,6 18,12"/>
  </svg>`,

  powerUnit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <line x1="8" y1="8" x2="16" y2="8"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
    <line x1="8" y1="16" x2="12" y2="16"/>
  </svg>`,

  // Mechanical Symbols
  motor: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="4" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="20"/>
    <line x1="4" y1="12" x2="2" y2="12"/>
  </svg>`,

  actuator: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="4" y="8" width="10" height="8" rx="1"/>
    <line x1="14" y1="12" x2="22" y2="12"/>
    <polygon points="20,10 22,12 20,14" fill="currentColor"/>
  </svg>`,

  valve: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="8" y2="12"/>
    <polygon points="8,8 16,12 8,16" fill="none"/>
    <polygon points="16,8 8,12 16,16" fill="none"/>
    <line x1="16" y1="12" x2="22" y2="12"/>
  </svg>`,

  pump: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <path d="M12,4 L12,8 M8,6 L12,8 L16,6"/>
    <line x1="4" y1="12" x2="2" y2="12"/>
    <line x1="20" y1="12" x2="22" y2="12"/>
  </svg>`,

  cylinder: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="6" y="4" width="12" height="16" rx="1"/>
    <line x1="6" y1="10" x2="18" y2="10"/>
    <line x1="2" y1="7" x2="6" y2="7"/>
  </svg>`,

  bearing: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
  </svg>`,

  // Piping & Instrumentation
  checkValve: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="8" y2="12"/>
    <polygon points="8,6 16,12 8,18" fill="none"/>
    <line x1="16" y1="6" x2="16" y2="18"/>
    <line x1="16" y1="12" x2="22" y2="12"/>
  </svg>`,

  manualValve: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="2" y1="12" x2="8" y2="12"/>
    <polygon points="8,6 16,12 8,18" fill="none"/>
    <polygon points="16,6 8,12 16,18" fill="none"/>
    <line x1="16" y1="12" x2="22" y2="12"/>
    <line x1="12" y1="6" x2="12" y2="2"/>
    <circle cx="12" cy="2" r="1.5"/>
  </svg>`,

  heatExchanger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="8"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="12" y1="4" x2="12" y2="8"/>
    <line x1="12" y1="16" x2="12" y2="20"/>
  </svg>`,

  tank: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6,4 L18,4 L18,18 Q18,20 12,20 Q6,20 6,18 Z"/>
    <ellipse cx="12" cy="4" rx="6" ry="2"/>
    <line x1="4" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="20" y2="12"/>
  </svg>`,

  filter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="4,4 20,4 14,14 14,20 10,22 10,14"/>
    <line x1="8" y1="8" x2="16" y2="8"/>
    <line x1="9" y1="11" x2="15" y2="11"/>
  </svg>`,
}

export default engineeringIcons
