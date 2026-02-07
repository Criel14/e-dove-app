<script setup>
import { onShow } from '@dcloudio/uni-app'
import { showModal, showToast } from '@uni-helper/uni-promises'
import { computed, onMounted, ref } from 'vue'
import { getParcelUserCount } from '@/api/parcel/index.js'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()
const isLoading = ref(false)
const parcelCount = ref(0)

const isLogin = computed(() => !!userStore.token)
const userInfo = computed(() => userStore.userInfo)
const avatarSrc = computed(() => {
  if (userInfo.value && userInfo.value.avatarUrl) {
    return userInfo.value.avatarUrl
  }
  return '~@assets/images/avatar.gif'
})

const parcelCountText = computed(() => {
  if (parcelCount.value <= 99) {
    return `已签收${parcelCount.value}个包裹`
  }
  return '已签收99+个包裹'
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

// 获取已签收包裹数量
async function fetchParcelCount() {
  if (!isLogin.value) {
    return
  }

  try {
    const res = await getParcelUserCount()
    if (res.status) {
      parcelCount.value = res.data.count
    }
  }
  catch (error) {
    console.error('获取包裹数量失败:', error)
  }
}

onMounted(() => {
  // 页面加载时，如果已登录但用户信息为空，则获取用户信息
  if (isLogin.value) {
    fetchUserInfo()
    fetchParcelCount()
  }
})

onShow(() => {
  // 页面显示时重新获取用户信息，确保数据最新
  if (isLogin.value) {
    fetchUserInfo()
    fetchParcelCount()
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

// 跳转到已签收包裹页面
function openParcelReceived() {
  router.push({
    path: '/parcel/received',
  })
}
</script>

<template>
  <view class="h-full flex flex-col">
    <view
      class="relative overflow-hidden mb-1"
    >
      <view class="absolute inset-0 bg-transparent"></view>

      <view class="h-[--safe-top]"></view>

      <view
        class="relative flex items-center px-6 pb-8 pt-12"
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

    <!-- 已签收包裹数量 -->
    <view v-if="isLogin" class="mx-5 mt-0 mb-6">
      <view class="rounded-lg p-4 flex items-center justify-between" style="background-color: #dfefff">
        <view class="flex items-center text-gray-800 font-medium">
          <view class="i-carbon-delivery-parcel mr-2 text-lg text-gray-800"></view>
          {{ parcelCountText }}
        </view>
        <button
          class="bg-white text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
          hover-class="bg-gray-100"
          @click="openParcelReceived"
        >
          查看
        </button>
      </view>
    </view>

    <!-- 功能按钮区域 -->
    <view v-if="isLogin" class="mx-5 mt-0 mb-8 pt-6 border-t border-gray-200">
      <!-- 隐私服务 -->
      <view class="mb-6">
        <view class="text-sm text-gray-500 font-medium mb-3">隐私服务</view>
        <view class="flex flex-row gap-2">
          <!-- 修改信息按钮 -->
          <button
            class="flex flex-col items-center justify-center w-20 aspect-square bg-gray-50 rounded-lg transition-colors duration-200"
            hover-class="bg-gray-100"
            @click="openEditModal"
          >
            <view class="i-carbon-edit text-2xl text-gray-800 mb-2"></view>
            <text class="text-xs text-gray-800 font-medium">修改信息</text>
          </button>

          <!-- 账号安全按钮 -->
          <button
            class="flex flex-col items-center justify-center w-20 aspect-square bg-gray-50 rounded-lg transition-colors duration-200"
            hover-class="bg-gray-100"
            @click="openSecurityPage"
          >
            <view class="i-carbon-password text-2xl text-gray-800 mb-2"></view>
            <text class="text-xs text-gray-800 font-medium">账号安全</text>
          </button>
        </view>
      </view>

      <!-- 分隔线 -->
      <view class="border-t border-gray-200 mb-6"></view>

      <!-- 其他服务 -->
      <view>
        <view class="text-sm text-gray-500 font-medium mb-3">其他服务</view>
        <view class="flex flex-row gap-2">
          <!-- 关于按钮 -->
          <button
            class="flex flex-col items-center justify-center w-20 aspect-square bg-gray-50 rounded-lg transition-colors duration-200"
            hover-class="bg-gray-100"
          >
            <view class="i-carbon-information text-2xl text-gray-800 mb-2"></view>
            <text class="text-xs text-gray-800 font-medium">关于</text>
          </button>

          <!-- 退出登录按钮 -->
          <button
            class="flex flex-col items-center justify-center w-20 aspect-square bg-gray-50 rounded-lg transition-colors duration-200"
            hover-class="bg-gray-100"
            @click="handleLogout"
          >
            <view class="i-carbon-logout text-2xl text-red mb-2"></view>
            <text class="text-xs text-red font-medium">退出登录</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>
