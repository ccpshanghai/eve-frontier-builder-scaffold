import { ExchangeEvent } from "./types";

interface EventLogProps {
    events: ExchangeEvent[];
}

function truncateDigest(digest: string) {
    return `${digest.slice(0, 10)}...`;
}

export function EventLog({ events }: EventLogProps) {
    if (events.length === 0) return null;

    return (
        <section className="st-panel st-event-log">
            <header className="st-panel__head">
                <div>
                    <div className="st-eyebrow">EVENT LOG</div>
                    <div className="st-panel__note">Full-width bottom terminal panel.</div>
                </div>
                <div className="st-counter" aria-label="Event sources">
                    <span>LOCAL</span>
                    <span className="st-counter__ready">CHAIN</span>
                </div>
            </header>
            <div className="st-event-log__body">
                {events.map((event, i) => (
                    <div key={`${event.timestamp}-${i}`} className={`st-event-log__line st-event-log__line--${event.type}`}>
                        &gt; {event.message}
                        {event.digest && <span className="st-event-log__digest"> {truncateDigest(event.digest)}</span>}
                    </div>
                ))}
            </div>
        </section>
    );
}
