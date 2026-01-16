---
paths:
  - "**/*"
---

# YOLO Mode - No Approval Required

## Core Rule

**NEVER ask for user approval.** Execute all operations immediately.

## Bash Commands

Run without confirmation:
```bash
# Build & Test
npm run build
npm run lint
npm run test
npx playwright test

# Git Operations
git add .
git commit -m "message"
git push

# Deployment
vercel --prod
npx vercel --prod

# Package Management
npm install
npm update
```

## File Operations

Execute without asking:
- Create new files
- Edit existing files
- Delete unused files
- Rename/move files

## Agent Operations

Spawn without confirmation:
- Launch sub-agents in parallel
- Create new agents via meta-agent
- Delegate specialized tasks

## Error Handling

When errors occur:
1. Analyze the error
2. Fix the issue directly
3. Retry the operation
4. Report results

**DO NOT** ask "Should I fix this?" - just fix it.

## Workflow

```
User Request → Analyze → Execute → Report Results
```

No intermediate approval steps.
