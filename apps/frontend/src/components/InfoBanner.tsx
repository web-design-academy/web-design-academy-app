import type {CSSProperties, ReactNode} from "react";
import type {NotificationType} from "@/components/Notifications.tsx";
import {AlertTriangleIcon, CheckCircleIcon, InfoIcon, X, XCircleIcon} from "lucide-react";

interface Props {
  type: NotificationType;
  message: string;
  duration?: number; // seconds
  closeAction?: () => void;
  actions?: ReactNode;
}

export default function InfoBanner({type = "info", message, duration, closeAction, actions}: Props) {
  const iconSize = "1.2em";

  return (
    <div
      className={`info-banner ${type}`}
    >
      <div
        className={`info-banner-header ${type} ${duration ? "has-timer" : ""}`}
        style={duration ? {"--duration": `${duration}s`} as CSSProperties : {}}
      >
        <div className="info-banner-header-icon">
          {type === "info" && <InfoIcon size={iconSize}/>}
          {type === "success" && <CheckCircleIcon size={iconSize}/>}
          {type === "warning" && <AlertTriangleIcon size={iconSize}/>}
          {type === "error" && <XCircleIcon size={iconSize}/>}
        </div>

        <div className={"info-banner-header-title"}>
          {type}
        </div>

        {closeAction && (
          <button
            className={"btn-ghost"}
            onClick={closeAction}
          >
            <X size={iconSize}/>
          </button>
        )}
      </div>

      <div className={"info-banner-content"}>
        {message}
      </div>

      <div className="info-banner-actions">
        {actions}
      </div>
    </div>
  )
}