/** 插件可复用的内核工具（日志、文件系统） */

export declare function log(message: string): void;
export declare namespace log {
  function step(message: string): void;
  function dim(message: string): void;
  function info(message: string): void;
  function warn(message: string): void;
  function success(message: string): void;
  function error(message: string): void;
  function setTarget(id: string | null): void;
}

export declare function ensureDir(dir: string): Promise<void>;
export declare function removeDir(dir: string): Promise<void>;
export declare function pathExists(target: string): Promise<boolean>;
export declare function copyFileSafe(from: string, to: string): Promise<void>;
export declare function walkFiles(
  dir: string,
  filter?: (file: string) => boolean,
): Promise<string[]>;
export declare function isTextFile(file: string): boolean;
