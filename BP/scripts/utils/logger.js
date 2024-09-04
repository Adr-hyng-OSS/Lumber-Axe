import { system } from "@minecraft/server";
import { serverConfigurationCopy } from "index";
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    static setLogLevel(level) {
        Logger.level = level;
    }
    static log(level, ...message) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.ERROR];
        const currentLevelIndex = levels.indexOf(Logger.level);
        const logLevelIndex = levels.indexOf(level);
        if (logLevelIndex >= currentLevelIndex && serverConfigurationCopy.debug.defaultValue) {
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
    static debug(...message) {
        if (serverConfigurationCopy.debug.defaultValue)
            Logger.log(LogLevel.DEBUG, message);
    }
    static info(...message) {
        if (serverConfigurationCopy.debug.defaultValue)
            Logger.log(LogLevel.INFO, message);
    }
    static error(...message) {
        if (serverConfigurationCopy.debug.defaultValue)
            Logger.log(LogLevel.ERROR, message);
    }
}
Logger.level = serverConfigurationCopy.debug.defaultValue ? LogLevel.DEBUG : LogLevel.INFO;
