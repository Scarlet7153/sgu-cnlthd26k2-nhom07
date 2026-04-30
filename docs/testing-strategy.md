# Testing Strategy Documentation

## Overview

This document outlines the comprehensive testing strategy for the PC Shop e-commerce application, covering unit tests, integration tests, and end-to-end (E2E) tests.

---

## Test Pyramid

```
       /\
      /  \     E2E Tests (Playwright)
     /----\    Critical User Flows
    /      \
   /--------\  Integration Tests
  /          \ API & Service Tests
 /------------\
/              \
----------------
   Unit Tests   (Jest/Vitest + JUnit)
   Business Logic
```

### Explanation

The test pyramid represents the ideal distribution of tests in our application:

1. **Unit Tests (Base - 70%)**
   - Fast, isolated tests for individual functions/components
   - Run on every code change
   - High confidence in business logic correctness

2. **Integration Tests (Middle - 20%)**
   - Test interactions between components/services
   - API endpoint testing
   - Database integration testing

3. **E2E Tests (Top - 10%)**
   - Full user journey testing
   - Cross-browser testing
   - Critical path validation

---

## Coverage Checklist

### Backend Unit Tests (≥70%)

| Module | Target | Status |
|--------|--------|--------|
| Auth Service | 80% | 🟡 In Progress |
| User Service | 75% | 🟡 In Progress |
| Product Service | 70% | 🟡 In Progress |
| Order Service | 75% | 🟡 In Progress |
| Payment Service | 80% | 🟡 In Progress |

#### Required Test Coverage:
- [x] Controller layer (all endpoints)
- [x] Service layer (business logic)
- [x] Repository layer (data access)
- [ ] Utility classes (≥80%)
- [ ] Exception handlers (100%)
- [ ] DTO validations (100%)

### Backend Integration Tests (All Endpoints)

| Service | Endpoints | Status |
|---------|-----------|--------|
| Auth Service | 8/8 | ✅ Complete |
| User Service | 10/12 | 🟡 In Progress |
| Product Service | 15/15 | ✅ Complete |
| Order Service | 12/12 | ✅ Complete |
| Payment Service | 6/8 | 🟡 In Progress |

#### Integration Test Scenarios:
- [x] Happy path requests
- [x] Validation errors
- [x] Authentication failures
- [x] Authorization checks
- [x] Database transaction rollback
- [x] External service mocks

### Frontend Unit Tests (≥60%)

| Module | Target | Status |
|--------|--------|--------|
| Components | 65% | 🟡 In Progress |
| Hooks | 70% | 🟡 In Progress |
| Services/API | 80% | ✅ Complete |
| Utils/Helpers | 75% | ✅ Complete |
| Store/State | 70% | 🟡 In Progress |

#### Component Testing:
- [x] Render tests
- [x] User interaction tests
- [x] Props validation
- [x] State changes
- [x] Error boundaries

### E2E Tests (Critical User Flows)

| Flow | Scenarios | Priority |
|------|-----------|----------|
| Authentication | 8 | 🔴 High |
| Product Browse | 10 | 🔴 High |
| Checkout | 12 | 🔴 High |
| Admin Dashboard | 10 | 🟡 Medium |
| User Profile | 6 | 🟢 Low |

#### Critical Paths:
1. **User Registration → Login → Browse → Purchase**
2. **Admin Login → Order Management → Status Update**
3. **Guest User → Add to Cart → Checkout → Payment**
4. **Search → Filter → Sort → View Details → Add Cart**

---

## Test Environments

### Local Development
```bash
# Backend
mvn test                    # Run all tests
mvn test -Dtest=ClassName   # Run specific test class

# Frontend
npm run test               # Run unit tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# E2E
npx playwright test        # Run all E2E tests
npx playwright test --ui   # UI mode for debugging
npx playwright test --project=chromium  # Specific browser
```

### CI/CD Pipeline
- **Pull Requests**: Unit tests + Lint + Build
- **Merge to Develop**: Full test suite + Integration tests
- **Merge to Main**: Full test suite + E2E tests + Performance tests

---

## Best Practices

### 1. Test Independence
```typescript
// ✅ Good: Each test is independent
test('should login successfully', async ({ page }) => {
  await page.goto('/login');
  // ... test code
});

// ❌ Bad: Test depends on previous test state
test('should use logged in state', async ({ page }) => {
  // Assumes user is already logged in
});
```

### 2. Use Test Data Factories
```typescript
// ✅ Good: Centralized test data
import { TEST_USERS } from './test-data/users';
await loginPage.login(TEST_USERS.regular.email, TEST_USERS.regular.password);

// ❌ Bad: Hardcoded values scattered in tests
await loginPage.login('test@test.com', 'password123');
```

### 3. Page Object Pattern
```typescript
// ✅ Good: Encapsulate page interactions
export class LoginPage {
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}

// ❌ Bad: Direct page manipulation in tests
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
```

### 4. Descriptive Test Names
```typescript
// ✅ Good: Clear description of behavior
test('should display error message when login credentials are invalid', async () => {
  // ...
});

// ❌ Bad: Vague test name
test('login test 1', async () => {
  // ...
});
```

