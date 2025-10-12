# Security Checklist for Public npm Package

Before publishing your package to npm from a public GitHub repository, review these security considerations.

## ✅ Pre-Publishing Security Checklist

### 1. Secrets and Credentials

- [ ] **No API keys** in code or config files
- [ ] **No passwords** or tokens in source code
- [ ] **No private URLs** or internal endpoints
- [ ] **No hardcoded credentials** anywhere
- [ ] Check `.env` files are in `.gitignore`
- [ ] Review all configuration files for sensitive data

**How to check:**

```bash
# Search for common patterns
git grep -i "api_key"
git grep -i "apikey"
git grep -i "password"
git grep -i "secret"
git grep -i "token"
git grep -i "AUTH"

# Check for .env files
find . -name ".env*" -not -path "./node_modules/*"
```

### 2. Git History Audit

Even if you remove secrets now, they might exist in git history.

```bash
# Search entire git history for secrets
git log -p | grep -i "api_key"
git log -p | grep -i "password"

# Use git-secrets (install first)
# brew install git-secrets
git secrets --scan-history

# Or use gitleaks (install first)
# brew install gitleaks
gitleaks detect --verbose
```

**If you find secrets in history:**

1. Change those credentials immediately
2. Consider using `git filter-repo` or BFG Repo-Cleaner to remove them
3. Force push (coordinate with team if applicable)

### 3. npm Token Security

**Never commit your npm token!**

- [ ] npm token is NOT in any files
- [ ] npm token is NOT in git history
- [ ] `.npmrc` is in `.gitignore` (if it contains tokens)

**Check your `.gitignore` includes:**

```
.npmrc
.env
.env.local
*.log
*.key
*.pem
secrets/
```

### 4. Dependency Security

Check for vulnerabilities in your dependencies:

```bash
# Run npm audit
npm audit

# Fix vulnerabilities automatically
npm audit fix

# For breaking changes
npm audit fix --force

# Generate full report
npm audit --json > audit-report.json
```

**Review dependencies:**

- [ ] All dependencies are from trusted sources
- [ ] No unnecessary dependencies
- [ ] Dependencies are up to date
- [ ] No deprecated packages

### 5. Package Contents Review

Verify what will be published:

```bash
# See what will be included
npm pack --dry-run

# Create actual tarball to inspect
npm pack
tar -tzf three-collapse-1.0.0.tgz

# Or extract and review
tar -xzf three-collapse-1.0.0.tgz
cd package
ls -la
```

**Verify:**

- [ ] No sensitive files are included
- [ ] Demo assets don't contain sensitive data
- [ ] Only intended files are in the package
- [ ] `.npmignore` is properly configured

### 6. npm Account Security

**Enable 2FA (Two-Factor Authentication):**

```bash
# Enable 2FA for publishing
npm profile enable-2fa auth-and-writes

# Or for auth only
npm profile enable-2fa auth-only
```

**Check your npm profile:**

```bash
npm profile get
```

- [ ] 2FA is enabled on your npm account
- [ ] Strong password on npm account
- [ ] Email verified on npm account
- [ ] Recovery method configured

### 7. Repository Access Control

- [ ] Review who has write access to the repository
- [ ] Enable branch protection on main/master
- [ ] Require pull request reviews
- [ ] Enable "Require status checks to pass"
- [ ] Consider using GitHub's security features

**GitHub Security Settings:**

- Go to Settings → Security & analysis
- Enable: Dependency graph
- Enable: Dependabot alerts
- Enable: Dependabot security updates
- Enable: Secret scanning (if available)

### 8. Code Quality and Integrity

- [ ] All code is reviewed and understood
- [ ] No minified or obfuscated code (without source)
- [ ] No suspicious external scripts
- [ ] Build process is transparent and reproducible

```bash
# Verify build is clean
rm -rf dist/lib node_modules
npm install
npm run build:lib
```

### 9. License and Legal

- [ ] LICENSE file is present and correct
- [ ] All dependencies' licenses are compatible
- [ ] No copyrighted code without permission
- [ ] No GPL code if you want MIT license

**Check licenses:**

```bash
npx license-checker --summary
```

### 10. Documentation Review

- [ ] README doesn't expose internal infrastructure
- [ ] No sensitive URLs or endpoints in docs
- [ ] Examples use placeholder/example data
- [ ] Contact info is appropriate for public package

### 11. CI/CD Security (If Using)

If using GitHub Actions or other CI/CD:

- [ ] Secrets are stored in GitHub Secrets (not in code)
- [ ] npm token uses minimal permissions
- [ ] Workflows don't expose secrets in logs
- [ ] Use `secrets.NPM_TOKEN` not hardcoded tokens

**Example secure workflow:**

