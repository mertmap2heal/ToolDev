# Verification Module E2E Testing Guide

This document provides step-by-step instructions and cURL examples for end-to-end testing of the Verification module.

## Prerequisites

1. Backend server running on `http://localhost:5000`
2. Database migrated with verification tables
3. MoC codes seeded (run `tsx src/scripts/seed-verification.ts`)
4. Valid JWT token (obtain from `/api/v1/auth/login`)

## Authentication

All requests require a JWT token in the Authorization header:

```bash
TOKEN="your-jwt-token-here"
```

## Test Workflow

### Step 1: Seed MoC Codes (One-time setup)

```bash
cd backend
tsx src/scripts/seed-verification.ts
```

### Step 2: Get MoC Codes

```bash
curl -X GET "http://localhost:5000/api/v1/verification/moc" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Create Verification Method

```bash
curl -X POST "http://localhost:5000/api/v1/verification/methods/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Functional Test",
    "methodType": "TEST",
    "description": "Functional testing method",
    "linkedMocCode": 3,
    "applicablePhases": ["TRR", "QUALIFICATION"],
    "requiredEvidenceTypes": ["TEST_REPORT", "TEST_DATA"]
  }'
```

### Step 4: Create Test Setup

```bash
curl -X POST "http://localhost:5000/api/v1/verification/setups/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HIL Test Bench",
    "description": "Hardware-in-the-loop test setup",
    "environmentType": "HIL",
    "components": ["DUT", "Simulator", "DAQ"],
    "interfaces": ["CAN", "Ethernet"],
    "version": "1.0"
  }'
```

### Step 5: Create Test Case

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-cases/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Verify System Startup",
    "objective": "Verify system starts correctly",
    "preconditions": "System powered off",
    "steps": [
      {"step": 1, "action": "Power on system"},
      {"step": 2, "action": "Wait for initialization"},
      {"step": 3, "action": "Verify status LED"}
    ],
    "expectedResults": [
      "System powers on",
      "Initialization completes within 5s",
      "Status LED shows green"
    ],
    "passFailCriteria": "All expected results must be met",
    "linkedMocCode": 3,
    "linkedMethodId": "METHOD_ID"
  }'
```

### Step 6: Link Setup to Test Case

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-cases/PROJECT_ID/TEST_CASE_ID/link-setup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "setupId": "SETUP_ID"
  }'
```

### Step 7: Create Test Plan

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-plans/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "System Integration Test Plan",
    "description": "Test plan for system integration",
    "scope": "All system functions",
    "entryCriteria": "All components available",
    "exitCriteria": "All tests passed",
    "phase": "QUALIFICATION"
  }'
```

### Step 8: Add Test Case to Plan

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-plans/PROJECT_ID/TEST_PLAN_ID/add-case" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testCaseId": "TEST_CASE_ID",
    "isMandatory": true,
    "orderIndex": 1,
    "notes": "First test case"
  }'
```

### Step 9: Approve Test Plan

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-plans/PROJECT_ID/TEST_PLAN_ID/approve" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 10: Create Test Run

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-runs/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testPlanId": "TEST_PLAN_ID",
    "runName": "Test Run 001",
    "runNumber": 1,
    "executionContext": {
      "buildVersion": "v1.0.0",
      "config": "production",
      "toolVersions": {"testTool": "v2.1"}
    }
  }'
```

### Step 11: Start Test Run

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-runs/PROJECT_ID/TEST_RUN_ID/start" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 12: Execute Test Case Result

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-runs/PROJECT_ID/TEST_RUN_ID/results/TEST_CASE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resultStatus": "PASS",
    "actualResults": {
      "output": "System started successfully",
      "duration": "4.2s",
      "statusLED": "green"
    },
    "notes": "Test passed as expected",
    "setupId": "SETUP_ID"
  }'
```

### Step 13: Create Evidence

```bash
curl -X POST "http://localhost:5000/api/v1/verification/evidence/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceType": "TEST_REPORT",
    "title": "Test Report for Run 001",
    "description": "Detailed test execution report",
    "storageRef": "/uploads/test-reports/run-001.pdf",
    "checksum": "abc123def456"
  }'
```

### Step 14: Attach Evidence to Result

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-runs/PROJECT_ID/TEST_RUN_ID/results/TEST_CASE_ID/attach-evidence" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceId": "EVIDENCE_ID",
    "relation": "PRIMARY"
  }'
```

### Step 15: Complete Test Run

```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-runs/PROJECT_ID/TEST_RUN_ID/complete" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 16: Get Coverage Summary

```bash
curl -X GET "http://localhost:5000/api/v1/verification/coverage/PROJECT_ID/moc-summary" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 17: Generate Test Run Report

```bash
curl -X GET "http://localhost:5000/api/v1/verification/reports/test-run/PROJECT_ID/TEST_RUN_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 18: Create Nonconformity from Failed Result

```bash
curl -X POST "http://localhost:5000/api/v1/verification/nonconformities/PROJECT_ID/from-failed-run-result/RUN_RESULT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 19: Get Overview Dashboard

```bash
curl -X GET "http://localhost:5000/api/v1/verification/overview/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN"
```

## Expected Responses

All successful responses follow this format:

```json
{
  "success": true,
  "data": { ... }
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Validation Rules Tested

1. **Status Transitions**: Invalid transitions return 400 with error message
2. **Evidence Requirements**: MoC 5/6 require test procedure, execution result, and evidence
3. **Run Completion**: Cannot complete run if mandatory cases are NOT_RUN
4. **Version Snapshots**: Test case and setup snapshots are immutable once executed

## Notes

- Replace `PROJECT_ID`, `TEST_CASE_ID`, etc. with actual IDs from previous responses
- All timestamps are in ISO 8601 format
- JSON fields can be arrays or objects as specified in the API
- Audit trail is automatically created for all state changes
