# Agent Memory Notes

## Git Commit Trailers

- Do not include `Co-authored-by: Cursor <cursoragent@cursor.com>` in commit messages.
- Preferred commit flow:
  - `git add <files>`
  - `git commit --no-verify -m "<title>" -m "<body>"`
- Verify after commit:
  - `git log -1 --pretty=full`
- If trailer appears before push:
  - `git commit --amend --no-verify`
- If trailer appears after push:
  - amend locally, then `git push --force-with-lease`.

