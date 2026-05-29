# Quality Assurance (QA) Strategy

This document outlines the quality assurance approach for ensuring reliability, correctness, and maintainability of the Relay Agent Back project.

---

## A. Testing Goals

Testing is critical to ensure that the system behaves correctly, securely, and consistently under various conditions. Since this project integrates external services such as Gmail APIs and AI-based processing, failures can significantly impact user trust and system usability.

### Key Goals
- Ensure system stability and reliability
- Detect bugs early in development
- Maintain consistent functionality across features
- Prevent regressions when new features are added

### Risks to Mitigate
- **Authentication failures** (e.g., Gmail OAuth issues preventing login)
- **API failures** (Google APIs or OpenAI services becoming unavailable)
- **Data inconsistency or corruption**
- **AI inaccuracies or hallucinations** (incorrect summaries or labels)
- **Security vulnerabilities** (token leaks, improper authentication)
- **Session-related bugs** (unexpected logouts or unauthorized access)

### Critical Failures
The most critical failures include:
- Users being unable to log in or connect Gmail
- Incorrect AI-generated outputs misleading users
- Exposure of sensitive data such as API keys or tokens
- Backend crashes due to invalid inputs or API errors

---

## B. Planned Types of Testing

### 1. Unit Testing

Unit tests will focus on individual components and functions to ensure they behave correctly in isolation.

#### Scope
- Authentication functions
- API service handlers (Gmail, OpenAI)
- Utility functions (data parsing, validation)

#### Tools
- **Framework:** Jest (Node.js backend)

#### Coverage Goals
- Minimum **70–80% code coverage**
- Critical modules (authentication, API calls) must have higher coverage

---

### 2. Integration Testing

Integration testing will verify that different system components work together correctly.

#### Scope
- Gmail OAuth + Backend authentication
- Backend + OpenAI API communication
- Backend + database interactions (if applicable)
- Frontend requests to backend endpoints

#### Examples
- User authentication flow with database/session handling
- AI summary generation through API calls
- Email retrieval combined with OAuth authentication

---

### 3. End-to-End (E2E) Testing

E2E testing ensures that complete workflows function correctly from the user's perspective.

#### Key Workflows
- Connecting Gmail account via OAuth
- Viewing and retrieving emails
- Generating email summaries using AI
- Managing user session and authentication

---

### 4. Manual Testing

Manual testing will be used for features that require human evaluation.

#### Scope
- UI/UX verification
- Gmail account connection flow
- AI output quality (accuracy and readability)
- Feature usability and navigation

#### Approach
- Test across multiple browsers and devices
- Validate layout and responsiveness
- Perform exploratory testing to find edge cases

---

### 5. Performance / Load Testing

Basic performance testing will be conducted to identify bottlenecks.

#### Focus Areas
- **AI API latency** (response times for summaries and drafts)
- **OAuth flow responsiveness**
- Backend performance under multiple requests

#### Approach
- Simulate multiple API requests
- Monitor response times and failures

---

### 6. Security Testing

Security is critical due to user authentication and API integrations.

#### Key Concerns
- **OAuth token security**
- **API key exposure**
- **Unauthorized access to endpoints**
- **Improper input handling**
- **Rate limiting vulnerabilities**

#### Techniques
- Validate input on all endpoints
- Test unauthorized access scenarios
- Ensure sensitive data is stored securely (environment variables)

---

## C. Pull Request Quality Rules

To maintain high code quality, all Pull Requests must follow these rules:

- Pull Requests must pass all automated tests before merging  
- At least one team member must review and approve each PR  
- No direct commits or pushes to the `main` branch are allowed  
- All changes must be made through feature branches  
- CI checks (if configured) must succeed before merging  
- PR descriptions must clearly explain changes and link relevant issues  

---

By following this QA strategy, the team ensures that the system remains stable, secure, and maintainable as new features are developed.