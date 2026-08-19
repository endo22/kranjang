# Task Final Fix Report

## Targeted regression tests (red)

Command:

```bash
pnpm --filter @kranjang/api test -- test/auth.service.spec.ts test/users.rbac.spec.ts test/me.settings.spec.ts
```

Output:

```text
> @kranjang/api@0.0.1 test D:\Project\Freelance\SaaS\kranjang\apps\api
> node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand "test/auth.service.spec.ts" "test/users.rbac.spec.ts" "test/me.settings.spec.ts"

(node:31968) ExperimentalWarning: VM Modules is an experimental feature and might change at any time

FAIL test/users.rbac.spec.ts
  ● users RBAC and tenant isolation › creates, gets, updates, and soft-deletes tenant users without exposing passwordHash

    expect(received).toEqual(expected) // deep equality

    - Expected  - 5
    + Received  + 1

    - Array [
    -   "CREATE",
    -   "UPDATE",
    -   "DELETE",
    - ]
    + Array []

FAIL test/me.settings.spec.ts
  ● me and settings › gets and patches tenant settings for users with settings.manage

    expect(received).toBeTruthy()

    Received: null

FAIL test/auth.service.spec.ts
  ● AuthService.refresh › rejects refresh when the presented token can no longer be atomically revoked

    expect(received).rejects.toMatchObject()

    Received promise resolved instead of rejected

Test Suites: 3 failed, 3 total
Tests:       3 failed, 10 passed, 13 total
Snapshots:   0 total
Time:        6.326 s
Ran all test suites matching test/auth.service.spec.ts|test/users.rbac.spec.ts|test/me.settings.spec.ts.
```

## Targeted regression tests (green)

Command:

```bash
pnpm --filter @kranjang/api test -- test/auth.service.spec.ts test/users.rbac.spec.ts test/me.settings.spec.ts
```

Output:

```text
> @kranjang/api@0.0.1 test D:\Project\Freelance\SaaS\kranjang\apps\api
> node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand "test/auth.service.spec.ts" "test/users.rbac.spec.ts" "test/me.settings.spec.ts"

(node:9656) ExperimentalWarning: VM Modules is an experimental feature and might change at any time

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        8.483 s
Ran all test suites matching test/auth.service.spec.ts|test/users.rbac.spec.ts|test/me.settings.spec.ts.
```

## Full API suite

Command:

```bash
pnpm --filter @kranjang/api test
```

Output:

```text
> @kranjang/api@0.0.1 test D:\Project\Freelance\SaaS\kranjang\apps\api
> node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand

(node:18168) ExperimentalWarning: VM Modules is an experimental feature and might change at any time

Test Suites: 7 passed, 7 total
Tests:       37 passed, 37 total
Snapshots:   0 total
Time:        12.499 s, estimated 14 s
Ran all test suites.
```
