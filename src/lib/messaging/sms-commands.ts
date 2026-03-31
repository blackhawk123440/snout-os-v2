/**
 * SMS Command Parser
 * 
 * Parses YES/NO commands from SMS messages for offer acceptance/decline.
 */

/**
 * Check if message body matches an ACCEPT command
 */
export function isAcceptCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return normalized === 'YES' || normalized === 'Y' || normalized === 'ACCEPT';
}

/**
 * Check if message body matches a DECLINE command
 */
export function isDeclineCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return normalized === 'NO' || normalized === 'N' || normalized === 'DECLINE';
}

/**
 * Check if message body matches a STOP/unsubscribe command (TCPA compliance)
 */
export function isStopCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(normalized);
}

/**
 * Check if message body matches a HELP/info command (TCPA compliance)
 */
export function isHelpCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return ['HELP', 'INFO'].includes(normalized);
}

/**
 * Check if message body matches a START/re-subscribe command (TCPA compliance)
 */
export function isStartCommand(body: string): boolean {
  const normalized = body.trim().toUpperCase();
  return ['START', 'SUBSCRIBE', 'UNSTOP'].includes(normalized);
}

/**
 * Check if message body is a command (YES/NO/ACCEPT/DECLINE/STOP/HELP/START)
 */
export function isCommand(body: string): boolean {
  return isAcceptCommand(body) || isDeclineCommand(body) || isStopCommand(body) || isHelpCommand(body) || isStartCommand(body);
}
