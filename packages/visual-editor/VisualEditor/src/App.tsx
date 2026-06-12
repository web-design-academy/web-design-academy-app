import { useState } from "react";
import VisualEditor from "./VisualEditor/VisualEditor";

export default function App() {
  const [task, setTask] = useState({
    editableHtml: "<h1 class='text'>Hello</h1>",
    editableCss: "h1{color:red}",
  });
  const onTaskChange = (field: "editableHtml" | "editableCss", value: string) => {
    setTask((prev) => ({ ...prev, [field]: value }));
  };
  const [isDark] = useState(true);

  return (
    <VisualEditor
      content={task.editableHtml}
      setContent={(val: any) =>
        onTaskChange(
          "editableHtml",
          typeof val === "function" ? val(task.editableHtml) : val
        )
      }
      cssContent={task.editableCss}
      setCssContent={(val: any) =>
        onTaskChange(
          "editableCss",
          typeof val === "function" ? val(task.editableCss) : val
        )
      }
      isDark={isDark} 
    />
  );
}