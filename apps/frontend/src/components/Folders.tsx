import Modal from "@/components/Modal.tsx";
import React from "react";
import InfoBanner from "@/components/InfoBanner.tsx";
import {FolderPlus, InfoIcon} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Folders({isOpen, onClose}: Props) {
  const hasDirectoryPicker = "showDirectoryPicker" in window;

  const folderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files)
      return;

    for (const file of files) {
      console.log(file);
    }
  }

  return (
    <Modal
      title="Lesson folders"
      isOpen={isOpen}
      onClose={onClose}
      actions={(
        <button
          className="btn-ghost"
          onClick={onClose}
        >
          Close
        </button>
      )}
      children={
        <div className="folders-body">
          {!hasDirectoryPicker && (
            <InfoBanner
              type="warning"
              icon={(<InfoIcon/>)}
              message="Writing to folders is not supported Firefox and Safari browsers. Use Chromium based browsers."
            />

          )}

          <div>Selected folders to enable automatic scanning and importing lessons from your local file system.</div>

          <div>
            {hasDirectoryPicker ?
              <button
                onClick={() => window.showDirectoryPicker()}
              >
                Select Folder
              </button>
              : (
                <div>
                  <label
                    className="btn-primary"
                    htmlFor="folders-file-input"
                  >
                    <FolderPlus className="icon-margin-right"/>
                    Select folders
                  </label>
                  <input
                    className="folders-file-input"
                    id="folders-file-input"
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={folderSelect}
                  />
                </div>
              )}
          </div>

          <div>
            <h3>Selected folders</h3>
          </div>
        </div>
      }
    />
  )
}