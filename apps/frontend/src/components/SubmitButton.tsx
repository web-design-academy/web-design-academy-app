import { useState } from "react";
import { Loader2, Check, X, Send, RotateCw } from "lucide-react";

type SubmitState = "idle" | "loading" | "success" | "error";

interface SubmitButtonProps {
  onClick: () => Promise<boolean>;
  isSubmitted?: boolean;
}

export default function SubmitButton({
  onClick,
  isSubmitted = false,
}: SubmitButtonProps) {
  const [status, setStatus] = useState<SubmitState>("idle");

  const handleClick = async () => {
    if (status === "loading") return;

    setStatus("loading");
    try {
      const submitted = await onClick();
      if (!submitted) {
        setStatus("idle");
        return;
      }

      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <button
      className="btn-primary"
      onClick={handleClick}
      disabled={status === "loading"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "all 0.3s ease",
        backgroundColor:
          status === "success"
            ? "#10b981"
            : status === "error"
              ? "#ef4444"
              : isSubmitted
                ? "#10b981"
                : "var(--color-primary)",
        cursor: status === "loading" ? "wait" : "pointer",
      }}
    >
      {status === "idle" && isSubmitted && (
        <>
          <RotateCw size={16} /> Resubmit
        </>
      )}
      {status === "idle" && !isSubmitted && (
        <>
          <Send size={16} /> Submit
        </>
      )}
      {status === "loading" && <Loader2 size={16} className="spin" />}
      {status === "success" && (
        <>
          <Check size={16} /> Submitted
        </>
      )}
      {status === "error" && (
        <>
          <X size={16} /> Error
        </>
      )}
    </button>
  );
}