### 5. Proper Assertions
```typescript
// ✅ Good: Specific assertions
await expect(page).toHaveURL(/.*dashboard/);
await expect(successMessage).toContainText('Order placed successfully');

// ❌ Bad: Generic assertions
expect(true).toBe(true);
```

### 6. Handle Flakiness
```typescript
// ✅ Good: Wait for dynamic content
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 10000 });

// Configure retries in playwright.config.ts
retries: process.env.CI ? 2 : 1,
```

---

## Troubleshooting Guide

### Common Issues

#### 1. E2E Tests Failing in CI but Passing Locally

**Symptoms:**
- Tests pass on local machine
- Fail in GitHub Actions with timeout errors

**Solutions:**
```bash
# 1. Increase timeout in playwright.config.ts
timeout: 60000,  // 60 seconds

# 2. Add waits for network idle
await page.waitForLoadState('networkidle');

# 3. Use webServer configuration for proper startup
webServer: {
  command: 'npm run preview',
  url: 'http://localhost:8080',
  timeout: 120000,
},

# 4. Enable video recording for debugging
use: {
  video: 'on-first-retry',
}
```

#### 2. Intermittent Test Failures (Flaky Tests)

**Symptoms:**
- Tests pass/fail randomly
- Race conditions

**Solutions:**
```typescript
// 1. Add explicit waits
await page.waitForSelector('.loading', { state: 'hidden' });

// 2. Use retry configuration
retries: 2,

// 3. Stabilize selectors
// Use data-testid instead of CSS classes
<button data-testid="submit-button">Submit</button>

// 4. Add beforeEach setup
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
});
```

#### 3. Coverage Reports Not Generated

**Symptoms:**
- JaCoCo reports empty
- Coverage 0% shown

**Solutions:**
```xml
<!-- 1. Check pom.xml for JaCoCo plugin -->
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.11</version>
  <executions>
    <execution>
      <goals>
        <goal>prepare-agent</goal>
      </goals>
    </execution>
  </executions>
</plugin>

# 2. Ensure tests run before report
mvn clean test jacoco:report

# 3. Check file paths in GitHub Actions
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: target/site/jacoco/jacoco.xml
```

#### 4. Database Connection Issues in Tests

**Symptoms:**
- Tests fail with connection refused
- H2/PostgreSQL connection errors

**Solutions:**
```yaml
# 1. Use TestContainers for integration tests
@Testcontainers
public class IntegrationTest {
  @Container
  static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");
}

# 2. Or use H2 for unit tests
spring.datasource.url=jdbc:h2:mem:testdb
spring.datasource.driverClassName=org.h2.Driver

# 3. Clean up after tests
@AfterEach
void tearDown() {
  repository.deleteAll();
}
```

#### 5. Playwright Browser Installation Issues

**Symptoms:**
- `Executable doesn't exist` errors
- Browser not found

**Solutions:**
```bash
# 1. Reinstall browsers
npx playwright install --force

# 2. Install dependencies on Linux
npx playwright install-deps

# 3. In CI, use with-deps flag
- name: Install Playwright
  run: npx playwright install --with-deps chromium

# 4. Check playwright.config.ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
]
```

### Debug Techniques

#### 1. Enable Debug Mode
```bash
# Playwright
DEBUG=pw:api npx playwright test

# Maven
mvn test -X

# Vitest
DEBUG=vitest:* npm run test
```

#### 2. View Test Artifacts
```bash
# Playwright HTML report
npx playwright show-report

# JaCoCo report
open target/site/jacoco/index.html

# Vitest UI
npm run test:ui
```

#### 3. Capture Screenshots on Failure
```typescript
// playwright.config.ts
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'on-first-retry',
}
```

---

## CI/CD Pipeline Diagram

```
┌─────────────────┐
│   Push/PR       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend Tests  │────┐
│  (Parallel)     │    │
└─────────────────┘    │
         │             │
         ▼             │
┌─────────────────┐    │
│ Frontend Tests  │    │
│  (Parallel)     │    │
└─────────────────┘    │
         │             │
         ▼             │
┌─────────────────┐    │
│   E2E Tests     │◄───┘
│ (After success) │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Coverage Report │
│   + Artifacts   │
└─────────────────┘
```

---

## Useful Commands Reference

### Maven (Backend)
```bash
mvn clean test                           # Run all tests
mvn test -Dtest=UserServiceTest          # Run specific test
mvn test -Dtest=UserServiceTest#testName # Run specific method
mvn jacoco:report                        # Generate coverage report
mvn verify                               # Run integration tests
```

### npm (Frontend)
```bash
npm run test              # Run unit tests once
npm run test:watch        # Run in watch mode
npm run test:coverage     # Run with coverage
npm run test:ui           # Open Vitest UI
```

### Playwright (E2E)
```bash
npx playwright test                    # Run all tests
npx playwright test auth.spec.ts       # Run specific file
npx playwright test --project=chromium # Run in specific browser
npx playwright test --headed           # Run in headed mode
npx playwright test --debug            # Debug mode
npx playwright show-report             # View HTML report
npx playwright codegen                 # Generate tests
```

---

## Contact & Support

- **Test Issues**: Create an issue with `testing` label
- **CI/CD Issues**: Contact DevOps team
- **Test Data**: Contact QA team for test account credentials

---

*Last Updated: April 2026*
