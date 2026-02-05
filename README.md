# 简介

用户端基于 [vite-uniapp-template](https://github.com/viarotel-org/vite-uniapp-template) 开发，项目具体内容请查看[后端部分](https://github.com/Criel14/e-dove-service)

> 不会写前端，但有Claude Code神力💪

安装依赖：

```
pnpm install
```

启动项目：

```
# H5 平台
pnpm dev:h5

# 微信小程序
pnpm dev:mp-weixin
```



# 现存问题

在 [src/api/index.js](https://github.com/Criel14/e-dove-app/blob/main/src/api/index.js#L50) 中，当接收到接口返回的401后，会调用接口刷新token，但成功后无法重新调用接口，因此无法做到无感刷新，用户再次点击接口才能正常使用；

```js
// 重新发起请求（下面的代码无法实现）
return await response.request()
```

