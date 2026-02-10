# @repo/typescript-config

Shared TypeScript configurations for consistent type checking across the monorepo.

## 🎯 Overview

This package provides TypeScript configurations for:

- **Base Configuration** - Common TypeScript settings
- **Next.js Configuration** - Next.js-specific settings
- **Node.js Configuration** - Node.js/backend settings
- **React Library Configuration** - React library settings

## 📁 Structure

```
.
├── base.json            # Base TypeScript configuration
├── nextjs.json          # Next.js configuration
├── node.json            # Node.js configuration
├── react-library.json   # React library configuration
└── package.json
```

## 🚀 Getting Started

### Installation

This package is automatically installed as a workspace dependency.

### Usage

Extend the configurations in your `tsconfig.json`:

#### Base Configuration

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

#### Next.js Configuration

```json
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": "."
  }
}
```

#### Node.js Configuration

```json
{
  "extends": "@repo/typescript-config/node.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

#### React Library Configuration

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

## 📝 Configuration Files

### base.json

Base configuration with:

- Strict type checking
- Modern ES features
- Module resolution
- Common compiler options

### nextjs.json

Next.js-specific configuration:

- Extends base configuration
- Next.js-specific types
- JSX support
- Path aliases

### node.json

Node.js/backend configuration:

- Extends base configuration
- Node.js types
- ESM support
- Common backend settings

### react-library.json

React library configuration:

- Extends base configuration
- React types
- JSX support
- Library-specific settings

## 🔧 Customization

You can override any setting:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "strict": false,
    "noUnusedLocals": false
  }
}
```

## 🛠️ Available Scripts

```bash
# Type check all packages
pnpm check-types

# Type check specific package
pnpm --filter <package> check-types
```

## 📚 TypeScript Settings

The configurations include:

- **Strict Mode** - Maximum type safety
- **Modern ES** - Latest ECMAScript features
- **Module Resolution** - Node.js module resolution
- **Type Checking** - Comprehensive type checking
- **Path Aliases** - Path mapping support (where applicable)

## 🔍 Common Settings

### Strict Type Checking

All configs enable strict mode:

- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- And more...

### Module Settings

- `module: "ESNext"` or `"CommonJS"` (depending on config)
- `moduleResolution: "bundler"` or `"node"`
- `target: "ES2022"` or higher

### Path Aliases

Next.js config includes path alias support:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

## 🐛 Troubleshooting

### Type Errors

If you encounter type errors:

1. Check your `tsconfig.json` extends the correct config
2. Verify TypeScript version compatibility
3. Ensure all dependencies are installed
4. Check for conflicting type definitions

### Module Resolution Issues

If modules aren't resolving:

1. Check `moduleResolution` setting
2. Verify `baseUrl` and `paths` are correct
3. Ensure `node_modules` types are available

## 🤝 Contributing

When updating configurations:

1. Test changes across all packages
2. Ensure backward compatibility
3. Document breaking changes
4. Update this README if needed

## 📄 License

MIT
