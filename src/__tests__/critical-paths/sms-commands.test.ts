import { describe, it, expect } from 'vitest';
import {
  isAcceptCommand,
  isDeclineCommand,
  isStopCommand,
  isHelpCommand,
  isStartCommand,
  isCommand,
} from '@/lib/messaging/sms-commands';

describe('SMS command parser', () => {
  describe('accept commands', () => {
    it.each(['YES', 'yes', 'Yes', 'Y', 'y', 'ACCEPT', 'accept'])('recognizes "%s"', (cmd) => {
      expect(isAcceptCommand(cmd)).toBe(true);
    });
    it('rejects non-accept', () => {
      expect(isAcceptCommand('NO')).toBe(false);
      expect(isAcceptCommand('STOP')).toBe(false);
    });
  });

  describe('decline commands', () => {
    it.each(['NO', 'no', 'N', 'n', 'DECLINE', 'decline'])('recognizes "%s"', (cmd) => {
      expect(isDeclineCommand(cmd)).toBe(true);
    });
  });

  describe('STOP commands (TCPA)', () => {
    it.each(['STOP', 'stop', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'])('recognizes "%s"', (cmd) => {
      expect(isStopCommand(cmd)).toBe(true);
    });
    it('handles whitespace', () => {
      expect(isStopCommand('  STOP  ')).toBe(true);
    });
    it('rejects non-stop', () => {
      expect(isStopCommand('YES')).toBe(false);
      expect(isStopCommand('STOPPING')).toBe(false);
    });
  });

  describe('HELP commands (TCPA)', () => {
    it.each(['HELP', 'help', 'INFO', 'info'])('recognizes "%s"', (cmd) => {
      expect(isHelpCommand(cmd)).toBe(true);
    });
    it('rejects non-help', () => {
      expect(isHelpCommand('HELPING')).toBe(false);
    });
  });

  describe('START commands (TCPA)', () => {
    it.each(['START', 'start', 'SUBSCRIBE', 'UNSTOP'])('recognizes "%s"', (cmd) => {
      expect(isStartCommand(cmd)).toBe(true);
    });
  });

  describe('isCommand catches all', () => {
    it('recognizes all command types', () => {
      expect(isCommand('YES')).toBe(true);
      expect(isCommand('NO')).toBe(true);
      expect(isCommand('STOP')).toBe(true);
      expect(isCommand('HELP')).toBe(true);
      expect(isCommand('START')).toBe(true);
    });
    it('rejects regular messages', () => {
      expect(isCommand('Hello there')).toBe(false);
      expect(isCommand('When is my visit?')).toBe(false);
    });
  });
});