```yaml
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

### 12. Package.json Security Fields

Add security-related fields:

```json
{
  "name": "three-collapse",
  "repository": {
    "type": "git",
    "url": "https://github.com/niko-dellic/three-collapse.git"
  },
  "bugs": {
    "url": "https://github.com/niko-dellic/three-collapse/issues"
  },
  "funding": {
    "type": "github",
    "url": "https://github.com/sponsors/niko-dellic"
  }
}
```

## 🔒 Post-Publishing Security

### Monitor Your Package

1. **Set up alerts:**

   - GitHub Security Advisories
   - npm security advisories
   - Dependabot alerts

2. **Monitor downloads:**

   ```bash
   npm info three-collapse
   ```

3. **Check for impersonation:**
   - Search for similar package names
   - Report any malicious clones

### Responding to Security Issues

Create `SECURITY.md` in your repository:

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please email security@example.com

**Please do not open public issues for security vulnerabilities.**

We will respond within 48 hours.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Security Updates

Security updates will be released as patches as soon as possible.
```

### npm Package Provenance

**Enable provenance** (requires npm 9.5.0+):

```bash
npm publish --provenance
```

This creates a publicly verifiable link between your package and its source code.

## 🚨 Common Security Mistakes to Avoid

### ❌ DON'T:

- Commit `.npmrc` with auth tokens
- Include `.env` files in the package
- Use `console.log()` to debug with sensitive data
- Store secrets in package.json
- Use HTTP for loading external resources
- Trust user input without validation
- Include test/fixture data with real credentials

### ✅ DO:

- Use environment variables for secrets
- Enable 2FA on npm account
- Regularly update dependencies
- Review all code before publishing
- Use `.gitignore` and `.npmignore` properly
- Run `npm audit` regularly
- Keep dependencies minimal

## 🔍 Security Scanning Tools

### Recommended Tools

1. **npm audit** (built-in)

   ```bash
   npm audit
   ```

2. **git-secrets** (prevent committing secrets)

   ```bash
   brew install git-secrets
   git secrets --install
   git secrets --register-aws
   ```

3. **gitleaks** (detect secrets in git)

   ```bash
   brew install gitleaks
   gitleaks detect
   ```

4. **snyk** (vulnerability scanning)

   ```bash
   npm install -g snyk
   snyk test
   ```

5. **retire.js** (check for vulnerable JS libs)
   ```bash
   npm install -g retire
   retire
   ```

## 📋 Quick Security Audit Script

Create `security-check.sh`:

```bash
#!/bin/bash

echo "🔍 Running security checks..."

echo "\n1. Checking for secrets..."
git grep -i "api_key" || echo "✓ No API keys found"
git grep -i "password" || echo "✓ No passwords found"

echo "\n2. Checking npm audit..."
npm audit

echo "\n3. Checking package contents..."
npm pack --dry-run

echo "\n4. Checking for .env files..."
find . -name ".env*" -not -path "./node_modules/*" || echo "✓ No .env files"

echo "\n5. Checking dependencies..."
npm outdated

echo "\n✅ Security check complete!"
```

Run before publishing:

```bash
chmod +x security-check.sh
./security-check.sh
```

## 🎯 Your Specific Package Review

For `three-collapse`, specifically check:

- [ ] GLB model files in `/public/models/` don't contain sensitive data
- [ ] Demo code doesn't use real API endpoints
- [ ] Example tilesets don't reference internal resources
- [ ] No hardcoded paths to your local machine
- [ ] No personal information in demo files
- [ ] GitHub URLs all point to correct repository

## 📞 If You Discover a Security Issue

**After publishing:**

1. **Don't panic**
2. **Assess the severity**
3. **Fix the issue immediately**
4. **Publish a new version ASAP**
5. **Deprecate the vulnerable version:**
   ```bash
   npm deprecate three-collapse@1.0.0 "Security issue fixed in 1.0.1"
   ```
6. **Notify users** via GitHub release notes
7. **Consider if you need to unpublish** (only if really critical and within 72h)

## 🔐 Npm Token Best Practices

When creating npm tokens:

```bash
# Create a token with minimal permissions
npm token create --read-only  # For reading only
npm token create              # For publishing

# List your tokens
npm token list

# Revoke a token if compromised
npm token revoke <token-id>
```

**Token types:**

- **Automation tokens** - for CI/CD (no 2FA required)
- **Publish tokens** - for manual publishing (2FA required)
- **Read-only tokens** - for downloading private packages

## ✅ Final Pre-Publish Command

Run this before `npm publish`:

```bash
# Complete security check
npm audit && \
npm pack --dry-run && \
git status && \
echo "✅ Ready to publish!"
```

---

## 📚 Additional Resources

- [npm Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## 🎉 You're Secure!

Once you've completed this checklist, you're ready to publish safely!

```bash
npm run build:lib
npm publish
```
