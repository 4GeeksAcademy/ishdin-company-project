interface LoadingStateProps {
  label?: string;
}

const LoadingState = ({ label = "Loading..." }: LoadingStateProps) => {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
};

export default LoadingState;
