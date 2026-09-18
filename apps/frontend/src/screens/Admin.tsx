import type {ReactNode} from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ArrowDown, ArrowUp, ArrowUpDown, Plus, Send, Tags, Users, X,} from "lucide-react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {Link, useNavigate} from "react-router";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import {useAuth} from "@/lib/ctx/useAuth";
import {
  addTagToUsers,
  addUserTag,
  type AdminTag,
  type AdminUser,
  deleteTag,
  fetchAdminTags,
  fetchAdminUsers,
  removeTagFromUsers,
  removeUserTag,
} from "@/lib/api/admin";
import {fetchSubmissions, type PaginatedResponse, type SubmissionRecord,} from "@/lib/api/submissions";
import {isOnlineMode} from "@/lib/config/config.ts";
import "@/styles/admin.css";
import InfoBanner from "@/components/InfoBanner.tsx";

// Default values and settings
const PAGE_SIZE = 12;

// Variables and types
type AdminSection = "users" | "submissions";
type TagDraft = Record<string, { tagId: string; name: string }>;
type UserTag = AdminUser["tags"][number];
type SortDirection = "asc" | "desc";
type UserSortKey = "id" | "user" | "role" | "joined";
type SubmissionSortKey = "id" | "user" | "lesson" | "submitted";
type SortState<T extends string> = {
  key: T | null;
  direction: SortDirection | null;
};

const POPOVER_BOUNDARY_SELECTOR = ".admin-popover-boundary";

/**
 * Formats a given date string into a localized string with the format "MMM DD, HH:mm".
 *
 * @param {string} value - The date string to be formatted.
 * @return {string} The formatted date string.
 */
function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SortableHeader<T extends string>({
  label,
  column,
  sort,
  onSortChange,
}: {
  label: string;
  column: T;
  sort: SortState<T>;
  onSortChange: (sort: SortState<T>) => void;
}) {
  const isActive = sort.key === column;
  const Icon = isActive
    ? sort.direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  const nextSort: SortState<T> =
    !isActive || sort.direction === null
      ? { key: column, direction: "asc" }
      : sort.direction === "asc"
        ? { key: column, direction: "desc" }
        : { key: null, direction: null };

  return (
    <button
      type="button"
      className={`admin-sort-header ${isActive ? "is-active" : ""}`}
      onClick={() => onSortChange(nextSort)}
      aria-label={`Sort by ${label} ${
        isActive && sort.direction === "asc"
          ? "descending"
          : isActive && sort.direction === "desc"
            ? "without sorting"
            : "ascending"
      }`}
    >
      <span>{label}</span>
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

function TagFilter({
  value,
  onChange,
  tags,
}: {
  value: number | "";
  onChange: (value: number | "") => void;
  tags: { id: number; name: string; user_count?: number }[];
}) {
  return (
    <label className="admin-filter">
      <select
        className="form-select-control"
        value={value}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : "")
        }
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label="Select all visible users"
    />
  );
}

