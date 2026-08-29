# Releasing Lacewing

Lacewing follows semantic versioning. GitHub release tags must match the
`version` in `manifest.json` exactly, without a `v` prefix.

## Prepare a release

1. Update the version in `manifest.json` and `package.json`.
2. Add the version and minimum supported Obsidian version to `versions.json`.
3. Add release notes to `CHANGELOG.md`.
4. Run the complete release gate:

   ```sh
   pnpm install --frozen-lockfile
   pnpm release:check
   ```

5. Confirm `git status` contains only the intended release changes.
6. Commit the release and tag that commit with the exact manifest version.

## Publish on GitHub

Push the branch and tag, then create a GitHub release containing exactly these
binary attachments:

- `main.js`
- `manifest.json`
- `styles.css`

Example for version `1.0.0`:

```sh
git tag 1.0.0
git push origin main
git push origin 1.0.0
gh release create 1.0.0 main.js manifest.json styles.css \
  --title "Lacewing 1.0.0" \
  --notes-file CHANGELOG.md
```

Do not commit `main.js`; Obsidian installs the bundle from the GitHub release.

After publishing, download each attachment from the release page and run
`pnpm release:check` against the local sources one final time.

## Initial Community Plugins submission

The initial release also requires a one-time submission through the Obsidian
Community directory:

1. Sign in at <https://community.obsidian.md>.
2. Connect the GitHub account that owns the repository.
3. Add a plugin using the public GitHub repository URL.
4. Resolve every automated review error and warning that applies to the
   release.
5. Publish the directory entry when the review passes.

Future versions only require a new GitHub release. They do not need a new
directory submission.
