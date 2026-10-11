// -----------------------------------------------------------------------------
// HTTP client of a Palazzetti Connection Box.
//
// The box relays every command to the stove over a slow serial link and
// crashes or times out when two requests overlap (WPalaControl #69, Home
// Assistant #140215): each box gets its own queue, one request at a time.
//
// An answer is accepted only when `SUCCESS` is true AND `INFO.RSP` is "OK":
// the box answers HTTP 200 with `SUCCESS: false` and `RSP: "TIMEOUT"` when the
// stove does not answer, `RSP: "ERROR"` on a refused value.
// -----------------------------------------------------------------------------

import { HTTP_PATH, REQUEST_TIMEOUT_MS } from './constants.js';

export const ERROR_KINDS = {
  UNREACHABLE: 'unreachable', // the box does not answer (network, timeout)
  STOVE_TIMEOUT: 'stove_timeout', // the box answers, the stove does not
  REFUSED: 'refused', // the stove refused the command or the value
  INVALID: 'invalid', // not a Connection Box answer
};

export class PalazzettiError extends Error {
  /**
   * @param {string} kind - One of ERROR_KINDS.
   * @param {string} message - The message.
   * @param {object} [details] - `{ command, rsp }`.
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = 'PalazzettiError';
    this.kind = kind;
    this.command = details.command;
    this.rsp = details.rsp;
  }
}

/**
 * @description Build the URL of a command.
 * @param {string} host - `ip` or `ip:port`.
 * @param {string} command - `GET ALLS`, `SET SETP 21`…
 * @returns {string} The URL.
 * @example
 * commandUrl('192.168.1.40', 'SET SETP 21'); // 'http://192.168.1.40/cgi-bin/sendmsg.lua?cmd=SET+SETP+21'
 */
export function commandUrl(host, command) {
  return `http://${host}${HTTP_PATH}?${new URLSearchParams({ cmd: command })}`;
}

/**
 * @description Read the envelope of an answer.
 * @param {string} text - The body.
 * @param {string} command - The command sent, for the errors.
 * @returns {object} `DATA`.
 * @throws {PalazzettiError} When the answer is not a success.
 * @example
 * parseAnswer('{"INFO":{"RSP":"OK"},"SUCCESS":true,"DATA":{"SETP":21}}', 'GET SETP');
 */
export function parseAnswer(text, command) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new PalazzettiError(ERROR_KINDS.INVALID, `${command}: the answer is not JSON`, {
      command,
    });
  }
  if (!body || typeof body !== 'object' || !('SUCCESS' in body)) {
    throw new PalazzettiError(ERROR_KINDS.INVALID, `${command}: not a Connection Box answer`, {
      command,
    });
  }
  const rsp = String(body.INFO?.RSP ?? '');
  if (body.SUCCESS === true && (rsp === '' || rsp.toUpperCase() === 'OK')) {
    return body.DATA && typeof body.DATA === 'object' ? body.DATA : {};
  }
  const detail = body.INFO?.MSG ? ` (${body.INFO.MSG})` : '';
  if (rsp.toUpperCase() === 'TIMEOUT') {
    throw new PalazzettiError(
      ERROR_KINDS.STOVE_TIMEOUT,
      `${command}: the stove does not answer the box${detail}`,
      { command, rsp },
    );
  }
  throw new PalazzettiError(ERROR_KINDS.REFUSED, `${command}: refused by the stove${detail}`, {
    command,
    rsp,
  });
}

/**
 * @description Create the client of one Connection Box.
 * @param {object} options - Options.
 * @param {string} options.host - `ip` or `ip:port`.
 * @param {Function} [options.fetchImpl] - fetch, for the tests.
 * @param {number} [options.timeoutMs] - Timeout of one attempt.
 * @param {number} [options.retries] - Extra attempts when the box or the stove
 * does not answer (every command the integration sends is idempotent).
 * @param {number} [options.retryDelayMs] - Pause before a new attempt.
 * @returns {{ host: string, send: (command: string) => Promise<object> }} The client.
 * @example
 * const box = createClient({ host: '192.168.1.40' });
 * const data = await box.send('GET ALLS');
 */
export function createClient({
  host,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  retries = 1,
  retryDelayMs = 2000,
}) {
  let queue = Promise.resolve();

  const attempt = async (command) => {
    let response;
    try {
      response = await fetchImpl(commandUrl(host, command), {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? 'timeout' : err.cause?.code || err.message;
      throw new PalazzettiError(ERROR_KINDS.UNREACHABLE, `${host} unreachable: ${reason}`, {
        command,
      });
    }
    if (!response.ok) {
      throw new PalazzettiError(ERROR_KINDS.INVALID, `${command}: HTTP ${response.status}`, {
        command,
      });
    }
    return parseAnswer(await response.text(), command);
  };

  const run = async (command) => {
    for (let index = 0; ; index += 1) {
      try {
        return await attempt(command);
      } catch (err) {
        const transient =
          err.kind === ERROR_KINDS.UNREACHABLE || err.kind === ERROR_KINDS.STOVE_TIMEOUT;
        if (!transient || index >= retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  };

  return {
    host,
    send(command) {
      const result = queue.then(() => run(command));
      // The queue goes on whatever this command became.
      queue = result.catch(() => {});
      return result;
    },
  };
}
