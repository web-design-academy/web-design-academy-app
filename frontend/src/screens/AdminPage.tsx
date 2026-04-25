import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/ctx/useAuth";
import { useAdminSubmissions } from "@/lib/hooks/useSubmissions";
import { useNavigate, Link } from "react-router";
import Modal from "@/components/Modal";
import { saveCustomCourse, addCustomTask } from "@/lib/helpers/adminStorage";
import { getAllLessons } from "@/lib/helpers/getLessons";
import "@/styles/admin.css";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: queryError,
  } = useAdminSubmissions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    slug: "",
    color: "oklch(60% 0.15 250)",
    icon: "Question",
    order: 0,
    hidden: false,
    enableVisualMode: false,
    enableAnalyzerEditor: false,
  });

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") {
      navigate("/");
    }

    if (user?.role === "admin") {
      const lessons = getAllLessons();
      const nextOrder = Math.max(0, ...lessons.map((lesson) => lesson.order)) + 1;

      setFormData((prev) => ({ ...prev, order: nextOrder }));
    }
  }, [user, authLoading, navigate]);

  const handleCreateCourse = () => {
    saveCustomCourse({
      ...formData,
      order: Number(formData.order),
    });

    addCustomTask(formData.slug, {
      editableHtml: "<h1>New Task</h1>\n<p>Start editing...</p>",
      editableCss: "h1 { color: blue; }",
      editableJs: 'console.log("Hello World");',
    });

    navigate(`/lessons/${formData.slug}`);
  };

  const groupedSubmissions = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return [];
    }

    const sortedSubmissions = [...submissions].sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );

    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        email?: string;
        latestTimestamp: string;
        submissions: typeof sortedSubmissions;
      }
    >();

    sortedSubmissions.forEach((submission) => {
      const key =
        submission.user_id ||
        submission.user_email ||
        submission.user_name ||
        `anonymous-${submission.id}`;

      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.submissions.push(submission);
        return;
      }

      groups.set(key, {
        key,
        name: submission.user_name || "Anonymous",
        email: submission.user_email,
        latestTimestamp: submission.timestamp,
        submissions: [submission],
      });
    });

    return Array.from(groups.values()).sort(
      (left, right) =>
        new Date(right.latestTimestamp).getTime() -
        new Date(left.latestTimestamp).getTime(),
    );
  }, [submissions]);

  const toggleUserGroup = (userKey: string) => {
    setExpandedUsers((prev) => ({ ...prev, [userKey]: !prev[userKey] }));
  };

  if (authLoading || submissionsLoading) return <LoadingSpinner />;

  return (
    <main className="admin-page">
      <div className="admin-container">
        <div
          className="admin-header-actions"
          style={{
            marginBottom: 24,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            + Create New Course
          </button>
        </div>

        {queryError && (
          <div className="admin-error">
            {queryError instanceof Error
              ? queryError.message
              : "Error loading data"}
          </div>
        )}

        <section className="admin-card">
          <div className="card-header">
            <h2>Recent Submissions</h2>
            <span className="badge-count">
              {submissions ? submissions.length : 0} Total
            </span>
          </div>

          {!groupedSubmissions.length ? (
            <div className="empty-state">No submissions yet</div>
          ) : (
            <div className="admin-submission-groups">
              {groupedSubmissions.map((group) => {
                const isExpanded = expandedUsers[group.key] ?? false;

                return (
                  <section key={group.key} className="submission-group">
                    <button
                      type="button"
                      className="submission-group-toggle"
                      onClick={() => toggleUserGroup(group.key)}
                      aria-expanded={isExpanded}
                    >
                      <div className="submission-group-heading">
                        <span
                          className="submission-group-chevron"
                          aria-hidden="true"
                        >
                          {isExpanded ? (
                            <ChevronDown size={20} />
                          ) : (
                            <ChevronRight size={20} />
                          )}
                        </span>
                        <div className="submission-group-user">
                          <span className="submission-group-name">{group.name}</span>
                          {group.email && (
                            <span className="submission-group-email">{group.email}</span>
                          )}
                        </div>
                      </div>
                      <div className="submission-group-meta">
                        <span>{group.submissions.length} submissions</span>
                        <span>
                          Latest{" "}
                          {new Date(group.latestTimestamp).toLocaleString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="table-responsive">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Lesson</th>
                              <th>Task</th>
                              <th>Submitted</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.submissions.map((sub) => (
                              <tr key={sub.id}>
                                <td className="font-mono">#{sub.id}</td>
                                <td>
                                  <span className="pill pill-blue">
                                    {sub.lesson_slug}
                                  </span>
                                </td>
                                <td>Task {sub.task_id}</td>
                                <td>
                                  {new Date(sub.timestamp).toLocaleString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </td>
                                <td>
                                  <Link
                                    to={`/lessons/${sub.lesson_slug}?submissionId=${sub.id}`}
                                    className="btn-text"
                                    style={{
                                      textDecoration: "none",
                                      fontWeight: 600,
                                    }}
                                  >
                                    View
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <Modal
          title="Create new course"
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          actions={
            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button onClick={handleCreateCourse} className="btn-primary">
                Create
              </button>
            </div>
          }
        >
          <div
            className="admin-form"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Intro to React"
                className="admin-input"
              />
            </div>
            <div className="form-group">
              <label>Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="intro-react"
                className="admin-input"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="admin-input"
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div className="form-group">
                <label>Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value),
                    })
                  }
                  className="admin-input"
                />
              </div>
              <div className="form-group">
                <label>Icon</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) =>
                    setFormData({ ...formData, icon: e.target.value })
                  }
                  className="admin-input"
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <label
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={formData.hidden}
                  onChange={(e) =>
                    setFormData({ ...formData, hidden: e.target.checked })
                  }
                />
                Hidden lesson
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={formData.enableVisualMode}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enableVisualMode: e.target.checked,
                    })
                  }
                />
                Enable visual mode
              </label>
              <label
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={formData.enableAnalyzerEditor}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enableAnalyzerEditor: e.target.checked,
                    })
                  }
                />
                Enable analyzer editor
              </label>
            </div>
          </div>
        </Modal>
      </div>
    </main>
  );
}