function UserTagPopover({
  tags,
  assignedTagIds,
  draftName,
  isPending,
  availableLabel = "Available tags",
  onSelectExisting,
  onDeleteTag,
  onDraftNameChange,
  onCreateTag,
}: {
  tags: AdminTag[];
  assignedTagIds: Set<number>;
  draftName: string;
  isPending: boolean;
  availableLabel?: string;
  onSelectExisting: (tagId: number) => void;
  onDeleteTag: (tagId: number) => void;
  onDraftNameChange: (value: string) => void;
  onCreateTag: () => void;
}) {
  const availableTags = tags.filter((tag) => !assignedTagIds.has(tag.id));

  return (
    <div className="lesson-picker-popover admin-tag-popover" role="dialog">
      <div className="admin-tag-popover-section">
        <div className="admin-tag-popover-heading">{availableLabel}</div>
        <div className="admin-tag-popover-list">
          {availableTags.length ? (
            availableTags.map((tag) => (
              <span key={tag.id} className="admin-tag-choice-wrap">
                <button
                  type="button"
                  className="admin-tag-choice"
                  disabled={isPending}
                  onClick={() => onSelectExisting(tag.id)}
                >
                  {tag.name}
                </button>
                <button
                  type="button"
                  className="admin-tag-delete-button"
                  onClick={() => onDeleteTag(tag.id)}
                  disabled={isPending}
                  aria-label={`Delete ${tag.name} tag from database`}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          ) : tags.length ? (
            <span className="admin-muted">All saved tags are added</span>
          ) : (
            <span className="admin-muted">No saved tags</span>
          )}
        </div>
      </div>
      <div className="admin-new-tag-row">
        <input
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
          placeholder="New tag"
        />
        <button
          type="button"
          className="admin-row-button"
          onClick={onCreateTag}
          disabled={isPending || !draftName.trim()}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function CompactTags({
  tags,
  canRemove = false,
  showAll = false,
  expanded,
  onToggleExpanded,
  onRemove,
  children,
}: {
  tags: UserTag[];
  canRemove?: boolean;
  showAll?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onRemove?: (tagId: number) => void;
  children?: ReactNode;
}) {
  if (!tags.length) {
    return (
      <div className="admin-tags">
        <span className="admin-muted">No tags</span>
        {children}
      </div>
    );
  }

  const visibleTags = showAll ? tags : tags.slice(0, 1);
  const hiddenTags = showAll ? [] : tags.slice(1);

  const renderTag = (tag: UserTag) =>
    canRemove && onRemove ? (
      <span key={tag.id} className="admin-tag-choice-wrap">
        <span className="admin-tag-choice admin-tag-choice-label">
          {tag.name}
        </span>
        <button
          type="button"
          className="admin-tag-delete-button"
          onClick={() => onRemove(tag.id)}
          aria-label={`Remove ${tag.name}`}
        >
          <X size={12} />
        </button>
      </span>
    ) : (
      <span key={tag.id} className="admin-tag">
        {tag.name}
      </span>
    );

  return (
    <div className="admin-tags">
      {children}
      {visibleTags.map((tag) => renderTag(tag))}
      {hiddenTags.length > 0 && (
        <span className="admin-more-tags-anchor admin-popover-boundary">
          <button
            type="button"
            className="admin-more-tags-button"
            onClick={onToggleExpanded}
            aria-expanded={expanded}
          >
            {hiddenTags.length} more
          </button>
          {expanded && (
            <div className="lesson-picker-popover admin-hidden-tags-popover">
              <div className="admin-hidden-tags-list">
                {hiddenTags.map((tag) => renderTag(tag))}
              </div>
            </div>
          )}
        </span>
      )}
    </div>
  );
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<AdminSection>("users");
  const [userPage, setUserPage] = useState(1);
  const [submissionPage, setSubmissionPage] = useState(1);
  const [userSort, setUserSort] = useState<SortState<UserSortKey>>({
    key: null,
    direction: null,
  });
  const [submissionSort, setSubmissionSort] = useState<
    SortState<SubmissionSortKey>
  >({
    key: null,
    direction: null,
  });
  const [userTagFilter, setUserTagFilter] = useState<number | "">("");
  const [submissionTagFilter, setSubmissionTagFilter] = useState<number | "">(
    "",
  );
  const [tagDrafts, setTagDrafts] = useState<TagDraft>({});
  const [bulkTagDraft, setBulkTagDraft] = useState({ tagId: "", name: "" });
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkTagPopoverOpen, setIsBulkTagPopoverOpen] = useState(false);
  const [openTagPopoverUserId, setOpenTagPopoverUserId] = useState<
    string | null
  >(null);
  const [openMoreTagsKey, setOpenMoreTagsKey] = useState<string | null>(null);
  const closePopovers = useCallback(() => {
    setIsBulkTagPopoverOpen(false);
    setOpenTagPopoverUserId(null);
    setOpenMoreTagsKey(null);
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => setUserPage(1), [userTagFilter]);
  useEffect(() => setSubmissionPage(1), [submissionTagFilter]);

  const updateUserSort = useCallback((sort: SortState<UserSortKey>) => {
    setUserSort(sort);
    setUserPage(1);
  }, []);

  const updateSubmissionSort = useCallback(
    (sort: SortState<SubmissionSortKey>) => {
      setSubmissionSort(sort);
      setSubmissionPage(1);
    },
    [],
  );

  useEffect(() => {
    const hasOpenPopover =
      isBulkTagPopoverOpen ||
      openTagPopoverUserId !== null ||
      openMoreTagsKey !== null;

    if (!hasOpenPopover) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(POPOVER_BOUNDARY_SELECTOR)
      ) {
        return;
      }

      closePopovers();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopovers();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [
    closePopovers,
    isBulkTagPopoverOpen,
    openMoreTagsKey,
    openTagPopoverUserId,
  ]);

  const { data: tags = [], error: tagsError } = useQuery({
    queryKey: ["admin-tags"],
    queryFn: fetchAdminTags,
    enabled: isOnlineMode && user?.role === "admin",
  });

  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["admin-users", userPage, userTagFilter, userSort],
    queryFn: () =>
      fetchAdminUsers({
        page: userPage,
        pageSize: PAGE_SIZE,
        tagId: userTagFilter,
        sortBy: userSort.key ?? undefined,
        sortDirection: userSort.direction ?? undefined,
      }),
    enabled: isOnlineMode && user?.role === "admin",
  });

  const {
    data: submissionsData,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useQuery({
    queryKey: [
      "submissions",
      submissionPage,
      submissionTagFilter,
      submissionSort,
    ],
    queryFn: async () =>
      (await fetchSubmissions({
        page: submissionPage,
        pageSize: PAGE_SIZE,
        tagId: submissionTagFilter,
        sortBy: submissionSort.key ?? undefined,
        sortDirection: submissionSort.direction ?? undefined,
      })) as PaginatedResponse<SubmissionRecord>,
    enabled: isOnlineMode && user?.role === "admin",
  });

  const visibleUsers = useMemo(
    () => usersData?.items ?? [],
    [usersData?.items],
  );
  const visibleUserIds = useMemo(
    () => visibleUsers.map((visibleUser) => visibleUser.id),
    [visibleUsers],
  );
  const selectedVisibleUsers = useMemo(
    () =>
      visibleUsers.filter((visibleUser) => selectedUserIds.has(visibleUser.id)),
    [selectedUserIds, visibleUsers],
  );
  const selectedVisibleUserIds = useMemo(
    () => selectedVisibleUsers.map((selectedUser) => selectedUser.id),
    [selectedVisibleUsers],
  );
  const selectedVisibleCount = selectedVisibleUserIds.length;
  const isAllVisibleUsersSelected =
    visibleUserIds.length > 0 &&
    visibleUserIds.every((visibleUserId) => selectedUserIds.has(visibleUserId));
  const isSomeVisibleUsersSelected =
    selectedVisibleCount > 0 && !isAllVisibleUsersSelected;
  const commonSelectedTags = useMemo(() => {
    if (!selectedVisibleUsers.length) return [];

    const commonTagIds = selectedVisibleUsers.reduce<Set<number> | null>(
      (commonIds, selectedUser) => {
        const userTagIds = new Set(selectedUser.tags.map((tag) => tag.id));

        if (!commonIds) return userTagIds;

        return new Set([...commonIds].filter((tagId) => userTagIds.has(tagId)));
      },
      null,
    );

    if (!commonTagIds) return [];

    return tags.filter((tag) => commonTagIds.has(tag.id));
  }, [selectedVisibleUsers, tags]);
  const commonSelectedTagIds = useMemo(
    () => new Set(commonSelectedTags.map((tag) => tag.id)),
    [commonSelectedTags],
  );

  const addTagMutation = useMutation({
    mutationFn: ({
      userId,
      tagId,
      name,
    }: {
      userId: string;
      tagId?: number | "";
      name?: string;
    }) => addUserTag(userId, { tagId, name }),
    onSuccess: (_data, variables) => {
      setTagDrafts((prev) => ({
        ...prev,
        [variables.userId]: { tagId: "", name: "" },
      }));
      setOpenTagPopoverUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: ({ userId, tagId }: { userId: string; tagId: number }) =>
      removeUserTag(userId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const bulkAddTagMutation = useMutation({
    mutationFn: ({
      userIds,
      tagId,
      name,
    }: {
      userIds: string[];
      tagId?: number | "";
      name?: string;
    }) => addTagToUsers(userIds, { tagId, name }),
    onSuccess: () => {
      setBulkTagDraft({ tagId: "", name: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const bulkRemoveTagMutation = useMutation({
    mutationFn: ({ userIds, tagId }: { userIds: string[]; tagId: number }) =>
      removeTagFromUsers(userIds, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: number) => deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  useEffect(() => {
    setSelectedUserIds((current) => {
      const visibleUserIdSet = new Set(visibleUserIds);
      const next = new Set(
        [...current].filter((userId) => visibleUserIdSet.has(userId)),
      );

      return next.size === current.size ? current : next;
    });
  }, [visibleUserIds]);

  useEffect(() => {
    if (!selectedVisibleCount) {
      setIsBulkTagPopoverOpen(false);
    }
  }, [selectedVisibleCount]);

  const setVisibleUsersSelected = (checked: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);

      visibleUserIds.forEach((userId) => {
        if (checked) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
      });

      return next;
    });
  };

  const setUserSelected = (userId: string, checked: boolean) => {
    setSelectedUserIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(userId);
      } else {
        next.delete(userId);
      }

      return next;
    });
  };

  const updateTagDraft = (
    userId: string,
    field: "tagId" | "name",
    value: string,
  ) => {
    setTagDrafts((prev) => ({
      ...prev,
      [userId]: {
        tagId: prev[userId]?.tagId ?? "",
        name: prev[userId]?.name ?? "",
        [field]: value,
      },
    }));
  };

  const submitTag = (targetUser: AdminUser) => {
    const draft = tagDrafts[targetUser.id] ?? { tagId: "", name: "" };
    const tagId = draft.tagId ? Number(draft.tagId) : "";
    const name = draft.name.trim();

    if (!tagId && !name) return;

    addTagMutation.mutate({
      userId: targetUser.id,
      tagId,
      name,
    });
  };

  const submitBulkTag = () => {
    const tagId = bulkTagDraft.tagId ? Number(bulkTagDraft.tagId) : "";
    const name = bulkTagDraft.name.trim();

    if ((!tagId && !name) || !selectedVisibleUserIds.length) return;

    bulkAddTagMutation.mutate({
      userIds: selectedVisibleUserIds,
      tagId,
      name,
    });
  };

  const removeCommonTagFromSelectedUsers = (tagId: number) => {
    if (!selectedVisibleUserIds.length) return;

    bulkRemoveTagMutation.mutate({
      userIds: selectedVisibleUserIds,
      tagId,
    });
  };

  const error = tagsError || usersError || submissionsError;

  if (authLoading) return <LoadingSpinner />;

  return (
    <main className="admin-page">
      <aside className="admin-sidebar" aria-label="Admin sections">
        <div className="admin-sidebar-heading">
          <strong>Control panel</strong>
        </div>
        <nav className="admin-sidebar-nav">
          {[
            { key: "users", label: "Users", icon: Users },
            { key: "submissions", label: "Submissions", icon: Send },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`admin-nav-item ${
                  activeSection === item.key ? "is-active" : ""
                }`}
                onClick={() => setActiveSection(item.key as AdminSection)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="admin-workspace">
        {error && (
          <InfoBanner type="error" icon={(<X/>)} message={error?.message ?? "An unknown error occurred"}/>
        )}

        {activeSection === "users" && (
          <section className="admin-panel admin-table-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Users</h1>
                <p>Admins and signed-in students</p>
              </div>
              <div className="admin-table-toolbar">
                {selectedVisibleCount > 0 && (
                  <span className="admin-selection-count">
                    {selectedVisibleCount} selected
                  </span>
                )}
                <span className="admin-tag-add-anchor admin-popover-boundary">
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      if (!selectedVisibleCount) return;
                      setIsBulkTagPopoverOpen((current) => !current);
                      setOpenTagPopoverUserId(null);
                      setOpenMoreTagsKey(null);
                    }}
                    disabled={!selectedVisibleCount}
                    aria-label="Edit tags for selected users"
                    aria-expanded={isBulkTagPopoverOpen}
                    title="Edit tags for selected users"
                  >
                    <Tags size={18} />
                  </button>
                  {isBulkTagPopoverOpen && (
                    <div className="lesson-picker-popover admin-tag-popover admin-bulk-tag-popover">
                      <div className="admin-tag-popover-section">
                        <div className="admin-tag-popover-heading">
                          Common tags
                        </div>
                        <CompactTags
                          tags={commonSelectedTags}
                          canRemove
                          showAll
                          onRemove={removeCommonTagFromSelectedUsers}
                        />
                      </div>
                      <UserTagPopover
                        tags={tags}
                        assignedTagIds={commonSelectedTagIds}
                        availableLabel="Addable saved tags"
                        draftName={bulkTagDraft.name}
                        isPending={
                          bulkAddTagMutation.isPending ||
                          bulkRemoveTagMutation.isPending ||
                          deleteTagMutation.isPending
                        }
                        onSelectExisting={(tagId) =>
                          bulkAddTagMutation.mutate({
                            userIds: selectedVisibleUserIds,
                            tagId,
                          })
                        }
                        onDeleteTag={(tagId) => deleteTagMutation.mutate(tagId)}
                        onDraftNameChange={(value) =>
                          setBulkTagDraft((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                        onCreateTag={submitBulkTag}
                      />
                    </div>
                  )}
                </span>
                <TagFilter
                  value={userTagFilter}
                  onChange={setUserTagFilter}
                  tags={tags}
                />
              </div>
            </div>

            {usersLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="admin-table-scroll">
                  <table className="admin-table admin-users-table">
                    <thead>
                      <tr>
                        <th>
                          <SelectAllCheckbox
                            checked={isAllVisibleUsersSelected}
                            indeterminate={isSomeVisibleUsersSelected}
                            onChange={setVisibleUsersSelected}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="Profile"
                            column="user"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="Role"
                            column="role"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                        <th>Tags</th>
                        <th>
                          <SortableHeader
                            label="Joined"
                            column="joined"
                            sort={userSort}
                            onSortChange={updateUserSort}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(usersData?.items ?? []).map((row) => {
                        const draft = tagDrafts[row.id] ?? {
                          tagId: "",
                          name: "",
                        };

                        return (
                          <tr key={row.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedUserIds.has(row.id)}
                                onChange={(event) =>
                                  setUserSelected(row.id, event.target.checked)
                                }
                                aria-label={`Select ${row.name || row.email}`}
                              />
                            </td>
                            <td>
                              <strong>{row.name || "Unnamed user"}</strong>
                              <span className="admin-cell-subtitle">
                                {row.email}
                              </span>
                            </td>
                            <td>
                              <span className="admin-role-pill">
                                {row.role}
                              </span>
                            </td>
                            <td>
                              <div className="admin-tags-cell">
                                <CompactTags
                                  tags={row.tags}
                                  canRemove
                                  expanded={
                                    openMoreTagsKey === `user-${row.id}`
                                  }
                                  onToggleExpanded={() => {
                                    setOpenTagPopoverUserId(null);
                                    setOpenMoreTagsKey((current) =>
                                      current === `user-${row.id}`
                                        ? null
                                        : `user-${row.id}`,
                                    );
                                  }}
                                  onRemove={(tagId) =>
                                    removeTagMutation.mutate({
                                      userId: row.id,
                                      tagId,
                                    })
                                  }
                                >
                                  <span className="admin-tag-add-anchor admin-popover-boundary">
                                    <button
                                      type="button"
                                      className="admin-tag-add-button"
                                      onClick={() => {
                                        setOpenMoreTagsKey(null);
                                        setOpenTagPopoverUserId((current) =>
                                          current === row.id ? null : row.id,
                                        );
                                      }}
                                      aria-label={`Add tag to ${
                                        row.name || row.email
                                      }`}
                                      aria-expanded={
                                        openTagPopoverUserId === row.id
                                      }
                                    >
                                      <Plus size={14} />
                                    </button>
                                    {openTagPopoverUserId === row.id && (
                                      <UserTagPopover
                                        tags={tags}
                                        assignedTagIds={
                                          new Set(row.tags.map((tag) => tag.id))
                                        }
                                        draftName={draft.name}
                                        isPending={
                                          addTagMutation.isPending ||
                                          deleteTagMutation.isPending
                                        }
                                        onSelectExisting={(tagId) =>
                                          addTagMutation.mutate({
                                            userId: row.id,
                                            tagId,
                                          })
                                        }
                                        onDeleteTag={(tagId) =>
                                          deleteTagMutation.mutate(tagId)
                                        }
                                        onDraftNameChange={(value) =>
                                          updateTagDraft(row.id, "name", value)
                                        }
                                        onCreateTag={() => submitTag(row)}
                                      />
                                    )}
                                  </span>
                                </CompactTags>
                              </div>
                            </td>
                            <td>{formatDate(row.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={usersData?.page ?? userPage}
                  total={usersData?.total ?? 0}
                  pageSize={usersData?.pageSize ?? PAGE_SIZE}
                  onChange={setUserPage}
                />
              </>
            )}
          </section>
        )}

        {activeSection === "submissions" && (
          <section className="admin-panel admin-table-panel">
            <div className="admin-panel-header">
              <div>
                <h1>Submissions</h1>
                <p>Latest student work</p>
              </div>
              <TagFilter
                value={submissionTagFilter}
                onChange={setSubmissionTagFilter}
                tags={tags}
              />
            </div>

            {submissionsLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <div className="admin-table-scroll">
                  <table className="admin-table admin-submissions-table">
                    <thead>
                      <tr>
                        <th>
                          <SortableHeader
                            label="ID"
                            column="id"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>
                          <SortableHeader
                            label="Profile"
                            column="user"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Tags</th>
                        <th>
                          <SortableHeader
                            label="Lesson"
                            column="lesson"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Task</th>
                        <th>
                          <SortableHeader
                            label="Submitted"
                            column="submitted"
                            sort={submissionSort}
                            onSortChange={updateSubmissionSort}
                          />
                        </th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(submissionsData?.items ?? []).map((sub) => (
                        <tr key={sub.id}>
                          <td className="font-mono">#{sub.id}</td>
                          <td>
                            <strong>{sub.user_name || "Anonymous"}</strong>
                            <span className="admin-cell-subtitle">
                              {sub.user_email}
                            </span>
                          </td>
                          <td>
                            <CompactTags
                              tags={sub.user_tags ?? []}
                              expanded={
                                openMoreTagsKey === `submission-${sub.id}`
                              }
                              onToggleExpanded={() => {
                                setOpenTagPopoverUserId(null);
                                setOpenMoreTagsKey((current) =>
                                  current === `submission-${sub.id}`
                                    ? null
                                    : `submission-${sub.id}`,
                                );
                              }}
                            />
                          </td>
                          <td>
                            <span className="pill pill-blue">
                              {sub.lesson_slug}
                            </span>
                          </td>
                          <td>Task {sub.task_id}</td>
                          <td>{formatDate(sub.timestamp)}</td>
                          <td>
                            <Link
                              to={`/lessons/${sub.lesson_slug}?submissionId=${sub.id}`}
                              className="admin-row-button"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={submissionsData?.page ?? submissionPage}
                  total={submissionsData?.total ?? 0}
                  pageSize={submissionsData?.pageSize ?? PAGE_SIZE}
                  onChange={setSubmissionPage}
                />
              </>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
