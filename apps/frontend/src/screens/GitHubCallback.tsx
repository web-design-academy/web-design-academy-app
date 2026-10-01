import {useEffect} from "react";
import {useNavigate, useSearchParams} from "react-router";

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const error = searchParams.get("error");

    if (window.opener) {
      window.opener.postMessage(
        {
          type: "GITHUB_AUTH_COMPLETED",
          error: error || null,
        },
        window.location.origin
      );

      window.close();
    } else {
      navigate("/settings", {replace: true});
    }
  }, [searchParams, navigate]);

  return (
    <div style={{textAlign: "center", padding: "2rem"}}>
      <p>GitHub account linking done. Closing window...</p>
    </div>
  );
}