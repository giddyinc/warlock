
export class WarlockError extends Error {
    private maxAttempts: number;
    private key: string;
    private ttl: number;
    private wait: number;
    constructor(message: string, props: {
        maxAttempts: number;
        key: string;
        ttl: number;
        wait: number;
    }) {
        super(message);

        Error.captureStackTrace(this, WarlockError);
        this.maxAttempts = props.maxAttempts;
        this.key = props.key;
        this.ttl = props.ttl;
        this.wait = props.wait;
    }
}
