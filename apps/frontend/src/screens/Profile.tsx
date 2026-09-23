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
import {API_BASE} from "@/lib/api/client.ts";
import {useQuery} from "@tanstack/react-query";
import InfoBanner from "@/components/InfoBanner.tsx";
import RepositoryBanner, {type Repository} from "@/components/Dashboard/RepositoryBanner.tsx";

type Modals = "scopes" | "unlink" | "remote" | "none";

const PAGE_SIZE = 5;

export default function Profile() {
  const { user, isLoading, refresh } = useAuth();
  const navigate = useNavigate();
  const [ openModal, setOpenModal ] = useState<Modals>("none");
  const [ remotePage, setRemotePage ] = useState<number>(1);
  const [ error, setError ] = useState<Error | null>(null);
  const [remoteStart, setRemoteStart] = useState(0);
  const [shownRemotes, setShownRemotes] = useState<Repository[]>([])

  const scopeDescriptions = new Map<string, string>([
    ["repo", "Read and write access to public and private repositories, including file contents, commit statuses, and collaborators."],
    ["user", "Read/write access to profile info, including public email address, followers and following."],
    ["read:user", "Read access to a user's profile info, including public email address, followers, and following."],
  ]);

  const handlePopUpClose = useCallback(() => {
    setOpenModal("none");
  }, [setOpenModal]);

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

  const linkGitHub = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    console.log(`${API_BASE}/github/link`)
    const popup = window.open(
      `${API_BASE}/github/link`,
      "github_oauth_popup",
      `width=${width},height=${height},top=${top},left=${left},status=no,resizable=yes`
    );

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin)
        return;

      if (event.data?.type === "GITHUB_AUTH_SUCCESS") {
        cleanup();
        await refresh();
      }

      if (event.data?.type === "GITHUB_AUTH_ERROR") {
        cleanup();
      }
    };

    const timer = setInterval(() => {
      if (popup?.closed) {
        cleanup();
      }
    }, 500);

    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener("message", handleMessage);
    };

    window.addEventListener("message", handleMessage);
  }

  const unlinkGitHub = async () => {
    try {
      const response = await fetch(`${API_BASE}/github/link`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include"
      });

      if (!response.ok)
        throw new Error("Failed to unlink GitHub account");

      await refresh();
      setOpenModal("none");
    } catch (error) {
      setError(error as Error);
      handlePopUpClose();
    }
  }

  const addRemote = async (repoId: number) => {
    try {
      const response = await fetch(`${API_BASE}/repositories/${repoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include"
      });

      if (!response.ok)
        throw new Error("Failed to add remote repository");
    } catch (error) {
      setError(error as Error);
      handlePopUpClose();
    } finally {
      await remoteRefetch();
      await addedRefetch();
    }
  }

  const removeRemote = async (repoId: number) => {
    try {
      const response = await fetch(`${API_BASE}/repositories/${repoId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include"
      });

      if (!response.ok)
        throw new Error("Failed to remove remote repository");
    } catch (error) {
      setError(error as Error);
      handlePopUpClose();
    } finally {
      await remoteRefetch();
      await addedRefetch();
    }
  }

  const linkGitHubButton = () => (
    <button
      type="button"
      className="btn-primary signin-button"
      onClick={() => linkGitHub()}
    >
      <GitHubIcon size={18} />
      Link GitHub
    </button>
  );

  const remoteButton = () => (
    <button
      type="button"
      className="btn-primary"
      onClick={() => setOpenModal("remote")}
    >
      <Plus size={16} className="icon-margin-right"/>
      Add remote repository
    </button>
  );

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  const { data: addedData, isLoading: addedLoading, error: addedError, refetch: addedRefetch } = useQuery({
    queryKey: ["tracked"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/repositories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include"
      });

      if (!response.ok)
        throw new Error("Failed to fetch tracked repositories");

      return await response.json() as Promise<Repository[]>;
    },
    enabled: Boolean(!isLoading),
    staleTime: Infinity,
  });
  
  const { data: remoteData, isLoading: remoteLoading, error: remoteError, refetch: remoteRefetch } = useQuery({
    queryKey: ["remotes"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/github/repositories`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include"
      });

      if (!response.ok)
        throw new Error("Failed to fetch repositories");
      return await response.json() as Repository[];
    },
    enabled: Boolean(!isLoading && user?.githubId),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (addedError) {
      setError(addedError);
      handlePopUpClose();
    }
  }, [handlePopUpClose, addedError]);

  useEffect(() => {
    if (remoteError) {
      setError(remoteError);
      handlePopUpClose();
    }
  }, [handlePopUpClose, remoteError]);

  useEffect(() => {
    if (remoteData) {
      setRemoteStart((remotePage - 1) * PAGE_SIZE);
      setShownRemotes(remoteData.slice(remoteStart, remoteStart + PAGE_SIZE));
    }
  }, [remoteData, remotePage, remoteStart]);

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
          {user?.githubId && (
            <GitHubAvatar className="profile-header-avatar" imageSize={72} url={user?.githubAvatarUrl} />
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

            {isLoading ? (
              <LoadingSpinner />
            ) : user?.githubId ? (
              <>
                <div className="profile-panel-item">
                  <span>GitHub Name:</span>
                  <strong>{user?.githubName} <span className="italic">({user?.githubLogin})</span></strong>
                </div>

                <div className="profile-panel-item">
                  <span>GitHub ID:</span>
                  <strong>{user?.githubId}</strong>
                </div>
              </>
            ) : (
              <div className="profile-section-info border">
                <h4>Link GitHub account to view more information</h4>

                {linkGitHubButton()}
              </div>
            )}

            {user?.githubId && (
              <div className="profile-panel-item end">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setOpenModal("scopes")}
                >
                  View scopes
                </button>

                <button
                  type="button"
                  className="btn-ghost signin-button"
                  onClick={() => {setOpenModal("unlink")}}
                >
                  <GitHubIcon size={18} />
                  Unlink GitHub
                </button>
              </div>
            )}
          </div>

          <div className="profile-section profile-larger">
            <div className="profile-section profile-section-panel">
              <div className="profile-repositories-header">
                <h2>Tracked repositories</h2>

                {user?.githubId && remoteButton()}
              </div>

              <div className="profile-repositories">
                {!user?.githubId && (
                  <div className="profile-section-info border">
                    <h4>Link GitHub account to access your remote repositories</h4>

                    {linkGitHubButton()}
                  </div>
                )}

                {addedLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    {addedData?.length === 0 && (
                      <div className="profile-section-info big">
                        <h4>You have no tracked remote repositories</h4>

                        {user?.githubId && (
                          <>
                            {remoteButton()}

                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => navigate("/edit")}
                            >
                              <Plus size={16} className="icon-margin-right" />
                              Create and publish lesson
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {addedData?.map((repo: Repository) => (
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
                                  <Pencil size={16} />
                                </button>

                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={() => removeRemote(repo.id)}
                                >
                                  <X size={16} />
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
            </div>

            <Pagination
              page={1}
              pageSize={12}
              total={0}
              onChange={() => {}}
            />
          </div>
        </section>

        <Modal
          title="Available scopes"
          isOpen={openModal === "scopes"}
          onClose={handlePopUpClose}
          actions={
            <button type="button" className="btn-primary" onClick={handlePopUpClose}>
              Close
            </button>
          }
          children={
            <div className="profile-scopes">
              {JSON.parse(user?.githubScopes ?? "[]").map((scope: string) => (
                <div className="profile-scope-item">
                  <h3>{scope}</h3>
                  <div>{scopeDescriptions.get(scope)}</div>
                </div>
              ))}

              <div className="profile-scopes-footer">
                For more information on scopes, see the <a href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps#available-scopes" target="_blank" rel="noopener noreferrer">GitHub documentation</a>.
              </div>
            </div>
          }
        />

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
              <p><strong>You can link your account or a different one again anytime you want.</strong></p>
            </div>
          }
        />

        <Modal
          className="profile-modal-large"
          title="Remote repositories"
          isOpen={openModal === "remote"}
          onClose={handlePopUpClose}
          children={
            <>
              {remoteLoading ? <LoadingSpinner /> : (
                <div className="profile-remote-repositories">
                  <div className="profile-repositories">
                    {shownRemotes.map((repo) => (
                      <RepositoryBanner
                        repo={repo}
                        actions={addedData && addedData.some((r: Repository) =>
                          Math.floor(r.id) === Math.floor(repo.id)) ? (
                          <button
                            type="button"
                            className="btn-ghost disabled"
                            disabled
                          >
                            <Plus size={16} className={user?.githubId ? "" : "icon-margin-right"}/>
                            Already added
                          </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => addRemote(repo.id)}
                            >
                              <Plus size={16} className={user?.githubId ? "" : "icon-margin-right"}/>
                              Add
                            </button>
                          )
                        }
                      />
                    ))}
                  </div>

                  <Pagination
                    page={remotePage}
                    pageSize={PAGE_SIZE}
                    total={remoteData?.length || 0}
                    onChange={(page) => {
                      setRemotePage(page)
                    }}
                  />
                </div>
              )}
            </>
          }
        />
      </main>
    </>
  )
}