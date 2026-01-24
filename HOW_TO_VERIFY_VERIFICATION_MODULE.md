# How to Verify the Verification Module Implementation

This guide shows you how to see and test the verification module results.

## Step 1: Run Database Migration

First, create the database tables:

```bash
cd backend
npx prisma migrate dev --name add_verification_module
```

This will:
- Create all 18 verification tables with `ver_` prefix
- Generate the migration SQL file
- Apply it to your database

**Expected Output:**
```
✔ Generated Prisma Client
✔ Applied migration `add_verification_module`
```

## Step 2: Seed MoC Data

Seed the Means of Compliance codes (0-8):

```bash
cd backend
tsx src/scripts/seed-verification.ts
```

**Expected Output:**
```
No MoC codes found. Creating default MoC codes 0-8...
Created/updated 9 MoC codes!
MoC codes seeded successfully.
```

## Step 3: Verify Database Tables

Check that tables were created:

```bash
cd backend
npx prisma studio
```

In Prisma Studio, you should see:
- `VerMoc` (with 9 rows after seeding)
- `VerMethod`
- `VerTestSetup`
- `VerTestCase`
- `VerTestPlan`
- `VerTestRun`
- `VerEvidence`
- `VerReview`
- `VerNonconformity`
- And 9 more verification tables...

## Step 4: Start the Backend Server

```bash
cd backend
npm run dev
```

**Expected Output:**
```
Server is running on port 5000
```

## Step 5: Test API Endpoints

### Option A: Using cURL (Command Line)

1. **Get your JWT token** (login first):
```bash
curl -X POST "http://localhost:5000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'
```

2. **Set the token as a variable**:
```bash
TOKEN="your-jwt-token-from-login-response"
```

3. **Test getting MoC codes**:
```bash
curl -X GET "http://localhost:5000/api/v1/verification/moc" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": 0,
      "name": "Not Applicable / Exempt",
      "description": "Verification is not applicable...",
      "requiresJustification": true,
      "isActive": true
    },
    {
      "code": 1,
      "name": "Analysis",
      ...
    },
    ... (codes 0-8)
  ]
}
```

4. **Test creating a test case** (replace PROJECT_ID with actual project ID):
```bash
curl -X POST "http://localhost:5000/api/v1/verification/test-cases/PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Case Example",
    "objective": "Verify functionality",
    "linkedMocCode": 3
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "key": "TC-001",
    "title": "Test Case Example",
    "status": "DRAFT",
    "version": "1.0",
    ...
  }
}
```

### Option B: Using Postman or Insomnia

1. Import the following collection structure:
   - Base URL: `http://localhost:5000/api/v1/verification`
   - Auth: Bearer Token (set in Authorization header)

2. Test endpoints in this order:
   - `GET /moc` - Should return 9 MoC codes
   - `GET /overview/:projectId` - Should return dashboard metrics
   - `POST /test-cases/:projectId` - Create a test case
   - `GET /test-cases/:projectId` - List test cases

### Option C: Using Browser DevTools

1. Open your frontend application
2. Open Browser DevTools (F12)
3. Go to Network tab
4. Navigate to a project
5. The frontend should make API calls to `/api/v1/verification/*` endpoints

## Step 6: Check Logs

Watch the backend console for:
- Successful API calls
- Any error messages
- Audit trail creation (when you create/update entities)

## Step 7: Verify Audit Trail

After creating/updating any verification entity, check the audit trail:

```bash
# In Prisma Studio, open VerAuditEvent table
# Or query via API (if you add an endpoint):
```

You should see audit events for:
- CREATE operations
- UPDATE operations
- STATUS_CHANGE operations
- Evidence linking/unlinking

## Step 8: Run Tests

Run the unit and integration tests:

```bash
cd backend
# If using Jest:
npm test -- verification

# If using Vitest:
npm run test verification
```

**Expected Output:**
```
✓ Status Transition Service
  ✓ should allow valid test case transitions
  ✓ should reject invalid test case transitions
  ...

✓ Evidence Rules
  ✓ should validate MoC 5/6 requirements
  ...

✓ Verification Workflow Integration
  ✓ should complete full verification workflow
```

## Step 9: Check File Structure

Verify all files were created:

```bash
# Check services
ls backend/src/services/verification/
# Should show: audit.service.ts, coverage.service.ts, evidence.service.ts, etc.

# Check controllers
ls backend/src/controllers/verification/
# Should show: moc.controller.ts, method.controller.ts, testCase.controller.ts, etc.

# Check routes
cat backend/src/routes/verification.routes.ts
# Should show all route definitions
```

## Step 10: Full E2E Test Flow

Follow the complete workflow from `VERIFICATION_E2E_TESTING.md`:

1. Create MoC entries (already seeded)
2. Create verification method
3. Create test setup
4. Create test case
5. Link setup to test case
6. Create test plan
7. Add test case to plan
8. Create test run
9. Execute test case results
10. Attach evidence
11. Complete run
12. Verify coverage
13. Generate reports

## Quick Verification Checklist

- [ ] Migration ran successfully (18 tables created)
- [ ] MoC seed data loaded (9 codes in VerMoc table)
- [ ] Backend server starts without errors
- [ ] `GET /api/v1/verification/moc` returns 9 MoC codes
- [ ] `GET /api/v1/verification/overview/:projectId` returns dashboard data
- [ ] Can create a test case via API
- [ ] Can create a test plan via API
- [ ] Status transitions are enforced (try invalid transition, should get error)
- [ ] Audit events are created (check VerAuditEvent table)
- [ ] Tests pass

## Troubleshooting

### Migration Fails
- Check database connection in `.env`
- Ensure PostgreSQL is running
- Check for existing tables that might conflict

### API Returns 401 Unauthorized
- Verify JWT token is valid
- Check token is in Authorization header: `Bearer <token>`
- Token might be expired, login again

### API Returns 404 Not Found
- Verify project ID exists
- Check route path matches exactly
- Ensure backend server is running

### No Data in Tables
- Run seed script: `tsx src/scripts/seed-verification.ts`
- Check Prisma Studio to see if tables exist
- Verify migration was applied

## Next Steps After Verification

Once verified:
1. Connect frontend to new endpoints
2. Build UI components for verification features
3. Add more test coverage
4. Integrate with Requirements module (future)
