# Session Context: TypeScript Rewrite Plan

## Session ID
a9973aa3-2e87-420a-9c57-c48fd5f3a2d4

## Goal
Create a comprehensive implementation plan to rewrite the ABSmartly JavaScript SDK in TypeScript from scratch.

## What Was Done
1. Created git worktree `worktree-typescript-rewrite` based on `main`
2. Thoroughly explored the entire codebase (43 source files, 34 test files, all config)
3. Read every source file, understanding all types, APIs, and algorithms
4. Read all 20 JsonExpr operators
5. Read all 14 test files to understand test patterns and fixture data
6. Wrote comprehensive 17-task implementation plan

## Plan Location
`docs/superpowers/plans/2026-03-28-typescript-rewrite.md`

## Key Decisions
- **Drop legacy support**: Node 18+ / modern browsers only (was Node 6+ / IE 10+)
- **Drop dependencies**: node-fetch, rfdc, core-js (use native fetch, structuredClone)
- **Drop polyfills**: fetch-shim, abort-controller-shim, platform detection wrappers
- **Drop Babel**: Use tsup (esbuild-based) for bundling ESM + CJS + browser IIFE
- **Test framework**: Vitest instead of Jest
- **Keep identical**: Public API, hashing algorithms, variant assignment, client retry logic

## Task Breakdown (17 tasks)
1. Project scaffolding & build system (package.json, tsconfig, tsup, vitest)
2. Types & errors
3. Murmur3 hash
4. MD5 hash
5. Hashing utilities
6. Core utilities (isObject, isEqualsDeep, etc.)
7. Variant assigner
8. JsonExpr evaluator
9. JsonExpr operators (all 20 in one file)
10. JsonExpr facade & AudienceMatcher
11. HTTP client with retry
12. Provider & publisher
13. Context class (largest module)
14. SDK class
15. Config merge utility
16. Public API & index exports
17. Full integration & cleanup
