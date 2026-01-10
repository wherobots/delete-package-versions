import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { RequestError } from "@octokit/request-error";
import type { WorkflowInput } from "./index";

// Mock @actions/core
const mockGetInput = jest.fn<() => string>();
const mockInfo = jest.fn<() => void>();
const mockError = jest.fn<() => void>();
const mockWarning = jest.fn<() => void>();
const mockSetSecret = jest.fn<() => void>();

jest.mock("@actions/core", () => ({
  getInput: (...args: unknown[]) => mockGetInput(...(args as [])),
  info: (...args: unknown[]) => {
    mockInfo(...(args as []));
  },
  error: (...args: unknown[]) => {
    mockError(...(args as []));
  },
  warning: (...args: unknown[]) => {
    mockWarning(...(args as []));
  },
  setSecret: (...args: unknown[]) => {
    mockSetSecret(...(args as []));
  },
}));

// Mock @actions/github
const mockGetOctokit = jest.fn<() => unknown>();

jest.mock("@actions/github", () => ({
  getOctokit: (...args: unknown[]) => mockGetOctokit(...(args as [])),
  context: {
    repo: {
      owner: "default-owner",
      repo: "default-repo",
    },
  },
}));

// Import the module under test - must be after jest.mock calls
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { getInputs, run } = require("./index") as typeof import("./index");

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMockOctokit() {
  return {
    rest: {
      users: {
        getByUsername: jest.fn<() => Promise<unknown>>(),
      },
      packages: {
        getAllPackageVersionsForPackageOwnedByOrg:
          jest.fn<() => Promise<unknown>>(),
        getAllPackageVersionsForPackageOwnedByUser:
          jest.fn<() => Promise<unknown>>(),
        deletePackageVersionForOrg: jest.fn<() => Promise<unknown>>(),
        deletePackageVersionForUser: jest.fn<() => Promise<unknown>>(),
        deletePackageForOrg: jest.fn<() => Promise<unknown>>(),
        deletePackageForUser: jest.fn<() => Promise<unknown>>(),
      },
    },
    paginate: jest.fn<() => Promise<unknown>>(),
  };
}

type MockOctokit = ReturnType<typeof createMockOctokit>;

function createInputs(
  mockOctokit: MockOctokit,
  overrides: Partial<Omit<WorkflowInput, "octokit">> = {}
): WorkflowInput {
  return {
    githubToken: "test-token",
    owner: "test-owner",
    packageType: "npm",
    packages: ["test-package"],
    versions: ["1.0.0"],
    octokit: mockOctokit as unknown as WorkflowInput["octokit"],
    ...overrides,
  };
}

