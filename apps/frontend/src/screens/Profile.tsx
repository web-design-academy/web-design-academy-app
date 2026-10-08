import {useAuth} from "@/lib/ctx/useAuth.ts";
import GitHubIcon from "@/components/User/GitHubIcon.tsx";
import GitHubAvatar from "@/components/User/GitHubAvatar.tsx";
import {useCallback, useEffect, useState} from "react";
import {Link, useNavigate} from "react-router";
import "@/styles/profile.css"
import {DownloadCloud, ExternalLink, Pencil, Plus, Settings} from "lucide-react";
import Modal from "@/components/Modal.tsx";
import Pagination from "@/components/Pagination.tsx";
import LoadingSpinner from "@/components/LoadingSpinner.tsx";
import {useQuery} from "@tanstack/react-query";
import RepositoryBanner from "@/components/Dashboard/RepositoryBanner.tsx";
import {
  downloadRepositoryArchive,
  fetchInstallations,
  fetchProfile,
  fetchRepositories,
  fetchRepositorySha,
  linkUrl,
  newInstallationUrl,
  unlinkAccount
} from "@/lib/api/github.ts";
import type {Repository} from "@/interfaces/Repository.ts";
import InstallationBanner from "@/components/Dashboard/InstallationBanner.tsx";
import {useNotifications} from "@/components/Notifications.tsx";
import InfoBanner from "@/components/InfoBanner.tsx";
import {useDownloader} from "@/components/Downloader.tsx";

type Modals = "unlink" | "installations" | "none";

const sideWindow = (
  url: string, target: string,
  onSuccess: () => void = () => {
  },
  onError: (error: Error) => void = () => {
  },
  width: number = 600, height: number = 700,
  messageType: string = "GITHUB_CALLBACK"
) => {
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

    if (event.data?.type === messageType) {
      cleanup();

      if (event.data?.error)
        onError(new Error(event.data.error));
      else
        onSuccess();
    }
  };

  const timer = setInterval(async () => {
    if (popup?.closed)
      cleanup();
  }, 500);

  const cleanup = () => {
    clearInterval(timer);
    window.removeEventListener("message", handleMessage);
  };

  window.addEventListener("message", handleMessage);
}

