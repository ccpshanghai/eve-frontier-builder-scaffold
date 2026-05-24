import { ExchangeEvent } from "./types";

interface EventLogProps {
    events: ExchangeEvent[];
}

function truncateDigest(digest: string) {
    return digest.length > 10 ? `${digest.slice(0, 10)}...` : digest;
}

export function EventLog({ events }: EventLogProps) {
    if (events.length === 0) return null;

    const recent = events.slice(-5);

    return (
        <section className="st-panel st-event-log" aria-labelledby="st-event-log-title">
            <header className="st-panel__head">
                <div>
                    <h2 id="st-event-log-title" className="st-eyebrow">
                        EVENT LOG
                    </h2>
                    <div className="st-panel__note">Full-width bottom terminal panel.</div>
                </div>
                <div className="st-counter" aria-label="Event sources">
                    <span>LOCAL</span>
                    <span className="st-counter__ready">CHAIN</span>
                </div>
            </header>
            <div
                className="st-event-log__body"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-labelledby="st-event-log-title"
            >
                {recent.map((event, i) => (
                    <div key={`${event.timestamp}-${i}`} className={`st-event-log__line st-event-log__line--${event.type}`}>
                        &gt; {event.message}
                        {event.digest && <span className="st-event-log__digest"> {truncateDigest(event.digest)}</span>}
                    </div>
                ))}
            </div>
        </section>
    );
}
