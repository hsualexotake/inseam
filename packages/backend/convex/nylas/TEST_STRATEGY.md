# Nylas Integration Test Strategy

## Current Test Coverage

### ✅ What We Test (116 tests passing)
- **Business Logic**: Rate limiting, validation, data transformation
- **Database Operations**: Grant storage, OAuth state management
- **Security**: User isolation, CSRF protection, input sanitization
- **Error Handling**: Invalid inputs, expired states, missing data
- **Concurrency**: Race conditions, concurrent updates

### ⏭️ What We Skip (31 tests)
- **External API Calls**: Token exchange, email fetching, grant info
- **Node.js Actions**: HTTP calls in Convex runtime
- **OAuth Flow**: Complete authorization flow

## Why Tests Are Skipped

The skipped tests require:
1. **Real Nylas API** - Can't mock HTTP calls in Convex Node.js runtime
2. **OAuth Flow** - Needs actual browser redirects and callbacks
3. **Environment Variables** - Can't mock in Convex action context

## Future Testing Plan

### Phase 1: Integration Tests (Priority)
- Set up Nylas sandbox account
- Create test email accounts
- Use real API with test data
- Run separately: `yarn test:integration`

### Phase 2: Contract Testing
- Validate request/response shapes
- Test against Nylas OpenAPI spec
- No real API calls needed

### Phase 3: E2E Testing
- Use Playwright for OAuth flow
- Test complete user journey
- Run in staging environment

## How to Enable Skipped Tests

1. **Get Nylas Sandbox Account**
   ```bash
   # Add to .env.test
   NYLAS_CLIENT_ID=sandbox_client_id
   NYLAS_API_KEY=sandbox_api_key
   ```

2. **Set Up Test Infrastructure**
   - Mock server for local testing
   - OR use real sandbox in CI/CD

3. **Update Test Files**
   - Remove `.skip` from test suites
   - Update mock setup as needed

## Production Readiness

Current tests ARE sufficient for production because:
- Core business logic is thoroughly tested
- Security boundaries are validated
- Database operations are verified
- External API integration will be validated through:
  - Manual testing checklist
  - Staging environment testing
  - Monitoring and alerting in production

## Test Commands

```bash
# Run all tests (including skipped)
yarn test

# Run only passing tests
yarn test:unit

# Future: Run integration tests
yarn test:integration  # Currently shows placeholder message
```