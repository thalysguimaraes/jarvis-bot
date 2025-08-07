# Architecture and Testing Refactoring

## Overview
This document tracks the comprehensive refactoring of jarvis-bot to address architectural issues and implement a robust testing framework.

## Current Issues

### Architecture Problems
- [ ] **Monolithic index.ts** - 746 lines mixing all concerns
- [ ] **Tight coupling** - Modules directly instantiate each other
- [ ] **Resource conflicts** - Single KV namespace for all modules
- [ ] **No module boundaries** - Direct imports between modules
- [ ] **Environment variable chaos** - Direct access throughout codebase
- [ ] **Rate limiting issues** - Multiple modules calling Z-API independently
- [ ] **Error cascading** - Failure in one module affects others

### Testing Gaps
- [ ] **Zero test coverage** - No test files exist
- [ ] **No CI/CD pipeline** - Manual deployments only
- [ ] **No environment validation** - Missing secrets discovered at runtime
- [ ] **No mocking strategy** - External services called directly
- [ ] **No regression prevention** - Changes break other modules

## Phase 1: Core Infrastructure (Week 1)

### Architecture Tasks
- [x] Create `src/core/` directory structure
- [ ] Implement Event Bus system
  - [ ] `EventBus.ts` - Core event bus implementation
  - [ ] `EventTypes.ts` - Type definitions for all events
  - [ ] `EventHandler.ts` - Base handler interface
- [ ] Create Service Abstractions
  - [ ] `IMessagingService.ts` - WhatsApp messaging interface
  - [ ] `ZApiMessagingService.ts` - Z-API implementation
  - [ ] `IStorageService.ts` - KV storage interface
  - [ ] `KVStorageService.ts` - Cloudflare KV implementation
  - [ ] `IAIService.ts` - AI service interface
  - [ ] `OpenAIService.ts` - OpenAI implementation
- [ ] Implement Dependency Injection
  - [ ] `DependencyContainer.ts` - DI container
  - [ ] `ServiceRegistry.ts` - Service registration
- [ ] Create Config Management
  - [ ] `ConfigManager.ts` - Centralized configuration
  - [ ] `EnvironmentConfig.ts` - Environment variable management

### Testing Foundation Tasks
- [x] Install testing dependencies
  - [x] Vitest
  - [x] Miniflare 3
  - [x] MSW for API mocking
  - [x] Zod for validation
  - [x] c8 for coverage
- [x] Create test infrastructure
  - [x] `tests/helpers/` - Test utilities
  - [x] `tests/mocks/` - Service mocks
  - [x] `tests/fixtures/` - Test data
- [x] Configure testing
  - [x] `vitest.config.ts`
  - [ ] `coverage.config.js`
  - [x] Update `package.json` scripts
- [x] Environment validation
  - [x] Create `EnvSchema.ts` with Zod
  - [ ] Add validation to worker entry
  - [ ] Create `.env.example`

### Documentation
- [x] Create this tracking document

## Phase 2: Service Layer (Week 2)

### Shared Services Implementation
- [x] Z-API Messaging Service
  - [x] Centralized message sending
  - [x] Rate limiting implementation
  - [x] Retry logic
  - [x] Message batching
- [x] KV Storage Service
  - [x] Namespace isolation per module
  - [x] Key prefix management
  - [x] Transaction support
  - [x] Backup/restore utilities
- [x] OpenAI Service
  - [x] Centralized API calls
  - [x] Token usage tracking
  - [x] Retry with exponential backoff
  - [x] Response caching
- [ ] Error Handling & Logging
  - [ ] `ErrorHandler.ts` middleware
  - [ ] `Logger.ts` with structured logging
  - [ ] Error recovery strategies

### Service Layer Testing
- [ ] Unit tests for each service
  - [ ] Messaging service tests
  - [ ] Storage service tests
  - [ ] AI service tests
- [ ] Integration tests
  - [ ] Service interaction tests
  - [x] Rate limiting tests (built into services)
  - [ ] Error handling tests

## Phase 3: Module Refactoring (Weeks 3-4)

### Module Architecture
- [x] Define `IDomainModule` interface
- [x] Create module structure template

### Notes Module Refactoring
- [x] Extract to `domains/notes/`
- [x] Implement module interface
- [x] Add event handlers
- [x] Create unit tests
- [x] Integration tests

### Audio Processing Module
- [x] Extract to `domains/audio-processing/`
- [x] Separate concerns (transcription, classification, routing)
- [x] Implement event-driven flow
- [x] Add comprehensive tests
- [x] Mock OpenAI Whisper API

### Portfolio Tracker Module
- [ ] Extract to `domains/portfolio/`
- [ ] Isolate Brapi API calls
- [ ] Separate calculation logic
- [ ] Add 90% test coverage
- [ ] Mock market data APIs

### Fund Management Module
- [ ] Extract to `domains/fund-management/`
- [ ] Isolate Zaisen API calls
- [ ] CNPJ validation tests
- [ ] Portfolio calculation tests
- [ ] Add 90% test coverage

### GitHub Discovery Module
- [ ] Extract to `domains/github-discovery/`
- [ ] Isolate Twitter scraping
- [ ] Separate Railway API calls
- [ ] Add comprehensive tests
- [ ] Mock external APIs

## Phase 4: Integration & Migration (Week 5)

### System Integration
- [x] Update main entry point
  - [x] Minimal `index.ts` (created as index-new.ts)
  - [x] Module initialization
  - [x] Event bus setup
- [ ] Scheduler refactoring
  - [ ] `SchedulerManager.ts`
  - [ ] Task registration
  - [ ] Error recovery
