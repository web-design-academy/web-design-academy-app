import {X} from "lucide-react";

interface Props {
  error: Error;
  action: () => void;
  actionText?: string;
}

export default function ErrorBanner({error, action, actionText = "Close"} : Props) {
  return (
    <div className="error">
      <X className="error-cross"/>
      <div>
        {error.message}
      </div>
      <button
        onClick={action}
        className="btn-ghost"
      >{actionText}</button>
    </div>
  )
}