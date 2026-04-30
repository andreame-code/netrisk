export function LoadingAnimation() {
  return (
    <div className="loading-animation" data-testid="loading-animation" aria-hidden="true">
      <span className="loading-animation-orbit" />
      <span className="loading-animation-path" />
      <span className="loading-animation-node loading-animation-node-a" />
      <span className="loading-animation-node loading-animation-node-b" />
      <span className="loading-animation-node loading-animation-node-c" />
      <span className="loading-animation-node loading-animation-node-d" />
    </div>
  );
}