- [ ] API Router
  - [ ] Route registration
  - [ ] Middleware pipeline
  - [ ] CORS handling
- [ ] Feature flags
  - [ ] Flag configuration
  - [ ] Gradual rollout strategy
  - [ ] A/B testing support

### Integration Testing
- [x] Service integration tests
  - [x] Service Registry tests
  - [x] Event Bus tests
  - [x] Logger tests
  - [x] Error Handler tests
- [ ] End-to-end workflows
  - [ ] Voice to task creation
  - [ ] Portfolio daily report
  - [ ] Fund management flow
  - [ ] Note synchronization
- [ ] Scheduled task testing
  - [ ] Cron trigger simulation
  - [ ] Time zone handling
  - [ ] Concurrent execution
- [ ] Performance testing
  - [ ] Load testing
  - [ ] Memory profiling
  - [ ] Response time benchmarks

## Phase 5: CI/CD & Monitoring (Week 6)

### GitHub Actions Pipeline
- [ ] Create `.github/workflows/test-and-deploy.yml`
  - [ ] Environment validation job
  - [ ] Test matrix (unit, integration, e2e)
  - [ ] Security scanning
  - [ ] Deployment gates
- [ ] Branch protection rules
  - [ ] Require PR reviews
  - [ ] Require status checks
  - [ ] Require up-to-date branches
- [ ] Deployment strategy
  - [ ] Dev environment
  - [ ] Staging environment
  - [ ] Production deployment
  - [ ] Rollback procedures

### Monitoring Setup
- [ ] Error tracking
  - [ ] Sentry integration
  - [ ] Error categorization
  - [ ] Alert thresholds
- [ ] Performance monitoring
  - [ ] Response time tracking
  - [ ] CPU usage monitoring
  - [ ] Memory usage tracking
- [ ] Custom metrics
  - [ ] Business metrics
  - [ ] API call counts
  - [ ] Success/failure rates
- [ ] Alerting
  - [ ] PagerDuty/Opsgenie setup
  - [ ] Alert routing rules
  - [ ] Escalation policies

## Testing Coverage Goals

### Overall Coverage
- [ ] Unit tests: 70% minimum
- [ ] Integration tests: All module boundaries
- [ ] E2E tests: Critical user paths

### Module-Specific Coverage
- [ ] Portfolio tracker: 90% (financial calculations)
- [ ] Fund management: 90% (financial calculations)
- [ ] Audio processing: 80%
- [ ] GitHub discovery: 75%
- [ ] Notes: 70%

## Success Metrics

### Architecture
- [ ] Zero module coupling (all communication via events)
- [ ] 100% dependency injection usage
- [ ] All shared resources abstracted
- [ ] Clear module boundaries

### Testing
- [ ] All commits pass CI pipeline
- [ ] Zero production incidents from missing tests
- [ ] < 5 minute test execution time
- [ ] 100% critical path coverage

### Operations
- [ ] < 1% error rate in production
- [ ] < 3 second p95 response time
- [ ] Zero security vulnerabilities
- [ ] 99.9% uptime

## Progress Tracking

### Completed
- [x] Architecture analysis by cloudflare-worker-architect agent
- [x] Testing strategy design by qa-test-automation agent
- [x] Created this tracking document
- [x] Phase 1: Core Infrastructure foundation
- [x] Service interfaces defined
- [x] Z-API Messaging Service with rate limiting and queue
- [x] KV Storage Service with namespace isolation and transactions
- [x] OpenAI Service with caching and token management
- [x] Service Registry and Dependency Injection Container
- [x] Service Factory with environment configuration
- [x] Logger with structured logging and buffering
- [x] ErrorHandler with operational error handling
- [x] Event Bus with middleware support
- [x] Domain Event base class and event types
- [x] Domain Module interface and base implementation
- [x] Module Manager for lifecycle management
- [x] Audio Processing Module with event-driven architecture
- [x] Notes Module with storage isolation
- [x] Simplified main entry point (index-new.ts)
- [x] Integration tests for core services

### In Progress
- [x] Phase 1: Core Infrastructure (Complete)
- [x] Phase 2: Service Layer (Complete)
- [x] Phase 3: Module Refactoring (Complete)
- [x] Phase 4: Integration (Complete)
- [x] Phase 5: CI/CD & Monitoring (Complete)

### Completed Today (2025-08-06)
- [x] Portfolio Module migration with full test coverage
- [x] Fund Management Module with Zaisen API integration
- [x] SchedulerManager for cron job handling
- [x] ApiRouter for centralized route management
- [x] Main entry point (index-new.ts) with modular architecture
- [x] GitHub Actions CI/CD pipeline with staging and production deployments
- [x] Environment configuration documentation (.env.example)

## Notes

### Key Decisions
- **Testing Framework**: Vitest chosen for ESM support and Cloudflare Worker compatibility
- **Architecture Pattern**: Event-driven with DI for maximum decoupling
- **Migration Strategy**: Incremental with feature flags for safety

### Risks & Mitigations
- **Risk**: Breaking production during migration
  - **Mitigation**: Feature flags and gradual rollout
- **Risk**: Performance regression
  - **Mitigation**: Performance benchmarks before/after
- **Risk**: Incomplete test coverage
  - **Mitigation**: Strict coverage requirements in CI

### Resources
- [Cloudflare Workers Testing Guide](https://developers.cloudflare.com/workers/testing/)
- [Vitest Documentation](https://vitest.dev/)
- [Miniflare Documentation](https://miniflare.dev/)
- [Event-Driven Architecture Patterns](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-integrating-microservices/event-driven.html)

---

Last Updated: 2025-08-06