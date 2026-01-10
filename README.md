# Delete Package Versions

A GitHub Action to delete specific versions of packages from GitHub Packages. Supports both user and organization-owned packages.

## Features

- Delete specific versions from GitHub Packages
- Supports multiple package types: `npm`, `maven`, `rubygems`, `docker`, `nuget`, `container`
- Works with both user and organization-owned packages
- Handles multiple packages and versions in a single run
- Gracefully handles missing packages/versions (logs warning and continues)
- Automatically deletes entire package when removing the last remaining version

## Usage

Add the following step to your workflow:

```yaml
- uses: wherobots/delete-package-versions@v1
  with:
    package_type: maven
    packages: com.wherobots.artifact1,com.wherobots.artifact2
    versions: 0.1.0-SNAPSHOT,0.2.0-SNAPSHOT
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### Inputs

| Input          | Required | Default               | Description                                                                               |
| -------------- | -------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `package_type` | Yes      | -                     | The type of package: `npm`, `maven`, `rubygems`, `docker`, `nuget`, or `container`        |
| `packages`     | Yes      | -                     | Comma-separated list of package names to delete versions from                             |
| `versions`     | Yes      | -                     | Comma-separated list of versions to delete                                                |
| `owner`        | No       | Current repo owner    | Owner (user or org) of the packages. Defaults to the owner of the repo running the action |
| `github_token` | No       | `${{ github.token }}` | A GitHub token with `packages:delete` permission                                          |

### Examples

#### Delete snapshot versions from Maven packages

```yaml
- uses: wherobots/delete-package-versions@v1
  with:
    package_type: maven
    packages: com.example.my-lib,com.example.my-utils
    versions: 1.0.0-SNAPSHOT,2.0.0-SNAPSHOT
```

#### Delete old container images

```yaml
- uses: wherobots/delete-package-versions@v1
  with:
    package_type: container
    packages: my-app
    versions: sha-abc123,sha-def456
    owner: my-organization
```

#### Delete npm package versions with custom token

```yaml
- uses: wherobots/delete-package-versions@v1
  with:
    package_type: npm
    packages: "@myorg/my-package"
    versions: 0.0.1-beta.1,0.0.1-beta.2
    github_token: ${{ secrets.PACKAGES_TOKEN }}
```

### Required Permissions

The `github_token` needs the following permissions:

- `packages: write` (for deleting package versions)
- `read:packages` (for listing package versions)

If using the default `GITHUB_TOKEN`, ensure your workflow has these permissions:

```yaml
permissions:
  packages: write
```

## Developing

### Prerequisites

- [Node.js 20](https://nodejs.org/en/download) or later

### Setup

```shell
git clone https://github.com/wherobots/delete-package-versions.git
cd delete-package-versions
npm install
```

### Running Tests

```shell
npm test
```

### Building

Since this is a GitHub Action, **every commit that changes code must include an updated bundle**. Generate a new bundle with:

```shell
npm run package
```

Then commit the resulting changes in the `dist/` folder.

### Linting

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for formatting.

```shell
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

## Releasing

Releases are created by tagging a new version:

```shell
git checkout main
git fetch origin
git pull

# Bump version (patch, minor, or major)
npm version <patch|minor|major>

# Push with tags
git push --follow-tags
```

This updates `package.json`, creates a commit, and creates a Git tag. The `--follow-tags` flag ensures the tag is pushed.

## License

ISC
