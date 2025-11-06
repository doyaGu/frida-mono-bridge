# Individual Test Runners

This document provides instructions for running individual test categories independently with Frida.

## Overview

The Frida Mono Bridge test suite has been modularized to allow running individual test categories separately. Each test category can be compiled and run independently, providing faster feedback and targeted testing.

## Available Test Categories

### Core Infrastructure Tests
Tests basic Mono runtime detection, module loading, and API availability.

**Build:** `npm run test:core-infrastructure`  
**Run:** `frida -n "YourApp.exe" -l dist/test-core-infrastructure.js`

### Mono API Tests
Tests low-level Mono API functionality, export availability, and parameter processing.

**Build:** `npm run test:mono-api`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-api.js`

### Mono Class Tests
Tests class discovery, inheritance relationships, and class metadata operations.

**Build:** `npm run test:mono-class`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-class.js`

### Mono Method Tests
Tests method resolution, invocation, parameter handling, and overloads.

**Build:** `npm run test:mono-method`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-method.js`

### Mono Field Tests
Tests field discovery, value getting/setting, and field metadata.

**Build:** `npm run test:mono-field`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-field.js`

### Mono Property Tests
Tests property discovery, getter/setter resolution, and property operations.

**Build:** `npm run test:mono-property`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-property.js`

### Mono Assembly Tests
Tests assembly loading, enumeration, and dependency management.

**Build:** `npm run test:mono-assembly`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-assembly.js`

### Mono Image Tests
Tests image metadata access, class enumeration, and image operations.

**Build:** `npm run test:mono-image`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-image.js`

### Mono Domain Tests
Tests domain creation, management, and domain-specific operations.

**Build:** `npm run test:mono-domain`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-domain.js`

### Mono Threading Tests
Tests thread attachment/detachment, synchronization, and thread safety.

**Build:** `npm run test:mono-threading`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-threading.js`

### Mono Module Tests
Tests module loading, metadata access, and module operations.

**Build:** `npm run test:mono-module`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-module.js`

### Mono Data Tests
Tests array creation, string operations, and object lifecycle management.

**Build:** `npm run test:mono-data`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-data.js`

### Mono Advanced Tests
Tests complex scenarios, edge cases, and advanced features.

**Build:** `npm run test:mono-advanced`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-advanced.js`

### Mono Utils Tests
Tests utility functions, validation, and helper operations.

**Build:** `npm run test:mono-utils`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-utils.js`

### Mono Error Handling Tests
Tests error scenarios, exception handling, and recovery mechanisms.

**Build:** `npm run test:mono-error-handling`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-error-handling.js`

### Unity GameObject Tests
Tests Unity GameObject operations, component management, and lifecycle.

**Build:** `npm run test:unity-gameobject`  
**Run:** `frida -n "YourUnityApp.exe" -l dist/test-unity-gameobject.js`

### Unity Components Tests
Tests Unity Component operations and interactions.

**Build:** `npm run test:unity-components`  
**Run:** `frida -n "YourUnityApp.exe" -l dist/test-unity-components.js`

### Unity Engine Modules Tests
Tests Unity Engine module access and operations.

**Build:** `npm run test:unity-engine-modules`  
**Run:** `frida -n "YourUnityApp.exe" -l dist/test-unity-engine-modules.js`

### Mono Types Tests
Tests type system operations and type conversions.

**Build:** `npm run test:mono-types`  
**Run:** `frida -n "YourApp.exe" -l dist/test-mono-types.js`

### Advanced Features Tests
Tests advanced functionality and complex scenarios.

**Build:** `npm run test:advanced-features`  
**Run:** `frida -n "YourApp.exe" -l dist/test-advanced-features.js`

### Data Operations Tests
Tests data manipulation and operations.

**Build:** `npm run test:data-operations`  
**Run:** `frida -n "YourApp.exe" -l dist/test-data-operations.js`

### Integration Tests
Tests end-to-end workflows and cross-component integration.

**Build:** `npm run test:integration`  
**Run:** `frida -n "YourApp.exe" -l dist/test-integration.js`

### Supporting Tests
Tests supporting utilities and helper functions.

**Build:** `npm run test:supporting`  
**Run:** `frida -n "YourApp.exe" -l dist/test-supporting.js`

## Build All Individual Test Runners

To build all individual test runners at once:

```bash
npm run test:build-all
```

## Usage Examples

### Running a Single Test Category

```bash
# Build and run Core Infrastructure tests
npm run test:core-infrastructure
frida -n "Platformer.exe" -l dist/test-core-infrastructure.js

# Build and run Unity GameObject tests
npm run test:unity-gameobject
frida -n "Platformer.exe" -l dist/test-unity-gameobject.js

# Build and run Mono API tests
npm run test:mono-api
frida -n "Platformer.exe" -l dist/test-mono-api.js
```

### Running Multiple Test Categories

```bash
# Build multiple test runners
npm run test:core-infrastructure && npm run test:mono-api && npm run test:mono-class

# Run them sequentially
frida -n "Platformer.exe" -l dist/test-core-infrastructure.js
frida -n "Platformer.exe" -l dist/test-mono-api.js
frida -n "Platformer.exe" -l dist/test-mono-class.js
```

### Running All Tests (Original Method)

```bash
# Build and run the complete test suite
npm run test
frida -n "Platformer.exe" -l dist/tests.js
```

## Test Dependencies

### Standalone Tests (No Mono Runtime Dependency)
- Mono Utils Tests
- Mono Error Handling Tests

These tests can run even when Mono runtime is not available.

### Mono-Dependent Tests (Require Mono Runtime)
All other test categories require Mono runtime to be available and properly initialized.

## Test Output

Each individual test runner provides:
- Test category header with clear identification
- Individual test results with pass/fail status
- Performance timing information
- Error details for failed tests
- Final summary with pass/fail statistics

## Troubleshooting

### Build Failures
If a test runner fails to build:
1. Check TypeScript compilation errors: `npm run lint`
2. Verify all imports are correct
3. Ensure test functions are properly exported

### Runtime Failures
If a test runner fails at runtime:
1. Ensure target application uses Mono runtime
2. Check if application is in correct state
3. Verify required assemblies are loaded

### Performance Issues
If tests run slowly:
1. Check if target application is under load
2. Verify system resources are available
3. Consider running fewer test categories simultaneously

## Integration with CI/CD

Individual test runners are ideal for CI/CD pipelines:

```bash
# Example CI script
npm run test:core-infrastructure
if [ $? -eq 0 ]; then
  echo "Core Infrastructure tests passed"
else
  echo "Core Infrastructure tests failed"
  exit 1
fi

npm run test:mono-api
if [ $? -eq 0 ]; then
  echo "Mono API tests passed"
else
  echo "Mono API tests failed"
  exit 1
fi
```

## File Structure

```
tests/
├── runners/                    # Individual test runner files
│   ├── test-core-infrastructure.ts
│   ├── test-mono-api.ts
│   ├── test-mono-class.ts
│   └── ...
├── test-runner-base.ts         # Shared test runner utilities
├── test-framework.ts           # Test framework and utilities
└── [test-*.ts]              # Original test files

dist/                           # Compiled test runners
├── test-core-infrastructure.js
├── test-mono-api.js
├── test-mono-class.js
└── ...
```

This modular approach allows for:
- Faster development cycles (run only relevant tests)
- Better debugging (isolate test categories)
- Parallel execution (run multiple test categories simultaneously)
- CI/CD integration (run specific test suites)
- Reduced memory usage (smaller test bundles)