# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `three-collapse`, please report it responsibly.

**Please do not open public GitHub issues for security vulnerabilities.**

### How to Report

1. **Email**: Send details to [your-email@example.com] (replace with your actual email)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity (critical issues within 24-48 hours)

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices for Users

When using `three-collapse` in your projects:

1. **Keep Updated**: Always use the latest version
2. **Audit Dependencies**: Run `npm audit` regularly
3. **Validate Input**: Validate tileset configurations before passing to WFC
4. **GLB Files**: Only load GLB models from trusted sources
5. **Worker Security**: Be aware that Web Workers run in your application context

## Known Security Considerations

### GLB File Loading

The library loads GLB files using Three.js GLTFLoader. Users should:

- Only load GLB files from trusted sources
- Validate GLB file origins in production
- Consider implementing Content Security Policy (CSP) headers

### Web Workers

The WFC algorithm can run in Web Workers. Be aware:

- Workers share the same origin as your application
- Tileset configurations passed to workers should be validated
- Large grid generations may consume significant memory

## Security Updates

Security patches will be released as soon as possible and announced via:

- GitHub Security Advisories
- npm package updates
- GitHub Releases with security tags

## Acknowledgments

We appreciate responsible disclosure from security researchers. Contributors who report valid security issues will be acknowledged in our releases (unless they prefer to remain anonymous).

---

**Last Updated**: October 2025
