import { useState, useRef } from "react";
import { ArrowLeft, ArrowRight, XCircle, Check } from "lucide-react";

type Lesson = {
  name: string;
  Explanation: React.ComponentType;
  tasks: { index: number; html: string; css: string }[];
};

type Props = {
  openScenario: boolean;
  currentScenario: Lesson | null;
  taskIndex: number;
  next: () => void;
  prev: () => void;
  setOpenScenario: () => void; // ✅ změněno
};

export default function ScenarioPanel({
  openScenario,
  currentScenario,
  taskIndex,
  next,
  prev,
  setOpenScenario,
}: Props) {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  if (!openScenario || !currentScenario) return null;

  const Explanation = currentScenario.Explanation;

  return (
    <div
      onMouseMove={(e) => {
        if (!dragging.current) return;
        setPosition({
          x: e.clientX - offset.current.x,
          y: e.clientY - offset.current.y,
        });
      }}
      onMouseUp={() => (dragging.current = false)}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 50,
      }}
      className="w-96 bg-white text-black rounded-xl shadow-2xl border overflow-hidden"
    >
      {/* HEADER */}
      <div
        onMouseDown={(e) => {
          dragging.current = true;
          offset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
          };
        }}
        className="flex justify-between items-center bg-gray-100 px-4 py-2 cursor-move"
      >
        <h3 className="font-bold">{currentScenario.name}</h3>

        {/* ❌ původně setOpenScenario(false) */}
        <button onClick={setOpenScenario}>
          <XCircle />
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-2 text-sm max-h-32 overflow-y-auto">
        <Explanation />
      </div>

      {/* FOOTER */}
      <div className="flex justify-between p-3 border-t">
        <button onClick={prev} disabled={taskIndex === 0}>
          <ArrowLeft />
        </button>

        {taskIndex < currentScenario.tasks.length - 1 ? (
          <button onClick={next}>
            <ArrowRight />
          </button>
        ) : (
          <button onClick={setOpenScenario}>
            <Check />
          </button>
        )}
      </div>
    </div>
  );
}