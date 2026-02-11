# @repo/eslint-config

Shared ESLint configurations for consistent code quality across the monorepo.

## 🎯 Overview

This package provides ESLint configurations for:

- **Base Configuration** - Common rules for all projects
- **Next.js Configuration** - Next.js-specific rules
- **React Internal** - React-specific internal rules

## 📁 Structure

```
.
├── base.js              # Base ESLint configuration
├── next.js              # Next.js configuration
├── react-internal.js    # React internal configuration
└── package.json
```

## 🚀 Getting Started

### Installation

This package is automatically installed as a workspace dependency.

### Usage

Extend the configurations in your `eslint.config.js`:

#### Base Configuration

```javascript
// eslint.config.js
import baseConfig from '@repo/eslint-config/base.js'

export default [
  ...baseConfig,
  // Your custom rules
]
```

#### Next.js Configuration

```javascript
// eslint.config.js (in Next.js app)
import nextConfig from '@repo/eslint-config/next.js'

export default [
  ...nextConfig,
  // Your custom rules
]
```

#### React Internal Configuration

```javascript
// eslint.config.js (for React libraries)
import reactInternalConfig from '@repo/eslint-config/react-internal.js'

export default [
  ...reactInternalConfig,
  // Your custom rules
]
```

## 📝 Configuration Files

### base.js

Base configuration with:

- TypeScript support
- Import/export rules
- Code quality rules
- Best practices

### next.js

Next.js-specific configuration extending base:

- Next.js plugin rules
- React hooks rules
- Next.js best practices

### react-internal.js

React-specific configuration for internal packages:

- React plugin rules
- JSX rules
- React best practices

## 🔧 Customization

You can extend any configuration:

```javascript
import baseConfig from '@repo/eslint-config/base.js'

export default [
  ...baseConfig,
  {
    rules: {
      // Override or add rules
      'no-console': 'warn',
    },
  },
]
```

## 🛠️ Available Scripts

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter <package> lint
```

## 📚 ESLint Rules

The configurations include:

- **TypeScript** - Type checking and best practices
- **Import/Export** - Import ordering and validation
- **Code Quality** - Best practices and common errors
- **React** - React and hooks rules (where applicable)
- **Next.js** - Next.js-specific rules (where applicable)

## 🔍 Troubleshooting

### Rule Conflicts

If you encounter rule conflicts:

1. Check which config you're extending
2. Override conflicting rules in your config
3. Ensure correct plugin versions

### TypeScript Errors

If TypeScript-related linting fails:

1. Ensure TypeScript is installed
2. Check `tsconfig.json` is correct
3. Verify ESLint TypeScript parser is configured

## 🤝 Contributing

When updating configurations:

1. Test changes across all packages
2. Ensure no breaking changes
3. Document new rules
4. Update this README if needed

## 📄 License

MIT
