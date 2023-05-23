/**
 * Normal exit
 */
export const EX_OK = 0;

/**
 * The command was used incorrectly, e.g., with the wrong number of
 * arguments, a bad flag, a bad syntax in a parameter, or whatever.
 */
export const EX_USAGE = 64;

/**
 * An error occurred while doing I/O on some file.
 */
export const EX_IOERR = 74;

/**
 * Temporary failure, indicating something that is not really an error.
 * In sendmail, this means that a mailer (e.g.) could not create a
 * connection, and the request should be reattempted later.
 */
export const EX_TEMPFAIL = 75;

/**
 * Fetching failed
 */
export const EX_FETCH_FAILED = 2;

/**
 * Synchronisation failed
 */
export const EX_SYNC_FAILED = 3;
