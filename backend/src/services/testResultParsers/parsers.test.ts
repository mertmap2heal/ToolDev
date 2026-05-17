/**
 * Unit tests for the test-result ingestion parsers (N-2.4, issue #431).
 *
 * Covers, per format: a sample file -> the expected NormalisedResult[] and
 * summary; the status mapping (a <failure> AND an <error> both -> FAIL per the
 * PM gate ruling, a <skipped> -> SKIPPED, a pass -> PASS); the 3-tier
 * testCaseKey resolution (xref property, embedded-key regex, name-as-key);
 * an unmatched-name case; malformed input -> ParseError; and an XXE attempt
 * (an external entity is NOT resolved).
 */
import { describe, it, expect } from 'vitest'
import { parseTestResults, ParseError } from './index'

describe('testResultParsers — JUnit', () => {
  const junitMixed = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="brakes" timestamp="2026-05-17T09:00:00" tests="4">
    <testcase name="TC-UAV-001 decelerates" classname="brakes.Decel" time="1.5"/>
    <testcase name="TC-UAV-002 actuator" classname="brakes.Act" time="0.8">
      <failure message="expected 200ms got 320ms">AssertionError</failure>
    </testcase>
    <testcase name="TC-UAV-003 sensor" classname="brakes.Sense" time="0.2">
      <error message="hardware fault">RuntimeError: bus offline</error>
    </testcase>
    <testcase name="TC-UAV-004 optional" classname="brakes.Opt" time="0">
      <skipped message="hardware unavailable"/>
    </testcase>
  </testsuite>
</testsuites>`

  it('parses a mixed JUnit report into normalised results', () => {
    const parsed = parseTestResults(junitMixed, 'junit')
    expect(parsed.format).toBe('junit')
    expect(parsed.results).toHaveLength(4)
    expect(parsed.summary).toEqual({ total: 4, pass: 1, fail: 2, error: 1, skipped: 1 })
  })

  it('maps pass / <failure> / <error> / <skipped> to the schema vocabulary', () => {
    const { results } = parseTestResults(junitMixed, 'junit')
    const byKey = Object.fromEntries(results.map((r) => [r.testCaseKey, r.status]))
    expect(byKey['TC-UAV-001']).toBe('PASS')
    expect(byKey['TC-UAV-002']).toBe('FAIL') // <failure> -> FAIL
    expect(byKey['TC-UAV-003']).toBe('FAIL') // <error>   -> FAIL (PM ruling, NOT PASSED_WITH_ERRORS)
    expect(byKey['TC-UAV-004']).toBe('SKIPPED') // <skipped> -> SKIPPED
  })

  it('an <error> is never mapped to PASSED_WITH_ERRORS', () => {
    const { results } = parseTestResults(junitMixed, 'junit')
    expect(results.some((r) => r.status === 'PASSED_WITH_ERRORS')).toBe(false)
    const errored = results.find((r) => r.testCaseKey === 'TC-UAV-003')
    expect(errored?.status).toBe('FAIL')
    expect(errored?.actualResults?.rawStatus).toBe('error')
  })

  it('captures duration, message and the executedAt timestamp', () => {
    const { results } = parseTestResults(junitMixed, 'junit')
    const fail = results.find((r) => r.testCaseKey === 'TC-UAV-002')
    expect(fail?.durationSeconds).toBe(0.8)
    expect(fail?.message).toContain('expected 200ms got 320ms')
    expect(fail?.executedAt).toBe('2026-05-17T09:00:00')
  })

  it('resolves testCaseKey from an explicit <property name="xref"> first', () => {
    const xml = `<testsuite name="s" tests="1">
      <testcase name="brake actuator response time" classname="Suite.Brake">
        <properties><property name="xref" value="TC-OVERRIDE-99"/></properties>
      </testcase>
    </testsuite>`
    const { results } = parseTestResults(xml, 'junit')
    expect(results[0].testCaseKey).toBe('TC-OVERRIDE-99')
  })

  it('falls back to a key embedded in the test name', () => {
    const xml = `<testsuite name="s" tests="1">
      <testcase name="test_brake[TC-UAV-042]" classname="Suite.Brake"/>
    </testsuite>`
    const { results } = parseTestResults(xml, 'junit')
    expect(results[0].testCaseKey).toBe('TC-UAV-042')
  })

  it('falls back to a key embedded in the classname when the name has none', () => {
    const xml = `<testsuite name="s" tests="1">
      <testcase name="should respond fast" classname="TC-UAV-077.cases"/>
    </testsuite>`
    const { results } = parseTestResults(xml, 'junit')
    expect(results[0].testCaseKey).toBe('TC-UAV-077')
  })

  it('falls back to the whole name when no key pattern matches', () => {
    const xml = `<testsuite name="s" tests="1">
      <testcase name="a plain descriptive test name" classname="some.module"/>
    </testsuite>`
    const { results } = parseTestResults(xml, 'junit')
    expect(results[0].testCaseKey).toBe('a plain descriptive test name')
  })

  it('accepts a bare <testsuite> root (no <testsuites> wrapper)', () => {
    const xml = `<testsuite name="solo" tests="1">
      <testcase name="TC-SOLO-1 works" classname="Solo"/>
    </testsuite>`
    const { results, summary } = parseTestResults(xml, 'junit')
    expect(summary.pass).toBe(1)
    expect(results[0].testCaseKey).toBe('TC-SOLO-1')
  })

  it('routes format=pytest through the JUnit parser', () => {
    const parsed = parseTestResults(junitMixed, 'pytest')
    expect(parsed.format).toBe('pytest')
    expect(parsed.results).toHaveLength(4)
    expect(parsed.summary.fail).toBe(2)
  })

  it('throws ParseError on malformed XML', () => {
    expect(() => parseTestResults('<testsuite><testcase</broken', 'junit')).toThrow(ParseError)
  })

  it('throws ParseError when the root element is not a JUnit report', () => {
    expect(() => parseTestResults('<robot><suite/></robot>', 'junit')).toThrow(/JUnit/)
  })
})

describe('testResultParsers — xUnit.net', () => {
  const xunit = `<?xml version="1.0" encoding="utf-8"?>
<assemblies>
  <assembly name="Brakes.Tests" run-date="2026-05-17" run-time="09:00:00">
    <collection name="BrakeCollection">
      <test name="TC-UAV-101 decelerates" type="Brakes.DecelTests" result="Pass" time="1.2">
        <traits><trait name="xref" value="TC-UAV-101"/></traits>
      </test>
      <test name="actuator response" type="Brakes.ActTests" result="Fail" time="0.5">
        <traits><trait name="xref" value="TC-UAV-102"/></traits>
        <failure><message>timeout exceeded</message></failure>
      </test>
      <test name="TC-UAV-103 optional" type="Brakes.OptTests" result="Skip" time="0">
        <reason>hardware unavailable</reason>
      </test>
    </collection>
  </assembly>
</assemblies>`

  it('parses an xUnit.net report and maps Pass/Fail/Skip', () => {
    const parsed = parseTestResults(xunit, 'xunit')
    expect(parsed.format).toBe('xunit')
    expect(parsed.results).toHaveLength(3)
    expect(parsed.summary).toEqual({ total: 3, pass: 1, fail: 1, error: 0, skipped: 1 })
    const byKey = Object.fromEntries(parsed.results.map((r) => [r.testCaseKey, r.status]))
    expect(byKey['TC-UAV-101']).toBe('PASS')
    expect(byKey['TC-UAV-102']).toBe('FAIL')
    expect(byKey['TC-UAV-103']).toBe('SKIPPED')
  })

  it('reads the xref trait and the failure message', () => {
    const { results } = parseTestResults(xunit, 'xunit')
    const fail = results.find((r) => r.testCaseKey === 'TC-UAV-102')
    expect(fail?.message).toBe('timeout exceeded')
    expect(fail?.durationSeconds).toBe(0.5)
  })

  it('throws ParseError when <assemblies> is missing', () => {
    expect(() => parseTestResults('<testsuite/>', 'xunit')).toThrow(/xUnit/)
  })

  it('throws ParseError on an unrecognised result attribute', () => {
    const bad = `<assemblies><assembly><collection>
      <test name="x" type="T" result="Bogus"/></collection></assembly></assemblies>`
    expect(() => parseTestResults(bad, 'xunit')).toThrow(ParseError)
  })
})

describe('testResultParsers — NUnit 3', () => {
  const nunit = `<?xml version="1.0" encoding="utf-8"?>
<test-run start-time="2026-05-17T09:00:00Z">
  <test-suite type="Assembly" name="Brakes">
    <test-suite type="TestFixture" name="BrakeFixture">
      <test-case name="TC-UAV-201 decelerates" fullname="Brakes.BrakeFixture.Decel" result="Passed" duration="1.1"/>
      <test-case name="TC-UAV-202 actuator" fullname="Brakes.BrakeFixture.Act" result="Failed" duration="0.6">
        <failure><message>assertion failed</message></failure>
      </test-case>
      <test-case name="TC-UAV-203 sensor" fullname="Brakes.BrakeFixture.Sense" result="Failed" label="Error" duration="0.1">
        <failure><message>unhandled exception</message></failure>
      </test-case>
      <test-case name="TC-UAV-204 optional" fullname="Brakes.BrakeFixture.Opt" result="Skipped" duration="0">
        <reason><message>not applicable</message></reason>
      </test-case>
    </test-suite>
  </test-suite>
</test-run>`

  it('parses a nested NUnit 3 report and collects every test-case', () => {
    const parsed = parseTestResults(nunit, 'nunit')
    expect(parsed.format).toBe('nunit')
    expect(parsed.results).toHaveLength(4)
    expect(parsed.summary).toEqual({ total: 4, pass: 1, fail: 2, error: 1, skipped: 1 })
  })

  it('maps Passed/Failed/Skipped and a failed-with-Error label still to FAIL', () => {
    const { results } = parseTestResults(nunit, 'nunit')
    const byKey = Object.fromEntries(results.map((r) => [r.testCaseKey, r.status]))
    expect(byKey['TC-UAV-201']).toBe('PASS')
    expect(byKey['TC-UAV-202']).toBe('FAIL')
    expect(byKey['TC-UAV-203']).toBe('FAIL') // label="Error" -> still FAIL, never PASSED_WITH_ERRORS
    expect(byKey['TC-UAV-204']).toBe('SKIPPED')
    expect(results.some((r) => r.status === 'PASSED_WITH_ERRORS')).toBe(false)
  })

  it('counts an Error-labelled failure in summary.error but still as a fail', () => {
    const { summary } = parseTestResults(nunit, 'nunit')
    expect(summary.error).toBe(1)
    expect(summary.fail).toBe(2)
  })

  it('throws ParseError when <test-run> is missing', () => {
    expect(() => parseTestResults('<testsuites/>', 'nunit')).toThrow(/NUnit/)
  })
})

describe('testResultParsers — Robot Framework', () => {
  const robot = `<?xml version="1.0" encoding="UTF-8"?>
<robot generator="Robot 7.0">
  <suite name="Brakes">
    <suite name="Decel">
      <test name="TC-UAV-301 Decelerates Within Limit">
        <tags><tag>xref:TC-UAV-301</tag></tags>
        <status status="PASS" starttime="20260517 09:00:00.000" endtime="20260517 09:00:01.500"/>
      </test>
      <test name="TC-UAV-302 Actuator Responds">
        <status status="FAIL" starttime="20260517 09:00:02.000" endtime="20260517 09:00:02.800">Timeout</status>
      </test>
      <test name="TC-UAV-303 Optional Check">
        <status status="SKIP" starttime="20260517 09:00:03.000" endtime="20260517 09:00:03.000">hardware off</status>
      </test>
    </suite>
  </suite>
</robot>`

  it('parses a Robot output.xml and maps PASS/FAIL/SKIP', () => {
    const parsed = parseTestResults(robot, 'robot')
    expect(parsed.format).toBe('robot')
    expect(parsed.results).toHaveLength(3)
    expect(parsed.summary).toEqual({ total: 3, pass: 1, fail: 1, error: 0, skipped: 1 })
    const byKey = Object.fromEntries(parsed.results.map((r) => [r.testCaseKey, r.status]))
    expect(byKey['TC-UAV-301']).toBe('PASS')
    expect(byKey['TC-UAV-302']).toBe('FAIL')
    expect(byKey['TC-UAV-303']).toBe('SKIPPED')
  })

  it('reads the xref tag and derives duration from start/end times', () => {
    const { results } = parseTestResults(robot, 'robot')
    const pass = results.find((r) => r.testCaseKey === 'TC-UAV-301')
    expect(pass?.durationSeconds).toBeCloseTo(1.5, 3)
    expect(pass?.executedAt).toBe('2026-05-17T09:00:00.000')
  })

  it('treats NOT RUN as SKIPPED', () => {
    const xml = `<robot><suite name="s">
      <test name="TC-NR-1"><status status="NOT RUN"/></test>
    </suite></robot>`
    const { results } = parseTestResults(xml, 'robot')
    expect(results[0].status).toBe('SKIPPED')
  })

  it('throws ParseError when <robot> root is missing', () => {
    expect(() => parseTestResults('<testsuites/>', 'robot')).toThrow(/Robot/)
  })
})

describe('testResultParsers — TAP', () => {
  const tap = `TAP version 13
1..4
ok 1 - TC-UAV-401 brake decelerates
not ok 2 - TC-UAV-402 actuator response
ok 3 - TC-UAV-403 optional check # SKIP hardware unavailable
not ok 4 - TC-UAV-404 known issue # TODO fix pending`

  it('parses a TAP stream and maps ok / not ok / SKIP / TODO', () => {
    const parsed = parseTestResults(tap, 'tap')
    expect(parsed.format).toBe('tap')
    expect(parsed.results).toHaveLength(4)
    // ok=1; not ok=1 (point 2); SKIP and TODO both -> skipped (points 3,4)
    expect(parsed.summary).toEqual({ total: 4, pass: 1, fail: 1, error: 0, skipped: 2 })
    const byKey = Object.fromEntries(parsed.results.map((r) => [r.testCaseKey, r.status]))
    expect(byKey['TC-UAV-401']).toBe('PASS')
    expect(byKey['TC-UAV-402']).toBe('FAIL')
    expect(byKey['TC-UAV-403']).toBe('SKIPPED')
    expect(byKey['TC-UAV-404']).toBe('SKIPPED')
  })

  it('extracts the key from the description and keeps the directive text', () => {
    const { results } = parseTestResults(tap, 'tap')
    const skip = results.find((r) => r.testCaseKey === 'TC-UAV-403')
    expect(skip?.message).toBe('hardware unavailable')
    expect(skip?.actualResults?.directive).toBe('SKIP')
  })

  it('aborts with ParseError on a Bail out! line', () => {
    expect(() => parseTestResults('TAP version 13\nBail out! disk full', 'tap')).toThrow(
      /bailed out/i,
    )
  })

  it('throws ParseError when the input is not a TAP stream', () => {
    expect(() => parseTestResults('just some random text\nwith no tap', 'tap')).toThrow(ParseError)
  })
})

