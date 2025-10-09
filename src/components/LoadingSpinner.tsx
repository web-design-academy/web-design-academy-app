import "@/styles/spinner.css";

export default function LoadingSpinner() {
  return (
    <div className="spinner-container">
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading"
        className="spinner"
      />
    </div>
  );
}
