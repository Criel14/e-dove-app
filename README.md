# 简介

用户端基于 [vite-uniapp-template](https://github.com/viarotel-org/vite-uniapp-template) 开发，项目具体内容请查看[后端部分](https://github.com/Criel14/e-dove-service)

> 不会写前端，但有 Claude Code 和 Codex 神力💪



# 部署

安装依赖：

```
pnpm install
```

修改配置：打开[.env.dev](https://github.com/Criel14/e-dove-app/blob/main/.env.dev#L5)文件，修改其中的后端ip地址：

**注意**：若需要在手机上**真机调试**，不能用`localhost`；

```properties
# API 根地址：改为你后端运行的地址，可用ipconfig命令查看
VITE_API_ORIGIN=http://你的后端运行的地址:8100
```

启动项目：

```
# 微信小程序
pnpm dev:mp-weixin
```

然后在微信开发者工具打开项目根目录下的`/dist`目录即可；



# 现存问题

> 这些问题不影响正常使用

## 无感刷新token

在 [src/api/index.js](https://github.com/Criel14/e-dove-app/blob/main/src/api/index.js#L50) 中，当接收到接口返回的401后，会调用接口刷新token，但成功后无法重新调用接口，因此无法做到无感刷新，用户再次点击接口才能正常使用；

```js
// 重新发起请求（下面的代码无法实现）
return await response.request()
```

## 真机调试

截止2026-02-15的微信开发者工具，在使用手机真机调试时，都会出现**无法连接局域网而切换至广域网**的问题，需要降低开发者工具版本到`1.06.2401020`，点击[这里](https://developers.weixin.qq.com/community/minihome/doc/000ea431ca0d4820ffd04b32d65401)下载；

## 身份码放大

在手机上真机调试没问题，但在模拟器或用PC端微信真机调试会出现一些样式问题；
