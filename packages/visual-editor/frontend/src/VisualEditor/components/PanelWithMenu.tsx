export type PanelType = "add" | "attr" | "style" | "style-from-attr" | null;

export default  function PanelWithMenu({
  activePanel,
  setActivePanel,
  children,
  title,
  icon,
  isDark
}: {
  activePanel: PanelType;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelType>>;
  children: React.ReactNode;
  title: string;
  icon: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <div 
    className={`relative border border-zinc-700 rounded-lg shadow-lg w-100 z-50
  ${isDark
    ? "bg-zinc-700 text-white"
    : "bg-zinc-200 text-black"
  }`}>
      {/* Header s menu */}
      <div className="flex items-center justify-between border-b border-zinc-700">
        <div className="flex items-center gap-2 px-3 py-2 text-sm ">
          {icon}
          <span>{title}</span>
        </div>
        <div className="flex gap-1 px-3 py-2">
          <button
            onClick={() => setActivePanel("add")}
className={`px-2 py-1 rounded text-xs transition
  ${
    activePanel === "add"
      ? "bg-green-600 text-white"
      : isDark
        ? "hover:bg-zinc-700 text-zinc-300"
        : "hover:bg-zinc-200 text-black"
  }`}          >Add</button>
          <button
            onClick={() => setActivePanel("attr")}
className={`px-2 py-1 rounded text-xs transition
  ${
    activePanel === "attr"
      ? "bg-green-600 text-white"
      : isDark
        ? "hover:bg-zinc-700 text-zinc-300"
        : "hover:bg-zinc-200 text-black"
  }`}          >Attributes</button>
          <button
            onClick={() => setActivePanel("style")}
className={`px-2 py-1 rounded text-xs transition
  ${
    activePanel === "style"
      ? "bg-green-600 text-white"
      : isDark
        ? "hover:bg-zinc-700 text-zinc-300"
        : "hover:bg-zinc-200 text-black"
  }`}          >Style</button>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">{children}</div>
    </div>
  );
}
