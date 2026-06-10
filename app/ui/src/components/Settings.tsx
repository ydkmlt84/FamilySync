import { clsx } from "clsx";
import { Link2, RefreshCw, Shield, Trash2, Unlink, Users } from "lucide-react";
import type {
  CronJobSettings,
  IntegrationSettings,
  JobsSettings,
  LinkedUser,
  LowRatedSettings,
  ManagedHomeUser,
  MovieLibrarySelection,
  ProtectedTagSettings,
  SyncJobStatus,
} from "../api";
import type { SettingsTab } from "../types";
import { Badge, Metric, SyncProgress } from "./Primitives";

export function SettingsTabs({
  activeTab,
  onChange,
}: {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}) {
  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "libraries", label: "Libraries" },
    { id: "protection", label: "Tags" },
    { id: "connections", label: "Connections" },
    { id: "jobs", label: "Jobs" },
  ];

  return (
    <div className="overflow-x-auto border-b border-[#263245]">
      <div className="flex min-w-max gap-2 py-3">
        {tabs.map((tab) => (
          <button
            className={clsx(
              "rounded-md px-3 py-2 text-sm font-medium transition hover:bg-[#1f2937]",
              activeTab === tab.id
                ? "bg-[#0ea5e9] text-white"
                : "bg-[#111827] text-[#94a3b8]",
            )}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ManagedHomeUsersPanel({
  importingUserId,
  onImport,
  onPinChange,
  onRefresh,
  pins,
  refreshing,
  users,
}: {
  importingUserId?: string;
  onImport: (user: ManagedHomeUser) => void;
  onPinChange: (userId: string, pin: string) => void;
  onRefresh: () => void;
  pins: Record<string, string>;
  refreshing: boolean;
  users: ManagedHomeUser[];
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827]">
      <div className="flex items-center justify-between border-b border-[#263245] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users size={18} />
          <h2 className="text-base font-semibold">Plex Home Managed Users</h2>
        </div>
        <button
          className="rounded-md p-2 hover:bg-[#1f2937] disabled:opacity-50"
          disabled={refreshing}
          onClick={onRefresh}
          title="Refresh managed users"
          type="button"
        >
          <RefreshCw className={clsx(refreshing && "animate-spin")} size={17} />
        </button>
      </div>
      {users.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[#94a3b8]">
          No managed Plex Home users were found for the linked admin account.
        </p>
      ) : (
        <div className="divide-y divide-[#263245]">
          {users.map((user) => (
            <div
              className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]"
              key={user.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                {user.thumb ? (
                  <img
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                    src={user.thumb}
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#334155] text-sm font-semibold">
                    {user.title.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.title}</p>
                    <Badge label={user.linked ? "Imported" : "Managed"} />
                    {user.protected && <Badge label="PIN" muted />}
                  </div>
                  <p className="text-xs text-[#94a3b8]">
                    Plex Home user {user.id}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {!user.linked && user.protected && (
                  <input
                    className="w-28 rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
                    onChange={(event) =>
                      onPinChange(user.id, event.target.value)
                    }
                    placeholder="PIN"
                    type="password"
                    value={pins[user.id] ?? ""}
                  />
                )}
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-[#334155] px-3 py-2 text-sm hover:bg-[#1f2937] disabled:opacity-50"
                  disabled={user.linked || importingUserId === user.id}
                  onClick={() => onImport(user)}
                  type="button"
                >
                  {importingUserId === user.id ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                  {user.linked
                    ? "Imported"
                    : importingUserId === user.id
                      ? "Importing"
                      : "Import"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UsersSettingsPanel({
  currentUser,
  importingManagedUserId,
  managedHomePins,
  managedHomeUsers,
  onImportManagedUser,
  onManagedHomePinChange,
  onRefreshManagedUsers,
  onRefreshUsers,
  onRemoveUser,
  onSyncUser,
  onToggleUser,
  pendingUserAction,
  refreshingManagedUsers,
  refreshingUsers,
  syncingUserId,
  users,
}: {
  currentUser: LinkedUser;
  importingManagedUserId?: string;
  managedHomePins: Record<string, string>;
  managedHomeUsers: ManagedHomeUser[];
  onImportManagedUser: (user: ManagedHomeUser) => void;
  onManagedHomePinChange: (userId: string, pin: string) => void;
  onRefreshManagedUsers: () => void;
  onRefreshUsers: () => void;
  onRemoveUser: (userId: string) => void;
  onSyncUser: (user: LinkedUser) => void;
  onToggleUser: (user: LinkedUser) => void;
  pendingUserAction?: string;
  refreshingManagedUsers: boolean;
  refreshingUsers: boolean;
  syncingUserId?: string;
  users: LinkedUser[];
}) {
  return (
    <>
      <div className="rounded-md border border-[#263245] bg-[#111827]">
        <div className="flex items-center justify-between border-b border-[#263245] px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <h2 className="text-base font-semibold">Linked Users</h2>
          </div>
          <button
            className="rounded-md p-2 hover:bg-[#1f2937]"
            disabled={refreshingUsers}
            onClick={onRefreshUsers}
            title="Refresh users"
          >
            <RefreshCw
              className={clsx(refreshingUsers && "animate-spin")}
              size={17}
            />
          </button>
        </div>
        <div className="divide-y divide-[#263245]">
          {users.length === 0 && (
            <p className="px-4 py-5 text-sm text-[#94a3b8]">
              No Plex users linked yet.
            </p>
          )}
          {users.map((user) => (
            <div
              className="grid gap-3 px-4 py-3 sm:grid-cols-[1fr_auto]"
              key={user.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                {user.plexThumb ? (
                  <img
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                    src={user.plexThumb}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-[#334155]" />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{user.plexUsername}</p>
                    {user.isAdmin && <Badge label="Admin" />}
                    {user.isManaged && <Badge label="Managed" />}
                    <Badge
                      label={user.enabled ? "Enabled" : "Disabled"}
                      muted={!user.enabled}
                    />
                  </div>
                  <p className="text-sm text-[#94a3b8]">
                    Last sync{" "}
                    {user.lastSyncAt
                      ? new Date(user.lastSyncAt).toLocaleString()
                      : "never"}
                  </p>
                  {user.plexServerName && (
                    <p className="text-xs text-[#94a3b8]">
                      Server {user.plexServerName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                  disabled={syncingUserId === user.id}
                  onClick={() => onSyncUser(user)}
                  title="Sync this user's ratings"
                >
                  <RefreshCw
                    className={clsx(
                      syncingUserId === user.id && "animate-spin",
                    )}
                    size={17}
                  />
                </button>
                {!user.isAdmin && (
                  <>
                    <button
                      className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                      disabled={pendingUserAction?.startsWith(`${user.id}:`)}
                      onClick={() => onToggleUser(user)}
                      title={user.enabled ? "Disable user" : "Enable user"}
                    >
                      {pendingUserAction === `${user.id}:toggle` ? (
                        <RefreshCw className="animate-spin" size={17} />
                      ) : (
                        <Unlink size={17} />
                      )}
                    </button>
                    <button
                      className="rounded-md border border-[#334155] p-2 hover:bg-[#1f2937] disabled:opacity-50"
                      disabled={pendingUserAction?.startsWith(`${user.id}:`)}
                      onClick={() => onRemoveUser(user.id)}
                      title="Remove user"
                    >
                      {pendingUserAction === `${user.id}:remove` ? (
                        <RefreshCw className="animate-spin" size={17} />
                      ) : (
                        <Trash2 size={17} />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {currentUser.isAdmin && (
        <ManagedHomeUsersPanel
          importingUserId={importingManagedUserId}
          onImport={onImportManagedUser}
          onPinChange={onManagedHomePinChange}
          onRefresh={onRefreshManagedUsers}
          pins={managedHomePins}
          refreshing={refreshingManagedUsers}
          users={managedHomeUsers}
        />
      )}
    </>
  );
}

export function LibrarySettingsCard({
  emptyMessage,
  itemLabel,
  libraries,
  onToggle,
  title,
  description,
}: {
  emptyMessage: string;
  itemLabel: string;
  libraries?: MovieLibrarySelection;
  onToggle: (libraryKey: string) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Users size={18} />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="mt-4 space-y-2">
        {libraries?.libraries.length === 0 && (
          <p className="text-sm text-[#94a3b8]">{emptyMessage}</p>
        )}
        {libraries?.libraries.map((library) => (
          <label
            className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm hover:bg-[#1f2937]"
            key={library.key}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">
                {library.title}
              </span>
              <span className="text-xs text-[#94a3b8]">
                {library.count ?? "-"} {itemLabel}
              </span>
            </span>
            <input
              checked={library.selected}
              className="h-4 w-4 accent-[#38bdf8]"
              onChange={() => onToggle(library.key)}
              type="checkbox"
            />
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-[#94a3b8]">{description}</p>
    </div>
  );
}

export function TagSettingsPanel({
  lowRatedSettings,
  onLowRatedChange,
  onProtectedTagChange,
  onProtectionThresholdChange,
  protectedTagSettings,
  protectionThreshold,
}: {
  lowRatedSettings?: LowRatedSettings;
  onLowRatedChange: (settings: LowRatedSettings) => void;
  onProtectedTagChange: (settings: ProtectedTagSettings) => void;
  onProtectionThresholdChange: (value: number) => void;
  protectedTagSettings?: ProtectedTagSettings;
  protectionThreshold: number;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">Tags</h2>
      </div>
      {protectedTagSettings && (
        <div className="mt-4 rounded-md border border-[#263245] p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Protected tag</span>
              <span className="text-xs text-[#94a3b8]">
                Tag media when any linked user rating meets the threshold.
              </span>
            </span>
            <input
              checked={protectedTagSettings.enabled}
              className="h-4 w-4 accent-[#38bdf8]"
              onChange={(event) =>
                onProtectedTagChange({
                  ...protectedTagSettings,
                  enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Tag name</span>
              <input
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                defaultValue={protectedTagSettings.tagName}
                onBlur={(event) =>
                  onProtectedTagChange({
                    ...protectedTagSettings,
                    tagName: event.target.value,
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Any rating at or above</span>
              <input
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                defaultValue={protectionThreshold}
                max={10}
                min={0}
                onBlur={(event) =>
                  onProtectionThresholdChange(Number(event.target.value))
                }
                step={0.5}
                type="number"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm sm:col-span-2">
              <span className="text-[#94a3b8]">
                Remove when no longer protected
              </span>
              <input
                checked={protectedTagSettings.removeTagsWhenUnprotected}
                className="h-4 w-4 accent-[#38bdf8]"
                onChange={(event) =>
                  onProtectedTagChange({
                    ...protectedTagSettings,
                    removeTagsWhenUnprotected: event.target.checked,
                  })
                }
                type="checkbox"
              />
            </label>
          </div>
        </div>
      )}
      {lowRatedSettings && (
        <div className="mt-4 rounded-md border border-[#263245] p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">Low-rated tag</span>
              <span className="text-xs text-[#94a3b8]">
                Tag media when enough linked users rate it poorly.
              </span>
            </span>
            <input
              checked={lowRatedSettings.enabled}
              className="h-4 w-4 accent-[#38bdf8]"
              onChange={(event) =>
                onLowRatedChange({
                  ...lowRatedSettings,
                  enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Tag name</span>
              <input
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                defaultValue={lowRatedSettings.tagName}
                onBlur={(event) =>
                  onLowRatedChange({
                    ...lowRatedSettings,
                    tagName: event.target.value,
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Average at or below</span>
              <input
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                defaultValue={lowRatedSettings.averageThreshold}
                max={10}
                min={0}
                onBlur={(event) =>
                  onLowRatedChange({
                    ...lowRatedSettings,
                    averageThreshold: Number(event.target.value),
                  })
                }
                step={0.5}
                type="number"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94a3b8]">Minimum ratings</span>
              <input
                className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
                defaultValue={lowRatedSettings.minimumRatings}
                min={1}
                onBlur={(event) =>
                  onLowRatedChange({
                    ...lowRatedSettings,
                    minimumRatings: Number(event.target.value),
                  })
                }
                type="number"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
              <span className="text-[#94a3b8]">
                Remove when no longer low-rated
              </span>
              <input
                checked={lowRatedSettings.removeTagsWhenNotLowRated}
                className="h-4 w-4 accent-[#38bdf8]"
                onChange={(event) =>
                  onLowRatedChange({
                    ...lowRatedSettings,
                    removeTagsWhenNotLowRated: event.target.checked,
                  })
                }
                type="checkbox"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-[#94a3b8]">
            Default rule: at least 2 ratings and average 4 or lower.
          </p>
        </div>
      )}
    </div>
  );
}

export function AdminConnectionCard({
  currentUser,
  linkedUserCount,
}: {
  currentUser: LinkedUser;
  linkedUserCount: number;
}) {
  return (
    <div className="rounded-md border border-[#263245] bg-[#020617] p-4">
      <div className="rounded-md bg-[#111827] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#263245] pb-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {currentUser.plexServerName ?? "Configured Plex server"}
            </p>
            <p className="text-xs text-[#94a3b8]">
              Current FamilySync connection
            </p>
          </div>
          <Badge
            label={currentUser.enabled ? "Linked" : "Disabled"}
            muted={!currentUser.enabled}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric label="Your role" value="Admin" />
          <Metric label="Linked users" value={linkedUserCount} />
        </div>
        <p className="mt-4 text-sm text-[#94a3b8]">
          Admin-only controls are available on this settings page.
        </p>
      </div>
    </div>
  );
}

export function IntegrationSettingsCard({
  label,
  pendingAction,
  settings,
  onChange,
  onSave,
  onTest,
}: {
  label: "Radarr" | "Sonarr";
  pendingAction?: "save" | "test";
  settings: IntegrationSettings;
  onChange: (settings: IntegrationSettings) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  function update<K extends keyof IntegrationSettings>(
    key: K,
    value: IntegrationSettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }

  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <Shield size={18} />
        <h2 className="text-base font-semibold">{label}</h2>
        <label className="ml-auto flex items-center gap-2 text-xs text-[#94a3b8]">
          Enabled
          <input
            checked={settings.enabled}
            className="h-4 w-4 accent-[#38bdf8]"
            onChange={(event) => update("enabled", event.target.checked)}
            type="checkbox"
          />
        </label>
      </div>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-[#94a3b8]">URL</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
            onChange={(event) => update("url", event.target.value)}
            placeholder={`http://${label.toLowerCase()}:${
              label === "Radarr" ? "7878" : "8989"
            }`}
            value={settings.url}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#94a3b8]">API key</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb] placeholder:text-[#64748b]"
            onChange={(event) => update("apiKey", event.target.value)}
            placeholder={
              settings.apiKeyConfigured
                ? "Configured (leave blank to keep)"
                : "Enter API key"
            }
            type="password"
            value={settings.apiKey ?? ""}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
          <span className="text-[#94a3b8]">Remove tag when unprotected</span>
          <input
            checked={settings.removeTagsWhenUnprotected}
            className="h-4 w-4 accent-[#38bdf8]"
            onChange={(event) =>
              update("removeTagsWhenUnprotected", event.target.checked)
            }
            type="checkbox"
          />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#334155] px-3 py-2 text-sm hover:bg-[#1f2937] disabled:opacity-50"
          disabled={pendingAction !== undefined}
          onClick={onTest}
          type="button"
        >
          {pendingAction === "test" && (
            <RefreshCw className="animate-spin" size={16} />
          )}
          {pendingAction === "test" ? "Testing" : "Test"}
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0ea5e9] px-3 py-2 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-50"
          disabled={pendingAction !== undefined}
          onClick={onSave}
          type="button"
        >
          {pendingAction === "save" && (
            <RefreshCw className="animate-spin" size={16} />
          )}
          {pendingAction === "save" ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function JobsSettingsPanel({
  activeJob,
  jobsSettings,
  onChange,
  onRunMetadataSync,
  onRunRatingSync,
  onRunTagSync,
  running,
}: {
  activeJob?: SyncJobStatus;
  jobsSettings: JobsSettings;
  onChange: (settings: JobsSettings) => void;
  onRunMetadataSync: () => void;
  onRunRatingSync: () => void;
  onRunTagSync: () => void;
  running: boolean;
}) {
  function updateJob(key: keyof JobsSettings, value: Partial<CronJobSettings>) {
    onChange({
      ...jobsSettings,
      [key]: {
        ...jobsSettings[key],
        ...value,
      },
    });
  }

  return (
    <>
      <JobScheduleCard
        description="Scans selected Plex libraries and updates the local rating cache."
        job={jobsSettings.ratingSync}
        onChange={(value) => updateJob("ratingSync", value)}
        onRun={onRunRatingSync}
        running={running && activeJob?.scope === "full"}
        title="Rating Sync"
      />
      <JobScheduleCard
        description="Reads cached ratings and applies configured Radarr/Sonarr tags."
        job={jobsSettings.tagSync}
        onChange={(value) => updateJob("tagSync", value)}
        onRun={onRunTagSync}
        running={running && activeJob?.scope === "tags"}
        title="Tag Sync"
      />
      <JobScheduleCard
        description="Refreshes cached titles, posters, indexes, and external IDs from Plex without scanning every user's ratings."
        job={jobsSettings.metadataSync}
        onChange={(value) => updateJob("metadataSync", value)}
        onRun={onRunMetadataSync}
        running={running && activeJob?.scope === "metadata"}
        title="Plex Metadata Refresh"
      />
      {running && <SyncProgress job={activeJob} />}
    </>
  );
}

function JobScheduleCard({
  description,
  job,
  onChange,
  onRun,
  running,
  title,
}: {
  description: string;
  job: CronJobSettings;
  onChange: (settings: Partial<CronJobSettings>) => void;
  onRun: () => void;
  running: boolean;
  title: string;
}) {
  const presets: Array<{ value: CronJobSettings["preset"]; label: string }> = [
    { value: "disabled", label: "Disabled" },
    { value: "6h", label: "Every 6 hours" },
    { value: "12h", label: "Every 12 hours" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "custom", label: "Custom cron" },
  ];

  return (
    <div className="rounded-md border border-[#263245] bg-[#111827] p-4">
      <div className="flex items-center gap-2">
        <RefreshCw size={18} />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-[#94a3b8]">{description}</p>
      <label className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[#263245] px-3 py-2 text-sm">
        <span className="font-medium">Enabled</span>
        <input
          checked={job.enabled}
          className="h-4 w-4 accent-[#38bdf8]"
          onChange={(event) =>
            onChange({
              enabled: event.target.checked,
              preset: event.target.checked
                ? job.preset === "disabled"
                  ? "daily"
                  : job.preset
                : "disabled",
            })
          }
          type="checkbox"
        />
      </label>
      <label className="mt-3 block text-sm">
        <span className="text-[#94a3b8]">Schedule</span>
        <select
          className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
          onChange={(event) =>
            onChange({
              enabled: event.target.value !== "disabled",
              preset: event.target.value as CronJobSettings["preset"],
            })
          }
          value={job.preset}
        >
          {presets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      {job.preset === "custom" && (
        <label className="mt-3 block text-sm">
          <span className="text-[#94a3b8]">Cron expression</span>
          <input
            className="mt-1 w-full rounded-md border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-[#e5e7eb]"
            defaultValue={job.cron}
            onBlur={(event) => onChange({ cron: event.target.value })}
            placeholder="0 3 * * *"
          />
        </label>
      )}
      <div className="mt-3 rounded-md border border-[#263245] bg-[#0f172a] px-3 py-2 text-sm">
        <span className="text-[#94a3b8]">Last run</span>
        <p className="mt-1 font-medium text-[#e5e7eb]">
          {job.lastRun
            ? new Date(job.lastRun.startedAt).toLocaleString()
            : "Never run"}
        </p>
        {job.lastRun && (
          <p className="mt-0.5 text-xs capitalize text-[#94a3b8]">
            {job.lastRun.trigger} run
          </p>
        )}
      </div>
      <button
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0ea5e9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0284c7] disabled:opacity-50"
        disabled={running}
        onClick={onRun}
        type="button"
      >
        <RefreshCw className={clsx(running && "animate-spin")} size={17} />
        Run Now
      </button>
    </div>
  );
}
