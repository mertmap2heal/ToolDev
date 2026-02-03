import type { AerospaceIssue } from '../types'

const MOCK_LATENCY_MS = 1500

const assignees = [
  { id: 'u1', name: 'J. Martinez' },
  { id: 'u2', name: 'A. Chen' },
  { id: 'u3', name: 'K. Okafor' },
  { id: 'u4', name: 'S. Patel' },
  { id: 'u5', name: 'M. Eriksson' },
]

const verifiers = [
  { id: 'v1', name: 'R. Foster' },
  { id: 'v2', name: 'L. Yamamoto' },
  { id: 'v3', name: 'T. Kowalski' },
]

function date(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

export const MOCK_ISSUES: AerospaceIssue[] = [
  {
    id: 'ISS-001',
    title: 'Avionics Bus arbitration timeout under high load',
    description:
      'Under peak CAN traffic, the avionics bus arbitration fails to resolve within the specified 2 ms window, causing sporadic frame loss on the primary channel.',
    severity: 'Critical',
    status: 'Analysis',
    dal: 'A',
    affectedPartNumber: 'AVN-BUS-001',
    rootCauseAnalysis: 'Under investigation. Suspected priority inversion in RTOS task scheduling.',
    containmentActions: 'Temporary workaround: reduced bus utilization to 70% cap on non-critical traffic.',
    assignee: assignees[0],
    verifier: verifiers[0],
    traceabilityLinks: [
      { id: 'tl1', type: 'Requirement', url: '#/req/SYS-101', label: 'SYS-101 Bus timing' },
      { id: 'tl2', type: 'TestCase', url: '#/test/TC-AVN-042', label: 'TC-AVN-042 Stress test' },
    ],
    createdAt: date(12),
    updatedAt: date(1),
  },
  {
    id: 'ISS-002',
    title: 'Hydraulic actuator position feedback drift in cold soak',
    description:
      'After extended cold soak at -40°C, the LVDT-derived position feedback shows up to 2% full-scale drift until thermal equilibrium.',
    severity: 'High',
    status: 'Containment',
    dal: 'B',
    affectedPartNumber: 'HYD-ACT-02',
    rootCauseAnalysis: 'LVDT excitation cable impedance shift at low temperature; compensation table incomplete.',
    containmentActions: 'Extended warm-up sequence added; calibration run required after cold soak.',
    assignee: assignees[1],
    verifier: verifiers[1],
    traceabilityLinks: [
      { id: 'tl3', type: 'Requirement', url: '#/req/HYD-205', label: 'HYD-205 Accuracy' },
    ],
    createdAt: date(25),
    updatedAt: date(3),
  },
  {
    id: 'ISS-003',
    title: 'Telemetry overflow in downlink buffer during burst mode',
    description:
      'During high-rate telemetry burst (100 Hz), the downlink buffer overflows and drops packets. No loss indication to operator.',
    severity: 'High',
    status: 'InWork',
    dal: 'B',
    affectedPartNumber: 'TLM-DL-001',
    rootCauseAnalysis: 'Buffer sized for nominal rate only; burst mode not included in sizing analysis.',
    containmentActions: 'Rate limiter enabled in software; hardware buffer increase in next build.',
    assignee: assignees[2],
    verifier: verifiers[2],
    traceabilityLinks: [
      { id: 'tl4', type: 'Requirement', url: '#/req/TLM-110', label: 'TLM-110 No data loss' },
      { id: 'tl5', type: 'TestCase', url: '#/test/TC-TLM-018', label: 'TC-TLM-018 Burst test' },
    ],
    createdAt: date(8),
    updatedAt: date(0),
  },
  {
    id: 'ISS-004',
    title: 'FCS channel A/B cross-strapping fault detection delay',
    description:
      'Fault in primary channel is detected with up to 50 ms delay before failover to backup; spec requires < 20 ms.',
    severity: 'Critical',
    status: 'Open',
    dal: 'A',
    affectedPartNumber: 'FCS-CH-A',
    rootCauseAnalysis: 'Watchdog and BITE polling interval too coarse.',
    containmentActions: 'None yet; issue just opened.',
    assignee: assignees[0],
    verifier: verifiers[0],
    traceabilityLinks: [],
    createdAt: date(2),
    updatedAt: date(2),
  },
  {
    id: 'ISS-005',
    title: 'LRU power-on self-test false positive on EMI event',
    description:
      'POST reports failure on occasion when LRU is powered in high EMI environment; retest passes.',
    severity: 'Medium',
    status: 'Verification',
    dal: 'C',
    affectedPartNumber: 'LRU-PWR-03',
    rootCauseAnalysis: 'Threshold for POST voltage check too tight; margin added in firmware.',
    containmentActions: 'Revised thresholds deployed; regression testing in progress.',
    assignee: assignees[3],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl6', type: 'Requirement', url: '#/req/PWR-301', label: 'PWR-301 POST' },
      { id: 'tl7', type: 'TestCase', url: '#/test/TC-EMI-005', label: 'TC-EMI-005 POST under EMI' },
    ],
    createdAt: date(45),
    updatedAt: date(5),
  },
  {
    id: 'ISS-006',
    title: 'Incorrect pitot-static port heating schedule at altitude',
    description:
      'Heating schedule does not account for rapid climb profile; risk of icing in transition band.',
    severity: 'High',
    status: 'Analysis',
    dal: 'B',
    affectedPartNumber: 'PITOT-HEAT-01',
    rootCauseAnalysis: 'Look-up table uses static altitude only; time-in-band not considered.',
    containmentActions: 'Conservative early-on schedule applied until table update.',
    assignee: assignees[1],
    verifier: verifiers[1],
    traceabilityLinks: [
      { id: 'tl8', type: 'Requirement', url: '#/req/ENV-401', label: 'ENV-401 Anti-ice' },
    ],
    createdAt: date(18),
    updatedAt: date(4),
  },
  {
    id: 'ISS-007',
    title: 'Fuel quantity indication jump during pump switchover',
    description:
      'During transfer pump switchover, FQI briefly shows 5% drop then recovers; no actual fuel loss.',
    severity: 'Medium',
    status: 'Closed',
    dal: 'C',
    affectedPartNumber: 'FQI-SNS-02',
    rootCauseAnalysis: 'Filter on FQI input had too short time constant; increased to smooth transient.',
    containmentActions: 'Software filter update released and verified in rig.',
    assignee: assignees[4],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl9', type: 'Requirement', url: '#/req/Fuel-202', label: 'Fuel-202 FQI accuracy' },
      { id: 'tl10', type: 'TestCase', url: '#/test/TC-Fuel-033', label: 'TC-Fuel-033 Switchover' },
    ],
    createdAt: date(60),
    updatedAt: date(15),
  },
  {
    id: 'ISS-008',
    title: 'Landing gear uplock microswitch intermittent at vibration',
    description:
      'During vibration test, uplock "locked" signal flickers; could affect gear logic on ground.',
    severity: 'High',
    status: 'Containment',
    dal: 'B',
    affectedPartNumber: 'LG-UPLK-SW',
    rootCauseAnalysis: 'Microswitch mounting resonance; damping and stiffer bracket in design.',
    containmentActions: 'Manual confirmation procedure added in checklist pending hardware fix.',
    assignee: assignees[2],
    verifier: verifiers[2],
    traceabilityLinks: [
      { id: 'tl11', type: 'Requirement', url: '#/req/LG-101', label: 'LG-101 Lock indication' },
    ],
    createdAt: date(22),
    updatedAt: date(2),
  },
  {
    id: 'ISS-009',
    title: 'EFB wireless link drops in dense terminal environment',
    description:
      'Cabin EFB loses connection to server when multiple aircraft on same ramp; WiFi channel congestion.',
    severity: 'Low',
    status: 'InWork',
    dal: 'D',
    affectedPartNumber: 'EFB-WIFI-01',
    rootCauseAnalysis: 'Single-channel design; no DFS or channel agility.',
    containmentActions: 'Software update to support channel selection; ops bulletin to avoid dense areas for critical ops.',
    assignee: assignees[3],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl12', type: 'Requirement', url: '#/req/CAB-501', label: 'CAB-501 Connectivity' },
    ],
    createdAt: date(10),
    updatedAt: date(1),
  },
  {
    id: 'ISS-010',
    title: 'Engine vibration monitor false alarm on reverse thrust',
    description:
      'EVMS triggers caution during reverse thrust application; vibration within limits but algorithm sensitive to transient.',
    severity: 'Medium',
    status: 'Verification',
    dal: 'C',
    affectedPartNumber: 'EVMS-001',
    rootCauseAnalysis: 'Time window for alarm too short; extended to cover reverse thrust transient.',
    containmentActions: 'Algorithm update in test; no operational impact as alarm is caution only.',
    assignee: assignees[0],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl13', type: 'Requirement', url: '#/req/ENG-VIB-01', label: 'ENG-VIB-01 EVMS' },
      { id: 'tl14', type: 'TestCase', url: '#/test/TC-ENG-112', label: 'TC-ENG-112 Reverse thrust' },
    ],
    createdAt: date(30),
    updatedAt: date(7),
  },
  {
    id: 'ISS-011',
    title: 'APU bleed air valve slow to close on shutdown',
    description:
      'Valve closes in 8 s vs 5 s required; may affect start sequence if APU restarted quickly.',
    severity: 'Medium',
    status: 'Analysis',
    dal: 'C',
    affectedPartNumber: 'APU-BLEED-VLV',
    rootCauseAnalysis: 'Actuator spring rate and orifice sizing under review.',
    containmentActions: 'Procedure update: minimum 30 s between APU shutdown and restart.',
    assignee: assignees[1],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl15', type: 'Requirement', url: '#/req/APU-302', label: 'APU-302 Valve timing' },
    ],
    createdAt: date(14),
    updatedAt: date(6),
  },
  {
    id: 'ISS-012',
    title: 'TCAS resolution advisory late in high closure rate scenario',
    description:
      'In simulation, RA issued 2 s later than required in 500 kt closure head-on case.',
    severity: 'Critical',
    status: 'Open',
    dal: 'A',
    affectedPartNumber: 'TCAS-PROC-01',
    rootCauseAnalysis: 'Trajectory prediction model and update rate being re-evaluated.',
    containmentActions: 'None; under investigation.',
    assignee: assignees[0],
    verifier: verifiers[0],
    traceabilityLinks: [],
    createdAt: date(5),
    updatedAt: date(5),
  },
  {
    id: 'ISS-013',
    title: 'Cabin pressure outflow valve hysteresis in descent',
    description:
      'During rapid descent, cabin rate of climb lags schedule by 50 ft/min for ~2 min.',
    severity: 'Low',
    status: 'Closed',
    dal: 'D',
    affectedPartNumber: 'CPCV-001',
    rootCauseAnalysis: 'Valve hysteresis and controller gain tuned for climb; descent gain increased.',
    containmentActions: 'Software release with updated gains; flight test approved.',
    assignee: assignees[4],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl16', type: 'Requirement', url: '#/req/CAB-201', label: 'CAB-201 Pressurization' },
      { id: 'tl17', type: 'TestCase', url: '#/test/TC-CAB-041', label: 'TC-CAB-041 Descent profile' },
    ],
    createdAt: date(55),
    updatedAt: date(20),
  },
  {
    id: 'ISS-014',
    title: 'Flap asymmetry detection threshold too sensitive',
    description:
      'System triggers asymmetry warning in crosswind takeoff when asymmetry within limits.',
    severity: 'Medium',
    status: 'InWork',
    dal: 'C',
    affectedPartNumber: 'FLAP-ASYM-01',
    rootCauseAnalysis: 'Threshold set to 1°; wind and flex can cause 0.8° differential.',
    containmentActions: 'Threshold relaxed to 1.5° with justification; testing in progress.',
    assignee: assignees[2],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl18', type: 'Requirement', url: '#/req/FCS-405', label: 'FCS-405 Asymmetry' },
    ],
    createdAt: date(9),
    updatedAt: date(2),
  },
  {
    id: 'ISS-015',
    title: 'GPS primary loss does not trigger timely reversion to IRS',
    description:
      'When GPS is lost, system continues to use last position for 10 s before declaring dead reckoning.',
    severity: 'High',
    status: 'Containment',
    dal: 'B',
    affectedPartNumber: 'NAV-FMS-01',
    rootCauseAnalysis: 'Integrity monitoring timeout too long; reduced to 3 s per spec.',
    containmentActions: 'Patch deployed to test fleet; validation ongoing.',
    assignee: assignees[1],
    verifier: verifiers[1],
    traceabilityLinks: [
      { id: 'tl19', type: 'Requirement', url: '#/req/NAV-101', label: 'NAV-101 Reversion' },
      { id: 'tl20', type: 'TestCase', url: '#/test/TC-NAV-055', label: 'TC-NAV-055 GPS loss' },
    ],
    createdAt: date(20),
    updatedAt: date(4),
  },
  {
    id: 'ISS-016',
    title: 'Stall warning stick shaker activation in turbulence',
    description:
      'In severe turbulence, stick shaker activates briefly; may confuse pilot; no stall condition.',
    severity: 'Medium',
    status: 'Verification',
    dal: 'C',
    affectedPartNumber: 'SW-ACT-01',
    rootCauseAnalysis: 'Alpha filter time constant shortened to reduce nuisance; margin re-checked.',
    containmentActions: 'Update in final testing; crew training note issued.',
    assignee: assignees[3],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl21', type: 'Requirement', url: '#/req/STALL-01', label: 'STALL-01 Warning' },
      { id: 'tl22', type: 'TestCase', url: '#/test/TC-STALL-012', label: 'TC-STALL-012 Turbulence' },
    ],
    createdAt: date(35),
    updatedAt: date(8),
  },
  {
    id: 'ISS-017',
    title: 'Fire detection loop A fault in wet bay',
    description:
      'False fire warning in wheel well after heavy rain; moisture ingress into connector.',
    severity: 'High',
    status: 'Analysis',
    dal: 'B',
    affectedPartNumber: 'FIRE-DET-LA',
    rootCauseAnalysis: 'Connector sealing and drainage under review; possible design change.',
    containmentActions: 'Temporary sealant and inspection interval shortened.',
    assignee: assignees[0],
    verifier: verifiers[2],
    traceabilityLinks: [
      { id: 'tl23', type: 'Requirement', url: '#/req/FIRE-101', label: 'FIRE-101 Detection' },
    ],
    createdAt: date(11),
    updatedAt: date(3),
  },
  {
    id: 'ISS-018',
    title: 'Oxygen mask deployment delay in rapid decompression',
    description:
      'Masks deploy in 8 s; certification basis requires 5 s for the affected zone.',
    severity: 'Critical',
    status: 'Open',
    dal: 'A',
    affectedPartNumber: 'O2-MASK-SYS',
    rootCauseAnalysis: 'Solenoid and duct routing being analyzed for pressure drop and flow.',
    containmentActions: 'None; early in investigation.',
    assignee: assignees[2],
    verifier: verifiers[0],
    traceabilityLinks: [],
    createdAt: date(1),
    updatedAt: date(1),
  },
  {
    id: 'ISS-019',
    title: 'Radar altimeter multipath in ground effect',
    description:
      'RA shows 5 ft offset when over smooth water or flat pavement at low height.',
    severity: 'Low',
    status: 'Closed',
    dal: 'E',
    affectedPartNumber: 'RA-001',
    rootCauseAnalysis: 'Known multipath; documented in AFM; no software change required.',
    containmentActions: 'AFM limitation and pilot training material updated.',
    assignee: assignees[4],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl24', type: 'Requirement', url: '#/req/RA-101', label: 'RA-101 Accuracy' },
    ],
    createdAt: date(90),
    updatedAt: date(30),
  },
  {
    id: 'ISS-020',
    title: 'Brake temperature display lag after landing',
    description:
      'Brake temp takes 2 min to update after landing; pilot may taxi before seeing peak.',
    severity: 'Low',
    status: 'InWork',
    dal: 'D',
    affectedPartNumber: 'BRK-TEMP-DSP',
    rootCauseAnalysis: 'Thermal mass and sampling rate; algorithm update to extrapolate.',
    containmentActions: 'Display now shows "cooling" and last known peak until update.',
    assignee: assignees[3],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl25', type: 'Requirement', url: '#/req/BRAKE-401', label: 'BRAKE-401 Temp display' },
    ],
    createdAt: date(7),
    updatedAt: date(0),
  },
  {
    id: 'ISS-021',
    title: 'IDG over-temperature warning threshold exceeded in climb',
    description:
      'In hot day climb at MTOW, IDG temp exceeds yellow band briefly; no damage, but warning annoys crew.',
    severity: 'Medium',
    status: 'Analysis',
    dal: 'C',
    affectedPartNumber: 'IDG-COOL-01',
    rootCauseAnalysis: 'Thermal model and margin being revalidated; possible threshold adjustment.',
    containmentActions: 'Ops bulletin: normal for certain conditions; avoid prolonged max climb in hot day.',
    assignee: assignees[1],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl26', type: 'Requirement', url: '#/req/PWR-501', label: 'PWR-501 IDG limits' },
    ],
    createdAt: date(16),
    updatedAt: date(5),
  },
  {
    id: 'ISS-022',
    title: 'Rudder travel limit unit calibration drift',
    description:
      'RTU requires recalibration every 500 h; spec allows 1000 h.',
    severity: 'Medium',
    status: 'Verification',
    dal: 'C',
    affectedPartNumber: 'RTU-001',
    rootCauseAnalysis: 'Potentiometer wear; new supplier with higher life selected.',
    containmentActions: 'Interim: 500 h interval in maintenance program until new part qualified.',
    assignee: assignees[0],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl27', type: 'Requirement', url: '#/req/FCS-201', label: 'FCS-201 RTU' },
      { id: 'tl28', type: 'TestCase', url: '#/test/TC-RTU-003', label: 'TC-RTU-003 Calibration' },
    ],
    createdAt: date(40),
    updatedAt: date(10),
  },
  {
    id: 'ISS-023',
    title: 'Cargo fire suppression bottle pressure decay',
    description:
      'Two bottles found below minimum pressure at C-check; no discharge event.',
    severity: 'High',
    status: 'Containment',
    dal: 'B',
    affectedPartNumber: 'CARGO-HALON-01',
    rootCauseAnalysis: 'Valve seat leakage; batch of seals under review.',
    containmentActions: 'One-time inspection of all bottles; seal lot tracking implemented.',
    assignee: assignees[2],
    verifier: verifiers[1],
    traceabilityLinks: [
      { id: 'tl29', type: 'Requirement', url: '#/req/CARGO-301', label: 'CARGO-301 Suppression' },
    ],
    createdAt: date(19),
    updatedAt: date(2),
  },
  {
    id: 'ISS-024',
    title: 'HUD symbology jitter in turbulence',
    description:
      'HUD horizon line and airspeed jitter in light turbulence; no safety impact but distracting.',
    severity: 'Low',
    status: 'InWork',
    dal: 'D',
    affectedPartNumber: 'HUD-DSP-01',
    rootCauseAnalysis: 'Filtering of attitude and airspeed for display; smoothing algorithm in development.',
    containmentActions: 'None; cosmetic only; fix in next avionics drop.',
    assignee: assignees[4],
    verifier: null,
    traceabilityLinks: [
      { id: 'tl30', type: 'Requirement', url: '#/req/DISPLAY-101', label: 'DISPLAY-101 HUD' },
    ],
    createdAt: date(6),
    updatedAt: date(1),
  },
  {
    id: 'ISS-025',
    title: 'Windshear warning inhibit logic on contaminated runway',
    description:
      'When runway contamination is selected, windshear warning is inhibited on approach; concern from safety review.',
    severity: 'High',
    status: 'Analysis',
    dal: 'B',
    affectedPartNumber: 'WX-WS-01',
    rootCauseAnalysis: 'Original logic assumed contaminated = low speed; re-evaluating per new ops spec.',
    containmentActions: 'Inhibit removed in test build; validation in progress.',
    assignee: assignees[0],
    verifier: verifiers[2],
    traceabilityLinks: [
      { id: 'tl31', type: 'Requirement', url: '#/req/WX-201', label: 'WX-201 Windshear' },
    ],
    createdAt: date(13),
    updatedAt: date(4),
  },
]

export function fetchIssues(): Promise<AerospaceIssue[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve([...MOCK_ISSUES]), MOCK_LATENCY_MS)
  })
}

export function fetchIssueById(id: string): Promise<AerospaceIssue | null> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const issue = MOCK_ISSUES.find((i) => i.id === id) ?? null
      resolve(issue ? { ...issue } : null)
    }, MOCK_LATENCY_MS)
  })
}
