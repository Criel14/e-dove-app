import uniappAdapter from '@alova/adapter-uniapp'
import { isH5 } from '@uni-helper/uni-env'
import { showToast } from '@uni-helper/uni-promises'
import { createAlova } from 'alova'
import { refresh } from '@/api/user/index.js'
import mockRequestAdapter from './mock'

function useAdapter(isMock) {
  if (isMock) {
    return {
      requestAdapter: mockRequestAdapter(),
    }
  }

  return uniappAdapter()
}

function getBaseURL() {
  let value = process.env.VITE_API_ORIGIN + process.env.VITE_API_PATH

  if (process.env.VITE_PROXY_USE === '1' && isH5) {
    value = process.env.VITE_PROXY_PATH
  }

  return value
}

const alova = createAlova({
  ...useAdapter(process.env.VITE_API_MOCK === '1'),

  baseURL: getBaseURL(),

  cacheFor: null,

  beforeRequest: (method) => {
    const userStore = useUserStore()

    if (userStore.token) {
      Object.assign(method.config.headers, {
        [process.env.VITE_API_TOKEN_KEY]: `Bearer ${userStore.token}`,
      })
    }
  },

  responded: {
    onSuccess: async (response) => {
      const userStore = useUserStore()

      // 401请求重新定位到登录页
      if (response.statusCode === 401) {
        console.log('用户身份令牌已过期，正在重新获取')
        // 调用接口刷新token
        const refreshToken = userStore.refreshToken
        if (refreshToken) {
          const data = {}
          data.refreshToken = refreshToken

          try {
            const result = await refresh(data)
            if (result.status && result.data && result.data.accessToken && result.data.refreshToken) {
              // 更新token
              userStore.token = result.data.accessToken
              userStore.refreshToken = result.data.refreshToken

              console.log('用户身份令牌刷新成功，但无法自动重新发起请求')
              // 重新发起请求（下面的代码无法实现）
              // return await response.request()
              return
            }
          }
          catch (e) {
            console.log('刷新用户身份令牌失败')
          }
        }

        console.log('自动登出')
        // 清除token和用户信息
        userStore.logout()
        // 信息提示
        await showToast({
          title: '用户身份令牌已过期，请重新登陆',
          icon: 'error',
        })
        // 跳转到登录页面，使用reLaunch关闭所有页面
        uni.reLaunch({
          url: '/pages/login/index',
        })
      }

      if (response.statusCode >= 400) {
        throw new Error(response.statusText)
      }

      const data = response.data
      // 响应格式：{ status: true/false, code: null/errorCode, message: null/errorMsg, data: {...} }
      if (data.status !== undefined) {
        // status为false表示失败
        if (data.status === false) {
          throw data
        }
        // status为true表示成功，直接返回data
        return data
      }
    },

    onError: (error) => {
      console.error(`alova.responded.onError:${error.message || error}`)
    },

    onComplete: () => {},
  },
})

export default alova
