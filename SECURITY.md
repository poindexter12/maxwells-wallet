# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | No |

## Reporting a Vulnerability

If you discover a security vulnerability in Maxwell's Wallet, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Use [GitHub's private vulnerability reporting](https://github.com/poindexter12/maxwells-wallet/security/advisories/new) to submit a report.
3. Include:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You should receive an acknowledgment within 72 hours. We will work with you to understand the issue and coordinate a fix before any public disclosure.

## Security Measures

This project uses automated security scanning:

- **Semgrep** for static application security testing (SAST)
- **OWASP Dependency-Check** for known vulnerabilities in dependencies
- **Trivy** for container image scanning
- **OpenSSF Scorecard** for supply chain security posture
- **Dependabot** for automated dependency updates