describe("Delete package versions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getInputs", () => {
    it("should parse inputs correctly with explicit owner", () => {
      mockGetInput.mockImplementation((): string => "");
      mockGetInput
        .mockReturnValueOnce("test-token") // github_token
        .mockReturnValueOnce("npm") // package_type
        .mockReturnValueOnce("pkg1,pkg2") // packages
        .mockReturnValueOnce("1.0.0,2.0.0") // versions
        .mockReturnValueOnce("test-owner"); // owner

      const mockOctokit = { rest: {} };
      mockGetOctokit.mockReturnValue(mockOctokit);

      const inputs = getInputs();

      expect(inputs.githubToken).toBe("test-token");
      expect(inputs.packageType).toBe("npm");
      expect(inputs.packages).toEqual(["pkg1", "pkg2"]);
      expect(inputs.versions).toEqual(["1.0.0", "2.0.0"]);
      expect(inputs.owner).toBe("test-owner");
      expect(mockGetOctokit).toHaveBeenCalledWith("test-token");
    });

    it("should use context owner when no owner input provided", () => {
      mockGetInput.mockImplementation((): string => "");
      mockGetInput
        .mockReturnValueOnce("test-token") // github_token
        .mockReturnValueOnce("container") // package_type
        .mockReturnValueOnce("my-package") // packages
        .mockReturnValueOnce("latest") // versions
        .mockReturnValueOnce(""); // owner - empty

      const mockOctokit = { rest: {} };
      mockGetOctokit.mockReturnValue(mockOctokit);

      const inputs = getInputs();

      expect(inputs.owner).toBe("default-owner");
    });
  });

  describe("run", () => {
    it("should set the github token as a secret", async () => {
      const mockOctokit = createMockOctokit();
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { type: "User" },
      });
      mockOctokit.paginate.mockResolvedValue([]);

      const inputs = createInputs(mockOctokit);
      await run(inputs);

      expect(mockSetSecret).toHaveBeenCalledWith("test-token");
    });

    it("should log input values at startup", async () => {
      const mockOctokit = createMockOctokit();
      mockOctokit.rest.users.getByUsername.mockResolvedValue({
        data: { type: "User" },
      });
      mockOctokit.paginate.mockResolvedValue([]);

      const inputs = createInputs(mockOctokit);
      await run(inputs);

      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining('given owner is "test-owner"')
      );
      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining('given packageType is "npm"')
      );
    });

    describe("for User owners", () => {
      it("should delete matching package versions", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([
          { id: 123, name: "1.0.0" },
          { id: 456, name: "2.0.0" },
        ]);

        const inputs = createInputs(mockOctokit, { versions: ["1.0.0"] });
        await run(inputs);

        expect(mockOctokit.paginate).toHaveBeenCalledWith(
          mockOctokit.rest.packages.getAllPackageVersionsForPackageOwnedByUser,
          expect.objectContaining({
            username: "test-owner",
            package_type: "npm",
            package_name: "test-package",
          })
        );

        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledWith({
          package_type: "npm",
          package_name: "test-package",
          package_version_id: 123,
          username: "test-owner",
        });

        // Should NOT delete version 2.0.0
        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledTimes(1);
      });

      it("should skip packages with no matching versions", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([
          { id: 123, name: "3.0.0" }, // No match
        ]);

        const inputs = createInputs(mockOctokit, { versions: ["1.0.0"] });
        await run(inputs);

        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).not.toHaveBeenCalled();
        expect(mockInfo).toHaveBeenCalledWith(
          expect.stringContaining("has no matching versions")
        );
      });
    });

    describe("for Organization owners", () => {
      it("should use org-specific API endpoints", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "Organization" },
        });
        mockOctokit.paginate.mockResolvedValue([{ id: 789, name: "1.0.0" }]);

        const inputs = createInputs(mockOctokit, { owner: "test-org" });
        await run(inputs);

        expect(mockOctokit.paginate).toHaveBeenCalledWith(
          mockOctokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg,
          expect.objectContaining({
            org: "test-org",
          })
        );

        expect(
          mockOctokit.rest.packages.deletePackageVersionForOrg
        ).toHaveBeenCalledWith({
          package_type: "npm",
          package_name: "test-package",
          package_version_id: 789,
          org: "test-org",
        });
      });
    });

    describe("error handling", () => {
      it("should skip package when it returns 404", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockRejectedValue(
          new RequestError("Not Found", 404, {
            request: { method: "GET", url: "", headers: {} },
            response: {
              status: 404,
              url: "",
              headers: {},
              data: {},
            },
          })
        );

        const inputs = createInputs(mockOctokit);
        await run(inputs);

        expect(mockWarning).toHaveBeenCalledWith(
          expect.stringContaining("not found")
        );
      });

      it("should skip version when delete returns 404", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([{ id: 123, name: "1.0.0" }]);
        mockOctokit.rest.packages.deletePackageVersionForUser.mockRejectedValue(
          new RequestError("Not Found", 404, {
            request: { method: "DELETE", url: "", headers: {} },
            response: {
              status: 404,
              url: "",
              headers: {},
              data: {},
            },
          })
        );

        const inputs = createInputs(mockOctokit);
        await run(inputs);

        expect(mockInfo).toHaveBeenCalledWith(
          expect.stringContaining("does not exist")
        );
      });

      it("should delete entire package when last version cannot be deleted individually", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([{ id: 123, name: "1.0.0" }]);
        mockOctokit.rest.packages.deletePackageVersionForUser.mockRejectedValue(
          new RequestError("Cannot delete the last version of a package", 400, {
            request: { method: "DELETE", url: "", headers: {} },
            response: {
              status: 400,
              url: "",
              headers: {},
              data: {},
            },
          })
        );

        const inputs = createInputs(mockOctokit);
        await run(inputs);

        expect(
          mockOctokit.rest.packages.deletePackageForUser
        ).toHaveBeenCalledWith({
          package_type: "npm",
          package_name: "test-package",
          username: "test-owner",
        });
      });

      it("should throw on unexpected errors when listing packages", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockRejectedValue(new Error("Unexpected error"));

        const inputs = createInputs(mockOctokit);

        await expect(run(inputs)).rejects.toThrow("Unexpected error");
      });

      it("should throw on unexpected RequestError when deleting versions", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([{ id: 123, name: "1.0.0" }]);
        mockOctokit.rest.packages.deletePackageVersionForUser.mockRejectedValue(
          new RequestError("Server Error", 500, {
            request: { method: "DELETE", url: "", headers: {} },
            response: {
              status: 500,
              url: "",
              headers: {},
              data: {},
            },
          })
        );

        const inputs = createInputs(mockOctokit);

        await expect(run(inputs)).rejects.toThrow("Server Error");
        expect(mockError).toHaveBeenCalled();
      });
    });

    describe("multiple packages", () => {
      it("should process all packages", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([{ id: 1, name: "1.0.0" }]);

        const inputs = createInputs(mockOctokit, {
          packages: ["pkg-a", "pkg-b", "pkg-c"],
        });
        await run(inputs);

        expect(mockOctokit.paginate).toHaveBeenCalledTimes(3);
        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledTimes(3);
      });
    });

    describe("multiple versions", () => {
      it("should delete all matching versions", async () => {
        const mockOctokit = createMockOctokit();
        mockOctokit.rest.users.getByUsername.mockResolvedValue({
          data: { type: "User" },
        });
        mockOctokit.paginate.mockResolvedValue([
          { id: 1, name: "1.0.0" },
          { id: 2, name: "2.0.0" },
          { id: 3, name: "3.0.0" },
        ]);

        const inputs = createInputs(mockOctokit, {
          versions: ["1.0.0", "3.0.0"],
        });
        await run(inputs);

        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledTimes(2);
        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledWith(
          expect.objectContaining({ package_version_id: 1 })
        );
        expect(
          mockOctokit.rest.packages.deletePackageVersionForUser
        ).toHaveBeenCalledWith(
          expect.objectContaining({ package_version_id: 3 })
        );
      });
    });
  });
});
