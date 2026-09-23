# Security policy

The latest published release is the supported version. Update to it before reporting a vulnerability when you can do so safely.

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/codywilliamson/diffle/security/advisories/new). Include the affected version, reproduction steps, and impact. Do not put exploit details or secrets in a public issue. Expect an initial response within seven days.

The installers verify downloaded binaries against the release's `checksums.txt` using SHA-256. The diffle server binds to localhost, and the update check contacts GitHub Releases. If a report concerns either path, include the install or update command and your OS and architecture.
