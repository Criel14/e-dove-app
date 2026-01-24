import { defineStore } from 'pinia'
import { getUserInfo, postUserLogin } from '@/api/user/index.js'

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref({})
    const userId = computed(() => userInfo.value.userId || '')

    const token = ref('')
    const refreshToken = ref('')

    async function login(credentials) {
      const res = await postUserLogin(credentials)

      if (res.status) {
        token.value = res.data.accessToken
        // 保存refreshToken
        refreshToken.value = res.data.refreshToken || ''
        // 用户信息将通过/user/info接口单独获取
        userInfo.value = {}
      }
      else {
        throw new Error(res.message || '登录失败')
      }
    }

    function logout() {
      token.value = ''
      refreshToken.value = ''
      userInfo.value = {}
    }

    async function getUserData() {
      const res = await getUserInfo()
      userInfo.value = res.data
    }

    return {
      token,
      refreshToken,
      userInfo,
      userId,
      login,
      logout,
      getUserData,
    }
  },
  {
    persist: {
      paths: ['token', 'refreshToken', 'userInfo'],
    },
  },
)
