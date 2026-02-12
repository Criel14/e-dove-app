export default function login(router) {
  const homePath = '/pages/index/index'
  const loginPath = '/pages/login/index'
  const scanInPath = '/pages/index/scan-in/index'
  const scanInRoles = new Set(['station_staff', 'station_admin', 'admin'])

  const whiteList = [loginPath, '/pages/common/rich-view/index', '/pages/common/web-view/index']

  function hasScanInPermission(roleNames = []) {
    return roleNames
      .filter(Boolean)
      .map(role => String(role).trim().toLowerCase())
      .some(role => scanInRoles.has(role))
  }

  function handleScanInPermission(to, userStore, next) {
    if (to.path !== scanInPath) {
      next()
      return
    }

    const storeRoles = Array.isArray(userStore.roleNames) ? userStore.roleNames : []
    const profileRoles = Array.isArray(userStore.userInfo?.roleNames) ? userStore.userInfo.roleNames : []
    const roles = [...storeRoles, ...profileRoles]
    if (hasScanInPermission(roles)) {
      next()
      return
    }

    uni.showToast({
      title: '暂无权限访问',
      icon: 'none',
    })
    next(homePath)
  }

  router.beforeEach((to, from, next) => {
    const userStore = useUserStore()

    // 可以在 .env.dev.local 定义用于接口测试的 Token 环境变量
    // 注意：实际项目中请勿将敏感信息直接写入代码或配置文件
    if (process.env.VITE_API_TOKEN) {
      userStore.token = process.env.VITE_API_TOKEN
    }

    const token = userStore.token
    const userId = userStore.userId

    if (token) {
      if (to.path === loginPath) {
        next(homePath)
      }
      else if (userId) {
        handleScanInPermission(to, userStore, next)
      }
      else {
        userStore
          .getUserData()
          .then(() => {
            handleScanInPermission(to, userStore, next)
          })
          .catch((error) => {
            console.warn(error)
            userStore.logout()
            next({
              path: loginPath,
            })
          })
      }
    }
    else if (whiteList.includes(to.path)) {
      next()
    }
    else {
      next({
        path: loginPath,
      })
    }
  })

  router.afterEach(() => {})
}
