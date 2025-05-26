# Technical Debt Tracking

## ESLint Issues - Priority Cleanup Plan

**Status**: ESLint temporarily disabled for deployment (not industry standard)  
**Goal**: Re-enable ESLint with clean codebase in 2-3 sprints  
**Industry Standard**: Fix issues systematically, enable strict linting for new code

### Phase 1: Critical Issues (Week 1)
- [ ] Remove all unused imports and variables
- [ ] Fix @typescript-eslint/no-unused-vars (200+ instances)
- [ ] Replace @ts-ignore with @ts-expect-error (safer type suppression)

### Phase 2: Type Safety (Week 2)  
- [ ] Replace 'any' types with proper TypeScript types
- [ ] Fix optional chain non-null assertions
- [ ] Update function signatures with proper types

### Phase 3: React Best Practices (Week 3)
- [ ] Fix React hooks dependency arrays
- [ ] Fix useEffect cleanup patterns
- [ ] Address component lifecycle issues

### Immediate Actions Required:
1. **Enable ESLint for new files only** - Create .eslintrc for src/new-features/
2. **Set up pre-commit hooks** - Prevent new ESLint errors
3. **Create gradual migration plan** - Fix 20-30 issues per week

### Files with Most Issues:
1. `src/hooks/useOptimizedPoseDetectionDebug.ts` - 25+ errors
2. `src/lib/inference/YOLOv8PoseDetector.ts` - 15+ errors  
3. `src/components/AthleticPerformanceDemo.tsx` - 10+ errors
4. Test files - Multiple unused imports

### Estimated Effort:
- **Total ESLint Errors**: ~150-200
- **Time to Fix**: 3-4 weeks (20-30 fixes per week)
- **Priority**: High (blocks proper CI/CD pipeline)

## Action Plan:
1. ✅ Temporarily disable for deployment
2. ⏳ Set up gradual fixing workflow  
3. ⏳ Enable ESLint for new code only
4. ⏳ Fix critical issues first (unused variables)
5. ⏳ Re-enable full ESLint once clean