interface OwnerControlsProps {
  isOwner: boolean;
  extensionAuthorized: boolean;
  onAuthorize: () => void;
  isAuthorizing: boolean;
  onConfigure: () => void;
}

export function OwnerControls({
  isOwner,
  extensionAuthorized,
  onAuthorize,
  isAuthorizing,
}: OwnerControlsProps) {
  if (!isOwner) return null;

  if (extensionAuthorized) {
    return null;
  }

  return (
    <div className="st-auth-banner">
      <div className="st-auth-banner__copy">
        <span className="st-pulse" aria-hidden="true" />
        <div>
          <div className="st-auth-banner__title">EXTENSION NOT AUTHORIZED</div>
          <div className="st-auth-banner__detail">
            Owner action required before terminal item movement.
          </div>
        </div>
      </div>
      <button
        className="st-button"
        type="button"
        onClick={onAuthorize}
        disabled={isAuthorizing}
      >
        {isAuthorizing ? "AUTHORIZING" : "AUTHORIZE"}
      </button>
    </div>
  );
}
