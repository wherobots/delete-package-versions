import { context, getOctokit } from "@actions/github";
import { RequestError } from "@octokit/request-error";
import { error, getInput, info, setSecret, warning } from "@actions/core";

export type Octokit = ReturnType<typeof getOctokit>;

export interface WorkflowInput {
  githubToken: string;
  owner: string;
  packageType: string;
  packages: string[];
  versions: string[];
  octokit: Octokit;
}

/**
 * Logs a message.
 *
 * @param header A header (preferably an emoji representing the "feel" of the message) that should be displayed before
 * the message. This is expected to be a single character.
 * @param message The message to display.
 * @param level  The severity level for this message.
 */
function log(
  header: string,
  message: string,
  level: "default" | "error" | "warn" = "default"
): void {
  const loggableMessage = `${header.padEnd(3)}${message}`;
  switch (level) {
    case "default":
      info(loggableMessage);
      break;
    case "error":
      error(loggableMessage);
      break;
    case "warn":
      warning(loggableMessage);
      break;
  }
}

/**
 * Deletes a single tag with the name of {@link tagName}.
 * @param octokit The Octokit instance to use for making API calls to GitHub.
 * @param owner The owner of the repo with the releases to delete.
 * @param packageType The type of package to delete.
 * @param packages The packages to delete.
 * @param versions The versions to delete.
 */
async function deletePackageVersions(
  octokit: Octokit,
  owner: string,
  packageType: string,
  packages: string[],
  versions: string[]
): Promise<void> {
  const pkgType = packageType as
    | "npm"
    | "maven"
    | "rubygems"
    | "docker"
    | "nuget"
    | "container";

  const userInfo = await octokit.rest.users.getByUsername({
    username: owner,
  });
  const userType = userInfo.data.type;
  log("ℹ️", `Owner type is ${userType}`);

  for (const pkg of packages) {
    let allVersions;
    try {
      if (userType === "Organization") {
        allVersions = await octokit.paginate(
          octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg,
          {
            org: owner,
            package_type: pkgType,
            package_name: pkg,
            per_page: 100,
          }
        );
      } else {
        allVersions = await octokit.paginate(
          octokit.rest.packages.getAllPackageVersionsForPackageOwnedByUser,
          {
            username: owner,
            package_type: pkgType,
            package_name: pkg,
            per_page: 100,
          }
        );
      }
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        log("😕", `Package ${pkg} not found. Skipping...`, "warn");
      } else {
        log(
          "🛑",
          `An error occurred while listing package versions for "${pkg}"`,
          "error"
        );
        throw error;
      }
    }

    if (allVersions === undefined) {
      continue;
    }

    const versionsToDelete = allVersions.filter((version) =>
      versions.includes(version.name)
    );
    if (versionsToDelete.length === 0) {
      log("ℹ️", `Package ${pkg} has no matching versions. Skipping...`);
      continue;
    }

    let shouldDeletePackage = false;
    for (const version of versionsToDelete) {
      log(
        "🔄",
        `Deleting package version id=${version.id} name=${version.name} for package ${pkg}`
      );
      try {
        if (userType === "Organization") {
          await octokit.rest.packages.deletePackageVersionForOrg({
            package_type: pkgType,
            package_name: pkg,
            package_version_id: version.id,
            org: owner,
          });
        } else {
          await octokit.rest.packages.deletePackageVersionForUser({
            package_type: pkgType,
            package_name: pkg,
            package_version_id: version.id,
            username: owner,
          });
        }
        log(
          "✅",
          `Deleted package version id=${version.id} name=${version.name} for package ${pkg}`
        );
      } catch (error) {
        if (error instanceof RequestError) {
          if (error.status === 404) {
            log(
              "😕",
              `Package version ${version.id} does not exist for package ${pkg}. Skipping...`
            );
          } else if (error.message.includes("last version of a package")) {
            log(
              "ℹ️",
              `Last version of package ${pkg} cannot be deleted, will delete the package later.`
            );
            shouldDeletePackage = true;
          } else {
            log(
              "🛑",
              `An error occurred while deleting package version id=${version.id} name=${version.name} for package ${pkg}`,
              "error"
            );
            throw error;
          }
        } else {
          log(
            "🛑",
            `An error occurred while deleting package version id=${version.id} name=${version.name} for package ${pkg}`,
            "error"
          );
          throw error;
        }
      }
    }

    if (shouldDeletePackage) {
      log(
        "🔄",
        `Deleting package ${pkg} since there's only one version left to delete`
      );
      try {
        if (userType === "Organization") {
          await octokit.rest.packages.deletePackageForOrg({
            package_type: pkgType,
            package_name: pkg,
            org: owner,
          });
        } else {
          await octokit.rest.packages.deletePackageForUser({
            package_type: pkgType,
            package_name: pkg,
            username: owner,
          });
        }
        log("✅", `Deleted package ${pkg}`);
      } catch (error) {
        if (error instanceof RequestError && error.status === 404) {
          log("😕", `Package ${pkg} does not exist. Skipping...`);
        } else {
          log("🛑", `An error occurred while deleting package ${pkg}`, "error");
          throw error;
        }
      }
    }
  }
}

/**
 * Gets the repo information for the repo that this action should operate on. Defaults to the repo running this action
 * if the repo isn't explicitly set via this action's input.
 */
function getOwner(): string {
  const inputOwner = getInput("owner");

  if (inputOwner) {
    return inputOwner;
  } else {
    // This default should only happen when no input repo at all is provided.
    return context.repo.owner;
  }
}

/**
 * Gets the inputs for this action.
 *
 * @return {Promise<{shouldDeleteReleases: boolean,
 * githubToken: string,
 * repo: {repo: string, owner: string},
 * tagName: string,
 * octokit: import("@octokit/core").Octokit & import("@octokit/plugin-rest-endpoint-methods").restEndpointMethods}>}
 */
export function getInputs(): WorkflowInput {
  const githubToken = getInput("github_token");
  const packageType = getInput("package_type");
  const packages = getInput("packages").split(",");
  const versions = getInput("versions").split(",");
  const owner = getOwner();
  const octokit = getOctokit(githubToken);

  return {
    octokit,
    githubToken,
    owner,
    packageType,
    packages,
    versions,
  };
}

function validateInputField(isValid: any, invalidMessage: string): void {
  if (!isValid) {
    log("🛑", invalidMessage, "error");
    process.exit(1);
  }
}

/**
 * Runs this action using the provided inputs.
 */
export async function run(inputs: WorkflowInput): Promise<void> {
  const { githubToken, octokit, owner, packageType, packages, versions } =
    inputs;

  setSecret(githubToken);

  // Purposefully perform these checks even though the types match because it's possible the inputs were provided
  // directly as environment variables
  validateInputField(packageType, "no tag name provided as an input.");
  validateInputField(githubToken, "no Github token provided");
  validateInputField(owner, "An invalid owner was provided!");
  validateInputField(packages != null, "Invalid packages provided!");
  validateInputField(versions != null, "Invalid versions provided!");

  log("📕", `given owner is "${owner}"`);
  log("📕", `given packageType is "${packageType}"`);
  log("📕", `given packages are "${packages}"`);
  log("🏷", `given versions are "${versions}"`);

  await deletePackageVersions(octokit, owner, packageType, packages, versions);
}
