<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Public health reports use recursive field allowlists in SQL and application code; a dedicated public type keeps private immutable snapshots independent of partial public contracts.
- Public snapshot prose is redacted recursively for known owner/issuer identities and structured personal identifiers; authorized fiscal identity is a separate contract, not public prose.
- Fiscal document authorization selects exactly the same deterministic origin document as the public report; sibling documents cannot be signed through that share.
- Fiscal document signing uses the generated server-only client after the token-authorizing RPC; internal storage paths are not public RPC results.
- Security migration proposals are tested against a standalone synthetic PostgreSQL cluster; shared-database application requires explicit approval separate from code implementation.
- Keep unapproved SQL proposals under docs/security/migrations, outside auto-managed migration directories, so preparing evidence cannot apply a shared-database change.
- Public report validation maps RPC existence separately from report status and preserves explicit authenticity metadata, so anonymous verification does not confuse existence with validity.
- Public share sections are stored as JSONB; normalize string arrays in SQL before membership checks and mirror this production type in isolated tests to prevent schema-only regressions.
- Initialize new home shortcuts once under a profile row lock, preserving empty arrays and all selected entries; durable preferences must survive sessions.
- Keep accumulated readings and shortcut increments in separate RPC contracts, both delegating to commit_event_and_recompose under the official motorcycle lock with retry identities; this preserves existing semantics and prevents lost updates. Reject dates before the last usage-bearing activity to preserve historical snapshots.
