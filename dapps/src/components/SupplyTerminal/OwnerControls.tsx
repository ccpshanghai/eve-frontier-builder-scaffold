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
    onConfigure,
}: OwnerControlsProps) {
    if (!isOwner) return null;

    if (extensionAuthorized) {
        return (
            <div className="st-auth-banner st-auth-banner--ok">
                <div className="st-auth-copy">
                    <span className="st-pulse st-pulse--ok" aria-hidden="true" />
                    <div>
                        <div className="st-auth-title">EXTENSION AUTHORIZED</div>
                        <div className="st-auth-detail">Terminal item movement is enabled.</div>
                    </div>
                </div>
                <button className="st-button st-button--secondary" type="button" onClick={onConfigure}>
                    CONFIGURE
                </button>
            </div>
        );
    }

    return (
        <div className="st-auth-banner">
            <div className="st-auth-copy">
                <span className="st-pulse" aria-hidden="true" />
                <div>
                    <div className="st-auth-title">EXTENSION NOT AUTHORIZED</div>
                    <div className="st-auth-detail">
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
