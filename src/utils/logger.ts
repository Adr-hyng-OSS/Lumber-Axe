// Import your configuration if necessary

import { system } from "@minecraft/server";
import { serverConfigurationCopy } from "index";

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  ERROR = 'ERROR',
}

export class Logger {
  private static level: LogLevel = serverConfigurationCopy.debug.defaultValue ? LogLevel.DEBUG : LogLevel.INFO; // Default log level

  static setLogLevel(level: LogLevel): void {
    Logger.level = level;
  }

  private static log(level: LogLevel, ...message: any[]): void {
    const levels: LogLevel[] = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(Logger.level);
    const logLevelIndex = levels.indexOf(level);

    if (logLevelIndex >= currentLevelIndex && serverConfigurationCopy.debug.defaultValue) {
      // const timestamp = Date.now();
      const timestamp = system.currentTick;
      const formattedMessage = `[${timestamp}] [${level}] - ${message}`;

      switch (level) {
        case LogLevel.DEBUG:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.log(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
      }
    }
  }

  static debug(...message: any[]): void {
    if(serverConfigurationCopy.debug.defaultValue) Logger.log(LogLevel.DEBUG, message);
  }

  static info(...message: any[]): void {
    if(serverConfigurationCopy.debug.defaultValue) Logger.log(LogLevel.INFO, message);
  }

  static error(...message: any[]): void {
    if(serverConfigurationCopy.debug.defaultValue) Logger.log(LogLevel.ERROR, message);
  }
}