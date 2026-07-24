export type RemoteAppVersion = {
  currentVersion: string;
  buildId: string;
  publishedAt: string;
  releaseMessage: string | null;
  minimumSupportedVersion: string | null;
  forceUpdate: boolean;
  requiresReauthentication: boolean;
};

export type VersionState = {
  updateAvailable: boolean;
  remote: RemoteAppVersion | null;
  lastCheckedAt: number | null;
  lastError: string | null;
};

export type UpdateReason = "build_id" | "app_version" | "unknown";