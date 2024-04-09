# GitHub Action: Delete GitHub package versions

## Usage
Add following step to your workflow:

```yaml
- uses: wherobots/delete-package-versions@v1.0.0
  with:
    package_type: maven #(required) - The type of the package, could be maven or npm.
    packages: com.wherobots.artifact1,com.wherobots,artifact2 #(required) - The list of packages deliminated by comma (,)
    versions: 0.1.2 #(required) - The versions of the packages to delete, could be multiple versions deliminated by comma (,)
    owner: <owner> #(optional) Owner of the repo containing the package version to delete. Defaults to the owner of the repo running the action. 
    github_token: ${{ secrets.GITHUB_TOKEN }} # (optional) - A GitHub token with delete access to packages. Will use {{ secrets.GITHUB_TOKEN }} if not explicitly specified.
```

## Developing

You can follow these instructions to get this project cloned to your local machine and ready for development. Note that
development requires at least [Node 20](https://nodejs.org/en/download) to be installed on your computer.

```shell
git clone https://github.com/wherobots/delete-package-versions.git
cd delete-tag-and-release
npm install
```

Tests can be run via:

```shell
npm test
```

Since this is a repo for a [GitHub Action](https://docs.github.com/en/actions), **every new commit that changes code must include a new bundle.** You can 
generate a new bundle via running:

```shell
npm run package
```

and committing the resulting changes that will be in the `dist/` folder.

### Formatting and linting

This project uses [ESLint](https://eslint.org/) for linting and [Prettier](https://prettier.io/) for source code formatting. You can run the lint checks by running:

```shell
npm run lint
```

If you have lint errors that are automatically fixable, you can fix those by running:

```shell
npm run lint:fix
```

## Releasing

Releases are done by creating a new tag and pushing that tag to the repo. A new
release can be made via the following:

```shell
git checkout master
git fetch
git pull
# choose either patch, minor, or major. See https://docs.npmjs.com/cli/v8/commands/npm-version#description for more info
npm version <patch/minor/major>
git push --follow-tags
```

This will update the version in the `package.json`, create a new commit based off of the master branch, and create a 
new Git tag with that version that points to the new commit. Remember to use the `--follow-tags` flag when running 
`git push`! Without it, the new tag won't be pushed.

