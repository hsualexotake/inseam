# Contributing Guide

## Package Manager

**IMPORTANT: This project uses Yarn exclusively. Do not use npm, pnpm, or bun.**

### Why Yarn?
- This monorepo is configured with Yarn workspaces
- The `packageManager` field in package.json specifies `yarn@1.22.19`
- Using other package managers will create conflicts and errors

### Package Manager Commands

Always use `yarn` instead of `npm`:

| Task | Command | Description |
|------|---------|-------------|
| Install dependencies | `yarn` or `yarn install` | Install all dependencies |
| Start development | `yarn dev` | Start all apps in dev mode |
| Run linting | `yarn lint` | Lint all packages |
| Fix linting issues | `yarn lint:fix` | Auto-fix linting issues |
| Type checking | `yarn typecheck` | Run TypeScript type checking |
| Build | `yarn build` | Build all packages |
| Clean | `yarn clean` | Clean build artifacts |
| Add dependency | `yarn add [package]` | Add to root |
| Add to workspace | `yarn workspace [name] add [package]` | Add to specific workspace |

## Prerequisites

### Node Version
- Required: Node.js >= 18.8.0
- Recommended: Node.js 22.18.0 (see `.nvmrc`)

To use the correct Node version with nvm:
```bash
nvm use
```

### Environment Setup

1. **Install Yarn globally** (if not already installed):
   ```bash
   # Using corepack (recommended, comes with Node.js 16+)
   corepack enable
   corepack prepare yarn@1.22.19 --activate
   
   # Or using your system package manager
   # macOS: brew install yarn
   # Ubuntu/Debian: sudo apt install yarn
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Set up environment variables**:
   - Copy `.env.example` to `.env.local` in each app directory
   - Add required API keys and configuration

## Project Structure

```
.
├── apps/
│   ├── native/     # React Native (Expo) mobile app
│   └── web/        # Next.js web application
├── packages/
│   └── backend/    # Convex backend
└── turbo.json      # Turborepo configuration
```

## Development Workflow

### Starting Development Servers

```bash
yarn dev
```

This starts:
- Convex backend dev server
- Next.js web app (port 3000/3001)
- Expo development server

### Working with Individual Apps

```bash
# Web app only
yarn workspace web-app dev

# Native app only
yarn workspace native-app dev

# Backend only
yarn workspace @packages/backend dev
```

## Common Issues

### Issue: Node version mismatch errors
**Solution**: Ensure you're using Node >= 18.8.0 with `nvm use`

### Issue: `package-lock.json` exists
**Solution**: Delete it and use `yarn.lock` only:
```bash
rm package-lock.json
yarn install
```

### Issue: Port already in use
**Solution**: The dev servers will automatically use alternative ports

## Code Quality

### Before Committing

Always run these commands before committing:

```bash
yarn lint
yarn typecheck
```

To auto-fix linting issues:
```bash
yarn lint:fix
```

### Git Hooks

This project uses git hooks to ensure code quality. Commits will be blocked if:
- Linting errors exist
- TypeScript errors exist
- Tests fail (when implemented)

## Troubleshooting

### Clear all caches and reinstall

```bash
# Remove all node_modules and caches
rm -rf node_modules apps/*/node_modules packages/*/node_modules
yarn cache clean

# Reinstall
yarn install
```

### Reset Convex backend

```bash
cd packages/backend
yarn convex dev --clear
```

## Important Notes

1. **Never use `npm install`** - This will create a `package-lock.json` file and cause conflicts
2. **Always use `yarn add`** to add new dependencies
3. **The `.gitignore` blocks all lock files except `yarn.lock`** to prevent accidents
4. **Run `yarn audit` periodically** to check for security vulnerabilities

## Getting Help

If you encounter issues:
1. Check this guide first
2. Ensure you're using yarn and the correct Node version
3. Try clearing caches and reinstalling
4. Check the [Turborepo docs](https://turbo.build/repo/docs)
5. Check the [Convex docs](https://docs.convex.dev)