import type {ReactNode} from "react";

type InfoType = "error" | "warning" | "info";

interface Props {
  type: InfoType;
  icon: ReactNode;
  message: string;
  actions?: ReactNode;
}

export default function InfoBanner({type = "info", icon, message, actions}: Props) {
  return (
    <div className={`info-banner ${type}`}>
      <div className="info-banner-icon">
        {icon}
      </div>
      <div>
        {message}
      </div>
      <div className="info-banner-actions">
        {actions}
      </div>
    </div>
  )
}