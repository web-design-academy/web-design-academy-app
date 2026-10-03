import {useAuth} from "@/lib/ctx/useAuth.ts";
import GitHubIcon from "@/components/User/GitHubIcon.tsx";
import GitHubAvatar from "@/components/User/GitHubAvatar.tsx";
import {useCallback, useEffect, useState} from "react";
import {Link, useNavigate} from "react-router";
import "@/styles/profile.css"
import {DownloadCloud, Pencil, Plus, Settings, X, XIcon} from "lucide-react";
import Modal from "@/components/Modal.tsx";
import Pagination from "@/components/Pagination.tsx";
import LoadingSpinner from "@/components/LoadingSpinner.tsx";
import {useQuery} from "@tanstack/react-query";
import InfoBanner from "@/components/InfoBanner.tsx";
import RepositoryBanner from "@/components/Dashboard/RepositoryBanner.tsx";
import {
  fetchInstallations,
  fetchProfile,
  fetchRepositories,
  installationUrl,
  linkUrl,
  unlinkAccount
} from "@/lib/api/github.ts";
import type {Repository} from "@/interfaces/Repository.ts";
import InstallationBanner from "@/components/Dashboard/InstallationBanner.tsx";

type Modals = "unlink" | "installations" | "none";

const sideWindow = (url: string, target: string, onClose: () => void = () => {
}, width: number = 600, height: number = 700) => {
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    url,
    target,
    `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
  );

  const handleMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin)
      return;

    if (event.data?.type === "GITHUB_AUTH_COMPLETED") {
      cleanup();
      onClose();
      if (event.data?.error)
        throw new Error("GitHub account linking failed");
    }
  };

  const timer = setInterval(async () => {
    if (popup?.closed) {
      cleanup();
      onClose();
    }
  }, 500);

  const cleanup = () => {
    clearInterval(timer);
    window.removeEventListener("message", handleMessage);
  };

  window.addEventListener("message", handleMessage);
}

export default function Profile() {
  const {user, isLoading, refresh} = useAuth();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<Modals>("none");
  const [error, setError] = useState<Error | null>(null);

  const [installationsPageSize, setInstallationsPageSize] = useState(4);
  const [installationsPage, setInstallationsPage] = useState(1);

  const [repositoriesPageSize, setRepositoriesPageSize] = useState(3);
  const [repositoriesPage, setRepositoriesPage] = useState(1);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  const handlePopUpClose = useCallback(() => {
    setOpenModal("none");
  }, [setOpenModal]);

  const linkGitHub = () => {
    try {
      sideWindow(linkUrl, "GitHubLink", async () => {
        await refresh();
        await profileRefetch();
      });
    } catch (error) {
      setError(error as Error);
    }
  };

  const unlinkGitHub = async () => {
    try {
      await unlinkAccount();
      await refresh();
    } catch (error) {
      setError(error as Error);
    } finally {
      handlePopUpClose();
    }
  }

  const addInstallation = () => {
    try {
      sideWindow(
        `${installationUrl}/new`,
        "GitHubInstall",
        async () => {
          await installationsRefetch();
        }
      );
    } catch (error) {
      setError(error as Error);
    } finally {
      handlePopUpClose();
    }
  };

  const linkButton = () => (
    <button
      type="button"
      className="btn-primary signin-button"
      onClick={() => linkGitHub()}
    >
      <GitHubIcon size={18} />
      Link GitHub
    </button>
  );

  const manageButton = () => (
    <button
      type="button"
      className="btn-ghost"
      onClick={() => setOpenModal("installations")}
    >
      <GitHubIcon size="1em" className="icon-margin-right"/>
      Manage
    </button>
  );

  const {
    data: installations,
    isLoading: installationsLoading,
    error: installationsError,
    refetch: installationsRefetch
  } = useQuery({
    queryKey: ["installations"],
    queryFn: async () => await fetchInstallations(),
    enabled: Boolean(!isLoading && user?.githubId && openModal === "installations"),
    staleTime: 1000 * 60 * 60 * 5,
  });

  const {data: repositories, isLoading: repositoriesLoading, error: repositoriesError} = useQuery({
    queryKey: ["repositories"],
    queryFn: async () => await fetchRepositories(),
    enabled: Boolean(!isLoading && user?.githubId),
    staleTime: 1000 * 60 * 60 * 5,
  });

  const {data: profile, isLoading: profileLoading, error: profileError, refetch: profileRefetch} = useQuery({
    queryKey: ["profile"],
    queryFn: async () => await fetchProfile(),
    enabled: Boolean(!isLoading && user?.githubId),
    staleTime: 1000 * 60 * 60 * 5,
  });

  useEffect(() => {
    const handlePress = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handlePopUpClose();
      }
    };

    addEventListener("keypress", handlePress);
    return () => {
      removeEventListener("keypress", handlePress)
    }
  }, [handlePopUpClose]);

  useEffect(() => {
    if (installationsError) {
      setError(installationsError);
      handlePopUpClose();
    }
  }, [handlePopUpClose, installationsError]);

  useEffect(() => {
    if (repositoriesError) {
      setError(repositoriesError);
      handlePopUpClose();
    }
  }, [handlePopUpClose, repositoriesError]);

  useEffect(() => {
    if (profileError) {
      setError(profileError);
      handlePopUpClose();
    }
  }, [handlePopUpClose, profileError]);

  const installationsStart = (installationsPage - 1) * installationsPageSize;
  const installationsShown = installations?.slice(installationsStart, installationsStart + installationsPageSize) ?? [];
  const repositoriesStart = (repositoriesPage - 1) * repositoriesPageSize;
  const repositoriesShown = repositories?.slice(repositoriesStart, repositoriesStart + repositoriesPageSize) ?? [];

  return (
    <>
      {error && (
        <div className="profile-error">
          <InfoBanner
            type="error"
            icon={(<XIcon/>)}
            message={error.message}
            actions={(
              <button
                onClick={() => setError(null)}
                className="btn-ghost"
              >
                Close
              </button>
            )}
          />
        </div>
      )}

      <main className="profile-page">
        <section className="profile-header">
          {user?.githubId && profile && (
            <GitHubAvatar className="profile-header-avatar" imageSize={72} url={profile.github_avatar_url}/>
          )}

          <div>
            <h1>{user?.name}</h1>
            <span>{user?.email}</span>
          </div>

          <div className="profile-header-actions">
            <h2 className="italic">{user?.role === "admin" ? "Admin" : "Student"}</h2>
            {user?.role === "admin" && (
              <Link to="/admin" className="btn-ghost">
                <Settings size={18} className="icon-margin-right" />
                Admin Panel
              </Link>
            )}
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-section profile-section-panel">
            <h2>Account information</h2>

            {isLoading || profileLoading ? (
              <LoadingSpinner/>
            ) : user?.githubId && profile ? (
              <div className="profile-information">
                <div className="profile-panel-item">
                  <span>GitHub Name:</span>
                  <strong>{profile.github_name} <span className="italic">({profile.github_login})</span></strong>
                </div>

                <div className="profile-panel-item">
                  <span>GitHub ID:</span>
                  <strong>{profile.github_id}</strong>
                </div>
              </div>
            ) : (
              <div className="profile-section-info border">
                <p>Link GitHub account to view more information</p>

                {linkButton()}
              </div>
            )}

            {user?.githubId && (
              <div className="profile-panel-item end">
                {manageButton()}
              </div>
            )}
          </div>

          <div className="profile-section profile-larger">
            <div className="profile-section profile-section-panel">
              <h2>Repositories</h2>

              {!user?.githubId ? (
                <div className="profile-section-info border">
                  <p>Link GitHub account to access your remote repositories</p>

                  {linkButton()}
                </div>
              ) : (
                <div className="profile-repositories">
                  {repositoriesLoading ? (
                    <LoadingSpinner/>
                  ) : (
                    <>
                      {(!repositories || repositories.length === 0) ? (
                        <div className="profile-section-info big">
                          <p>You have no tracked remote repositories</p>

                          {user?.githubId && (
                            <>
                              {manageButton()}

                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => navigate("/edit")}
                              >
                                <Plus size={16} className="icon-margin-right"/>
                                Create and publish lesson
                              </button>
                            </>
                          )}
                        </div>
                      ) : repositoriesShown.map((repo: Repository) => (
                        <RepositoryBanner
                          key={repo.id}
                          repo={repo}
                          actions={
                            <>
                              <button type="button" className="btn-primary">
                                <DownloadCloud
                                  size={16}
                                  className={user?.githubId ? "" : "icon-margin-right"}
                                />
                                {user?.githubId ? "" : "Download"}
                              </button>

                              {user?.githubId && (
                                <>
                                  <button type="button" className="btn-ghost">
                                    <Pencil size={16}/>
                                  </button>

                                  <button
                                    type="button"
                                    className="btn-ghost"
                                  >
                                    <X size={16}/>
                                  </button>
                                </>
                              )}
                            </>
                          }
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {user?.githubId && repositories && (
              <Pagination
                page={repositoriesPage}
                pageSize={repositoriesPageSize}
                total={repositories?.length || 0}
                onChange={(page) => setRepositoriesPage(page)}
                onPageSizeChange={(size) => {
                  setRepositoriesPageSize(size);
                  setRepositoriesPage(1);
                }}
              />
            )}
          </div>
        </section>

        <Modal
          title="GitHub account unlinking"
          isOpen={openModal === "unlink"}
          onClose={handlePopUpClose}
          actions={
            <>
              <button type="button" className="btn-ghost" onClick={unlinkGitHub}>
                Unlink GitHub
              </button>
              <button type="button" className="btn-primary" onClick={handlePopUpClose}>
                Cancel
              </button>
            </>
          }
          children={
            <div>
              <h3>Are you sure?</h3>
              <p>You will <strong>no longer</strong> be able to upload lessons to repositories and access your private repositories from WDA.</p>
              <p>You will still be able to download lessons in public repositories.</p>
              <p>Remote repositories and locally saved lessons will not be removed.</p>
              <p>You can link your account or a different one <strong>again anytime you want.</strong></p>
              <p>Be sure to <strong>uninstall</strong> any installations you made to WDA with the button bellow.</p>

              <div className="center">
                {manageButton()}
              </div>
            </div>
          }
        />

        <Modal
          className="profile-modal-large"
          title="Remote repositories"
          isOpen={openModal === "installations"}
          onClose={handlePopUpClose}
          children={installationsLoading ? <LoadingSpinner/> : (
            <div className="profile-section">
              <div className="profile-section-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={addInstallation}
                >
                  <Plus size="1em" className="icon-margin-right"/>
                  Add installation
                </button>

                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setOpenModal("unlink")
                  }}
                >
                  <GitHubIcon size="1em" className="icon-margin-right"/>
                  Unlink
                </button>
              </div>

              <div className="profile-repositories">
                {installations?.length === 0 ? (
                  <div className="profile-section-info">
                    <p>No installations found.</p>
                  </div>
                ) : installationsShown.map((i) => (
                  <InstallationBanner
                    key={i.id}
                    installation={i}
                  />
                ))}
              </div>

              <Pagination
                page={installationsPage}
                pageSize={installationsPageSize}
                total={installations?.length || 0}
                onChange={(page) => setInstallationsPage(page)}
                onPageSizeChange={(size) => {
                  setInstallationsPageSize(size);
                  setInstallationsPage(1);
                }}
              />
            </div>
          )}
        />
      </main>
    </>
  )
}