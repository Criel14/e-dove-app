<script setup>
import { showToast } from '@uni-helper/uni-promises'
import { computed, onMounted, ref } from 'vue'
import { patchAuthPassword, postAuthOtp } from '@/api/user/index.js'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()

const userInfo = computed(() => userStore.userInfo)

// 表单数据
const securityForm = ref({
  phoneOtp: '',
  newPassword: '',
})
const phoneCountdown = ref(0)
const phoneCountdownTimer = ref(null)
const isUpdating = ref(false)

// 开始验证码倒计时
function startPhoneCountdown() {
  phoneCountdown.value = 60
  phoneCountdownTimer.value = setInterval(() => {
    phoneCountdown.value--
    if (phoneCountdown.value <= 0) {
      clearInterval(phoneCountdownTimer.value)
      phoneCountdownTimer.value = null
    }
  }, 1000)
}

// 获取手机验证码
async function getPhoneOtp() {
  const phone = userInfo.value?.phone || userInfo.value?.mobile
  if (!phone) {
    await showToast({
      title: '未绑定手机号，无法发送验证码',
      icon: 'none',
    })
    return
  }

  // 防止重复点击
  if (phoneCountdown.value > 0) {
    await showToast({
      title: `请${phoneCountdown.value}秒后再试`,
      icon: 'none',
    })
    return
  }

  try {
    // 调用发送验证码接口
    await postAuthOtp({
      phoneOrEmail: phone,
    })

    await showToast({
      title: '验证码已发送',
      icon: 'success',
    })

    startPhoneCountdown()
  }
  catch (error) {
    console.error('发送验证码失败:', error)

    // 尝试从错误对象中提取后端返回的message
    let errorMessage = '发送验证码失败'

    // 尝试从不同路径获取错误信息
    if (error.message && error.message !== '') {
      errorMessage = error.message
    }
    else if (error.data?.message) {
      errorMessage = error.data.message
    }
    else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    }

    await showToast({
      title: errorMessage,
      icon: 'error',
    })
  }
}

// 提交修改密码
async function submitChangePassword() {
  // 验证表单
  if (!securityForm.value.phoneOtp.trim()) {
    await showToast({
      title: '请输入验证码',
      icon: 'none',
    })
    return
  }

  // 验证码格式：6位数字
  const otpRegex = /^\d{6}$/
  if (!otpRegex.test(securityForm.value.phoneOtp)) {
    await showToast({
      title: '验证码为6位数字',
      icon: 'none',
    })
    return
  }

  if (!securityForm.value.newPassword.trim()) {
    await showToast({
      title: '请输入新密码',
      icon: 'none',
    })
    return
  }

  // 密码长度限制
  if (securityForm.value.newPassword.length < 6) {
    await showToast({
      title: '密码长度至少6位',
      icon: 'none',
    })
    return
  }

  try {
    isUpdating.value = true

    // 准备请求数据
    const requestData = {
      phoneOtp: securityForm.value.phoneOtp.trim(),
      newPassword: securityForm.value.newPassword.trim(),
    }

    // 调用修改密码接口
    await patchAuthPassword(requestData)

    await showToast({
      title: '密码修改成功',
      icon: 'success',
    })

    // 清空表单
    securityForm.value = {
      phoneOtp: '',
      newPassword: '',
    }

    await sleep()

    // 返回上一页
    router.back()
  }
  catch (error) {
    console.error('修改密码失败:', error)

    // 尝试从错误对象中提取后端返回的message
    let errorMessage = '修改密码失败'

    // 尝试从不同路径获取错误信息
    if (error.message && error.message !== '') {
      errorMessage = error.message
    }
    else if (error.data?.message) {
      errorMessage = error.data.message
    }
    else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    }

    await showToast({
      title: errorMessage,
      icon: 'error',
    })
  }
  finally {
    isUpdating.value = false
  }
}

// 页面加载时初始化
onMounted(() => {
  // 可以在这里做一些初始化操作
})
</script>

<template>
  <view class="h-full flex flex-col bg-gray-50">
    <!-- 表单内容 -->
    <view class="flex-1 px-4 py-6">
      <view class="space-y-6">
        <!-- 手机号（仅展示） -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-2 text-sm font-medium text-gray-700">
            手机号
          </view>
          <view class="text-gray-600">
            {{ userInfo.phone || userInfo.mobile || '未绑定手机号' }}
          </view>
        </view>

        <!-- 验证码 -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-3 text-sm font-medium text-gray-700">
            验证码
          </view>
          <view class="flex gap-2">
            <input
              v-model="securityForm.phoneOtp"
              type="text"
              placeholder="请输入6位验证码"
              maxlength="6"
              class="flex-1 h-10 text-sm px-4 py-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button
              :disabled="phoneCountdown > 0"
              class="px-4 h-10 py-3 bg-primary-500 text-white font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              @click="getPhoneOtp"
            >
              {{ phoneCountdown > 0 ? `${phoneCountdown}秒后重试` : '获取验证码' }}
            </button>
          </view>
        </view>

        <!-- 新密码 -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-3 text-sm font-medium text-gray-700">
            新密码
          </view>
          <input
            v-model="securityForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            class="w-full h-10 text-sm px-4 py-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
          <view class="mt-2 text-xs text-gray-500">
            密码长度至少为6位
          </view>
        </view>
      </view>
    </view>

    <!-- 保存按钮 -->
    <view class="px-4 pb-8 pt-4">
      <button
        :disabled="isUpdating"
        class="w-full flex items-center justify-center rounded-lg bg-primary-500 py-3 text-white font-medium transition-colors duration-200 active:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        hover-class="bg-primary-600"
        @click="submitChangePassword"
      >
        <view v-if="isUpdating" class="i-carbon-fade h-5 w-5 animate-spin mr-2"></view>
        <span>{{ isUpdating ? '保存中...' : '保存修改' }}</span>
      </button>
    </view>
  </view>
</template>
