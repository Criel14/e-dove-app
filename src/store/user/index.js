import { defineStore } from 'pinia'
import { getUserInfo, postUserLogin } from '@/api/user/index.js'

export const useUserStore = defineStore(
  'user',
  () => {
    const userInfo = ref({})
    const userId = computed(() => userInfo.value.userId || '')
    const roleNames = ref([])

    const token = ref('')
    const refreshToken = ref('')

    async function login(credentials) {
      const res = await postUserLogin(credentials)

      if (!res.status) {
        throw new Error(res.message || '登录失败')
      }

      token.value = res.data.accessToken
      refreshToken.value = res.data.refreshToken || ''

      userInfo.value = {
        userId: res.data.userId || '',
        username: res.data.username || '',
      }

      roleNames.value = Array.isArray(res.data.roleNames) ? res.data.roleNames : []
    }

    function logout() {
      token.value = ''
      refreshToken.value = ''
      userInfo.value = {}
      roleNames.value = []
    }

    async function getUserData() {
      const res = await getUserInfo()
      const latestUserInfo = res.data || {}

      userInfo.value = latestUserInfo

      if (Array.isArray(latestUserInfo.roleNames)) {
        roleNames.value = latestUserInfo.roleNames
      }
    }

    return {
      token,
      refreshToken,
      userInfo,
      userId,
      roleNames,
      login,
      logout,
      getUserData,
    }
  },
  {
    persist: {
      paths: ['token', 'refreshToken', 'userInfo', 'roleNames'],
    },
  },
)
