<script setup>
import { onShow } from '@dcloudio/uni-app'
import { showModal, showToast } from '@uni-helper/uni-promises'
import { computed, onMounted, ref } from 'vue'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()
const isLoading = ref(false)

const isLogin = computed(() => !!userStore.token)
const userInfo = computed(() => userStore.userInfo)
const avatarSrc = computed(() => {
  if (userInfo.value && userInfo.value.avatarUrl) {
    return userInfo.value.avatarUrl
  }
  return '~@assets/images/avatar.gif'
})

// 获取用户信息
async function fetchUserInfo() {
  if (!isLogin.value) {
    return
  }

  // 每次调用都重新获取用户信息，确保数据最新

  try {
    isLoading.value = true
    await userStore.getUserData()
  }
  catch (error) {
    console.error('获取用户信息失败:', error)
    await showToast({
      title: error.message || '获取用户信息失败',
      icon: 'error',
    })
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  // 页面加载时，如果已登录但用户信息为空，则获取用户信息
  if (isLogin.value) {
    fetchUserInfo()
  }
})

onShow(() => {
  // 页面显示时重新获取用户信息，确保数据最新
  if (isLogin.value) {
    fetchUserInfo()
  }
})

function handleLogin() {
  if (!isLogin.value) {
    router.push({
      path: '/login',
    })
  }
  // 已登录状态不执行任何操作，只显示用户信息
}

function onAvatarError() {
  // 头像加载失败时使用默认头像
  // 注意：在微信小程序中，不能直接修改image的src属性
  // 可以通过v-if或重新绑定key来处理，这里先记录日志
  console.log('头像加载失败，使用默认头像')
}

async function handleLogout() {
  const result = await showModal({
    title: '提示',
    content: '确定要退出登录吗?',
    showCancel: true,
    confirmText: '确定',
    cancelText: '取消',
  })

  if (result.confirm) {
    await userStore.logout()

    await showToast({
      title: '退出登录成功',
      icon: 'success',
    })

    await sleep()

    router.push({
      path: '/login',
    })
  }
}

// 跳转到修改信息页面
function openEditModal() {
  router.push({
    path: '/personal/edit',
  })
}

// 跳转到账号安全页面
function openSecurityPage() {
  router.push({
    path: '/personal/security',
  })
}
</script>

<template>
  <view class="h-full flex flex-col">
    <view
      class="relative overflow-hidden"
    >
      <view class="absolute inset-0 bg-transparent"></view>

      <view class="h-[--safe-top]"></view>

      <view
        class="relative flex items-center px-6 pb-12 pt-12"
        hover-class="opacity-90"
        @click="handleLogin"
        @tap="handleLogin"
      >
        <view class="h-22 w-22 overflow-hidden bg-white border-2 border-white/30 rounded-full shadow-lg">
          <image
            :src="avatarSrc"
            alt="用户头像"
            class="h-full w-full"
            @error="onAvatarError"
          />
        </view>

        <view class="ml-4 flex-1">
          <view v-if="isLogin && userInfo && userInfo.username" class="text-xl text-black font-bold">
            {{ userInfo.username }}
            <view v-if="userInfo.userId" class="text-sm text-gray-400 font-normal mt-1">
              UID: {{ userInfo.userId }}
            </view>
          </view>
          <view v-else class="flex items-center">
            <view class="text-xl text-white font-medium">
              {{ isLogin ? '加载中...' : '立即登录' }}
            </view>
            <view class="ml-2 rounded-full bg-white/20 px-3 py-1 text-xs text-white">
              {{ isLogin ? '已登录' : '未登录' }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="isLogin" class="mb-8 mt-auto px-5 space-y-4">
      <button
        class="w-full bg-gray-100 py-3 text-gray-800 font-medium transition-colors duration-200 !rounded-lg flex items-center justify-center"
        hover-class="bg-gray-200"
        @click="openEditModal"
      >
        <view class="i-carbon-edit mr-2 text-lg text-black"></view>
        修改信息
      </button>

      <button
        class="w-full bg-gray-100 py-3 text-gray-800 font-medium transition-colors duration-200 !rounded-lg flex items-center justify-center"
        hover-class="bg-gray-200"
        @click="openSecurityPage"
      >
        <view class="i-carbon-password mr-2 text-lg text-black"></view>
        账号安全
      </button>

      <button
        class="w-full bg-gray-100 py-3 text-gray-800 font-medium transition-colors duration-200 !rounded-lg flex items-center justify-center"
        hover-class="bg-gray-200"
      >
        <view class="i-carbon-information mr-2 text-lg text-black"></view>
        关于
      </button>

      <button
        class="w-full bg-gray-100 py-3 text-red font-medium transition-colors duration-200 !rounded-lg"
        hover-class="bg-gray-200"
        @click="handleLogout"
      >
        退出登录
      </button>

    </view>

  </view>
</template>
