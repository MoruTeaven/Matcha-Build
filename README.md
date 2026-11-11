# @moruteaven/matchabuild

配置驱动的多端构建编排器：一条命令构建 web / uTools / ZTools / tauri / taro，产物统一输出到 `dist/`。

官方内核只内置 **web（vite）**；其余端通过插件接入：

| 端 | 插件包 |
| --- | --- |
| 微信小程序 / 抖音小程序 / H5 | `@moruteaven/matchabuild-plugin-taro` |
| 桌面（Tauri 安装包） | `@moruteaven/matchabuild-plugin-tauri` |
| uTools 插件 | `@moruteaven/matchabuild-plugin-utools` |
| ZTools 插件 | `@moruteaven/matchabuild-plugin-ztools` |

## 安装

```bash
pnpm add -D @moruteaven/matchabuild          # 内核：web 构建 + 门禁 + 产物契约
pnpm add -D @moruteaven/matchabuild-plugin-taro   # 按需：小程序
pnpm add -D @moruteaven/matchabuild-plugin-tauri  # 按需：桌面
```

要求 Node >= 20.10。构建 web / uTools / ZTools 需要 `vite >= 5`（peer，可选）。

> **pnpm 11 必读**：pnpm 11 默认拦截依赖的安装脚本，esbuild 装不上会导致 vite 构建失败
> （`ERR_PNPM_IGNORED_BUILDS`）。在项目根的 `pnpm-workspace.yaml` 里放行：
>
> ```yaml
> allowBuilds:
>   esbuild: true
> ```

## 快速开始

在项目根建一个 `build.config.ts`：

```ts
import { defineBuildConfig } from '@moruteaven/matchabuild';
import taroPlugin from '@moruteaven/matchabuild-plugin-taro';
import react from '@vitejs/plugin-react';

export default defineBuildConfig({
  app: { name: 'my-app', displayName: '我的应用' },
  // runner 插件：未注册的 runner 会报错并提示安装哪个插件包
  plugins: [taroPlugin],
  outDir: 'dist',
  targets: {
    web: {
      runner: 'vite',
      dir: 'clients/web',
      outDir: 'dist/web',
      base: '/',
      plugins: [react()],
    },
    taro: {
      runner: 'taro',
      dir: 'clients/taro',
      outDir: 'dist/taro',
      platforms: ['weapp', 'tt', 'h5'],
    },
  },
});
```

然后：

```bash
matcha build          # 构建全部就绪的端
matcha build web      # 只构建一个端
matcha dev web        # 起开发服务器（HMR）
matcha verify         # 产物契约门禁
matcha doctor         # 环境自检
matcha graph          # 打印 target 依赖图
matcha clean          # 清空产物
```

## 产物契约

- 多平台 runner（taro / tauri）的产物按 `dist/<target>/<platform>/` 分层归集；平台族 runner 即使当前只有一个平台也预建第二层。
- 每次构建生成 `dist/build-manifest.json`：版本、各端文件数与字节数、内容哈希、门禁结果。
- 产物自包含：不引用 `node_modules`、不引用仓库内其它源码路径。

## 门禁

`build.config.ts` 的 `gates.enabled` 里开启，失败即构建失败：

- `manifest-integrity`：平台清单引用的文件必须存在（logo / preload / main 断链检测）
- `no-core-leak`：产物里不得残留共享包源码引用或路径
- `env-leak`：敏感环境变量值不得被打进产物
- `bom`：产物文本文件不得带 BOM

## 许可

MIT
