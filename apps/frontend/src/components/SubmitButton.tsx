import { useState } from "react";
import { Loader2, Check, X, Send, RotateCw } from "lucide-react";

type SubmitState = "idle" | "loading" | "success" | "error";

interface SubmitButtonProps {
  onClick: () => Promise<boolean>;
  isSubmitted?: boolean;
  disabled?: boolean;
  disabledTitle?: string;
}

export default function SubmitButton({
  onClick,
  isSubmitted = false,
  disabled = false,
  disabledTitle,
}: SubmitButtonProps) {
  const [status, setStatus] = useState<SubmitState>("idle");

  const handleClick = async () => {
    if (status === "loading" || disabled) return;

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
      disabled={status === "loading" || disabled}
      title={disabled ? disabledTitle : undefined}
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
        cursor:
          status === "loading" ? "wait" : disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
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
