import {useEffect, useState} from "react";
import {useNavigate, useSearchParams} from "react-router";

export default function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");

    if (window.opener) {
      window.opener.postMessage(
        {
          type: "GITHUB_CALLBACK",
          error: error || null,
        },
        window.location.origin
      );

      if (error)
        setError(error);
      else
        window.close();
    } else {
      navigate("/settings", {replace: true});
    }
  }, [searchParams, navigate]);

  return (
    <div style={{textAlign: "center", padding: "2rem"}}>
      <h1>GitHub Account Linking</h1>
      {error ? <p style={{color: "red"}}>{error}</p> : <p>GitHub account linking done. Closing window...</p>}
    </div>
  );
}