export default function Profile() {
  const {user, isLoading, refresh} = useAuth();
  const {pushNotification} = useNotifications();
  const {processZip} = useDownloader();
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState<Modals>("none");

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
    sideWindow(
      linkUrl,
      "GitHubLink",
      async () => {
        await refresh();
        await profileRefetch();
        pushNotification({
          type: "success",
          message: "GitHub account linked successfully",
          duration: 5
        });
      },
      (error) => pushNotification({
        type: "error",
        message: error.message || "Failed to link GitHub account",
        duration: 5
      })
    );
  };

  const unlinkGitHub = async () => {
    try {
      if (installations && installations?.length > 0)
        pushNotification({
          type: "warning",
          message: "You have installations linked to your account. Be sure to uninstall them in GitHub settings.",
          duration: 10
        });

      await unlinkAccount();
      await refresh();
      pushNotification({
        type: "success",
        message: "GitHub account unlinked successfully",
        duration: 5
      });
    } catch (error) {
      pushNotification({
        type: "error",
        message: (error as Error).message || "Failed to unlink GitHub account",
        duration: 5
      });
    } finally {
      handlePopUpClose();
    }
  }

  const addInstallation = () => {
    sideWindow(
      `${newInstallationUrl}`,
      "GitHubInstall",
      async () => {
        await installationsRefetch();
        handlePopUpClose();
      },
      (error) => {
        pushNotification({
          type: "error",
          message: (error as Error).message || "Failed to add installation",
          duration: 5
        });
        handlePopUpClose();
      }
    );
  };

  const downloadRepo = async (repo: Repository) => {
    pushNotification({
      type: "info",
      message: `Downloading repository ${repo.owner_login}/${repo.name}...`,
      duration: 5
    });

    try {
      const blob = await downloadRepositoryArchive(repo.owner_login, repo.name);
      const sha = await fetchRepositorySha(repo.owner_login, repo.name, repo.default_branch);
      await processZip(blob, "github", repo.id.toString(), sha);

      pushNotification({
        type: "success",
        message: `Repository ${repo.owner_login}/${repo.name} downloaded successfully`,
        duration: 5
      });
    } catch (error) {
      pushNotification({
        type: "error",
        message: `Failed to download repository ${repo.owner_login}/${repo.name}: ${(error as Error).message}`,
        duration: 15
      });
    }
  }

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
    enabled: Boolean(!isLoading && user?.githubId && (openModal === "installations" || openModal === "unlink")),
    staleTime: 1000 * 60 * 60 * 5,
  });

  const {
    data: repositories,
    isLoading: repositoriesLoading,
    error: repositoriesError
  } = useQuery({
    queryKey: ["repositories"],
    queryFn: async () => await fetchRepositories(),
    enabled: Boolean(!isLoading && user?.githubId),
    staleTime: 1000 * 60 * 60 * 5,
  });

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: profileRefetch
  } = useQuery({
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
      pushNotification({
        type: "error",
        message: (installationsError as Error).message || "Failed to fetch installations",
        duration: 5
      });
      handlePopUpClose();
    }
  }, [handlePopUpClose, installationsError, pushNotification]);

  useEffect(() => {
    if (repositoriesError) {
      pushNotification({
        type: "error",
        message: (repositoriesError as Error).message || "Failed to fetch repositories",
        duration: 5
      });
      handlePopUpClose();
    }
  }, [handlePopUpClose, pushNotification, repositoriesError]);

  useEffect(() => {
    if (profileError) {
      pushNotification({
        type: "error",
        message: (profileError as Error).message || "Failed to fetch profile",
        duration: 5
      });
      handlePopUpClose();
    }
  }, [handlePopUpClose, profileError, pushNotification]);

  const installationsStart = (installationsPage - 1) * installationsPageSize;
  const installationsShown = installations?.slice(installationsStart, installationsStart + installationsPageSize) ?? [];
  const repositoriesStart = (repositoriesPage - 1) * repositoriesPageSize;
  const repositoriesShown = repositories?.slice(repositoriesStart, repositoriesStart + repositoriesPageSize) ?? [];

  return (
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
              <Settings size={18} className="icon-margin-right"/>
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

                            <Link
                              to={"/edit"}
                              className="btn-primary"
                              aria-label={"Create and publish lesson"}
                              title="Create and publish a new lesson"
                            >
                              <Plus size={16} className="icon-margin-right"/>
                              Create and publish lesson
                            </Link>
                          </>
                        )}
                      </div>
                    ) : repositoriesShown.map((repo: Repository) => (
                      <RepositoryBanner
                        key={repo.id}
                        repo={repo}
                        actions={
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              aria-label={`Download repository ${repo.owner_login}/${repo.name}`}
                              title={`Download repository ${repo.owner_login}/${repo.name}`}
                              onClick={() => downloadRepo(repo)}
                            >
                              <DownloadCloud
                                size={"1em"}
                                className={user?.githubId ? "" : "icon-margin-right"}
                              />
                            </button>

                            <button
                              type="button"
                              className="btn-ghost"
                              aria-label={`Edit repository ${repo.owner_login}/${repo.name}`}
                              title={`Edit repository ${repo.owner_login}/${repo.name}`}
                            >
                              <Pencil size={"1em"}/>
                            </button>

                            <Link
                              to={repo.html_url}
                              target={"_blank"}
                              type="button"
                              className="btn-ghost"
                              aria-label={`Open repository ${repo.owner_login}/${repo.name} in GitHub`}
                              title={`Open repository ${repo.owner_login}/${repo.name} in GitHub`}
                            >
                              <ExternalLink size={"1em"}/>
                            </Link>
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
            <p>You will <strong>no longer</strong> be able to upload lessons to repositories and access your private
              repositories from WDA.</p>
            <p>You will still be able to download lessons in public repositories.</p>
            <p>Remote repositories and locally saved lessons will not be removed.</p>
            <p>You can link your account or a different one <strong>again anytime you want.</strong></p>

            {installations && installations.length > 0 && (
              <>
                <InfoBanner
                  type="warning"
                  message="You have installations linked to your account. Be sure to uninstall them with button below."
                  actions={manageButton()}
                />
              </>
            )}
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
  )
}