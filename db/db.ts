import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export function isTransientDbError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error || '');
	const normalized = message.toLowerCase();

	return (
		normalized.includes('fetch failed') ||
		normalized.includes('error connecting to database') ||
		normalized.includes('connection terminated') ||
		normalized.includes('network error') ||
		normalized.includes('econnrefused') ||
		normalized.includes('econnreset') ||
		normalized.includes('etimedout') ||
		normalized.includes('eai_again') ||
		normalized.includes('enotfound') ||
		normalized.includes('socket hang up')
	);
}

export function getDbErrorDetails(error: unknown) {
	const message = error instanceof Error ? error.message : String(error || 'Unknown database error');
	const cause =
		error && typeof error === 'object' && 'cause' in error
			? (error as { cause?: unknown }).cause
			: undefined;
	const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';

	return causeMessage ? `${message} | cause: ${causeMessage}` : message;
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number) {
	const base = Math.min(300 * 2 ** attempt, 2400);
	const jitter = Math.floor(Math.random() * 120);
	return base + jitter;
}

export async function queryWithRetry<T>(operation: () => Promise<T>, retries = 4) {
	let lastError: unknown;

	for (let attempt = 0; attempt <= retries; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;

			const shouldRetry = attempt < retries && isTransientDbError(error);
			if (!shouldRetry) {
				throw error;
			}

			// Exponential backoff with jitter for temporary transport/connectivity issues.
			await wait(getBackoffDelayMs(attempt));
		}
	}

	throw lastError;
}

export default sql;