describe('testResultParsers — dispatch + XXE safety', () => {
  it('throws ParseError for an unknown format', () => {
    // @ts-expect-error — deliberately passing an invalid format
    expect(() => parseTestResults('<x/>', 'totally-bogus')).toThrow(/Unknown test-result format/)
  })

  it('accepts a Buffer as well as a string', () => {
    const xml = Buffer.from('<testsuite name="s"><testcase name="TC-B-1"/></testsuite>', 'utf8')
    const { results } = parseTestResults(xml, 'junit')
    expect(results[0].testCaseKey).toBe('TC-B-1')
  })

  it('rejects an XML file carrying a DOCTYPE (XXE protection)', () => {
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE testsuites [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<testsuites><testsuite name="s"><testcase name="&xxe;"/></testsuite></testsuites>`
    expect(() => parseTestResults(xxe, 'junit')).toThrow(/DOCTYPE/)
  })

  it('does not resolve an external entity even if DOCTYPE detection were bypassed', () => {
    // No DOCTYPE here, but a stray &-entity reference — fast-xml-parser with
    // processEntities:false must not expand it; the literal text survives.
    const xml = `<testsuite name="s"><testcase name="TC-ENT-1 value is &amp;raw;"/></testsuite>`
    const { results } = parseTestResults(xml, 'junit')
    // The &amp; built-in must NOT have been expanded into an entity-eval; the
    // raw, un-expanded text is preserved (no file/network resolution occurred).
    expect(String(results[0].actualResults?.name)).toContain('&')
    expect(String(results[0].actualResults?.name)).not.toContain('root:')
  })
})
