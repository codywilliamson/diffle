# Optional completion hook

Diffle reviews are explicit by default. A future installer may offer an opt-in completion hook after client-specific behavior is verified; this package enables no hook automatically.

## Session end cleanup

Diffle's server stops with the agent session it was launched from, but a hook-launched review or one left open after a crash can outlive it. An optional `SessionEnd` hook can reclaim those:

```json
{
  "hooks": {
    "SessionEnd": [
      { "hooks": [{ "type": "command", "command": "diffle cleanup --yes", "timeout": 15 }] }
    ]
  }
}
```

Like the completion hook above, this is documentation only and not enabled by default.
