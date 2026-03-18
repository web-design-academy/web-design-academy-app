import { useEffect, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/ctx/useAuth";
import { useAdminSubmissions } from "@/lib/hooks/useSubmissions";
import { useNavigate, Link } from "react-router";
import Modal from "@/components/Modal";
import { saveCustomCourse, addCustomTask } from "@/lib/helpers/adminStorage";
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    slug: "",
    color: "oklch(60% 0.15 250)",
    icon: "Question",
    order: 0,
  });

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") {
      navigate("/");
    }

    if (user?.role === "admin") {
      import("@/lib/helpers/getLessons").then((m) => {
        const lessons = m.getLessons();
        if (lessons.length > 0) {
          const maxOrder = Math.max(...lessons.map((l) => l.order));
          setFormData((prev) => ({ ...prev, order: maxOrder + 1 }));
        }
      });
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

          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Lesson</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!submissions || submissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      No submissions yet
                    </td>
                  </tr>
                ) : (
                  submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="font-mono">#{sub.id}</td>
                      <td
                        className="font-mono"
                        title={sub.user_name || "Unknown"}
                      >
                        {sub.user_name || "Anonymous"}
                      </td>
                      <td>
                        <span className="pill pill-blue">
                          {sub.lesson_slug}
                        </span>
                      </td>
                      <td>Task {sub.task_id}</td>
                      <td>
                        <span className={`status-badge status-${sub.status}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td>
                        {new Date(sub.timestamp).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <Link
                          to={`/lessons/${sub.lesson_slug}?submissionId=${sub.id}`}
                          className="btn-text"
                          style={{ textDecoration: "none", fontWeight: 600 }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
          </div>
        </Modal>
      </div>
    </main>
  );
}
