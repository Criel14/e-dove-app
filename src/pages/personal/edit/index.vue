<script setup>
import { showToast } from '@uni-helper/uni-promises'
import { computed, onMounted, ref } from 'vue'
import { postAuthOtp, putUserUpdate } from '@/api/user/index.js'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()

const userInfo = computed(() => userStore.userInfo)

// 编辑表单
const editForm = ref({
  username: '',
  email: '',
  emailOtp: '',
})
const emailCountdown = ref(0)
const emailCountdownTimer = ref(null)
const isUpdating = ref(false)

// 初始化表单数据
function initFormData() {
  if (!userInfo.value)
    return

  editForm.value = {
    username: userInfo.value.username || '',
    email: userInfo.value.email || '',
    emailOtp: '',
  }
}

// 开始邮箱验证码倒计时
function startEmailCountdown() {
  emailCountdown.value = 60
  emailCountdownTimer.value = setInterval(() => {
    emailCountdown.value--
    if (emailCountdown.value <= 0) {
      clearInterval(emailCountdownTimer.value)
      emailCountdownTimer.value = null
    }
  }, 1000)
}

// 获取邮箱验证码
async function getEmailOtp() {
  // 验证邮箱格式
  if (!editForm.value.email.trim()) {
    await showToast({
      title: '请输入邮箱',
      icon: 'none',
    })
    return
  }

  // 简单的邮箱格式验证
  const emailRegex = /^\S[^\s@]*@\S[^\s.]*\.\S+$/
  if (!emailRegex.test(editForm.value.email)) {
    await showToast({
      title: '请输入正确的邮箱格式',
      icon: 'none',
    })
    return
  }

  // 防止重复点击
  if (emailCountdown.value > 0) {
    await showToast({
      title: `请${emailCountdown.value}秒后再试`,
      icon: 'none',
    })
    return
  }

  try {
    // 调用发送验证码接口
    await postAuthOtp({
      phoneOrEmail: editForm.value.email,
    })

    await showToast({
      title: '验证码已发送',
      icon: 'success',
    })

    startEmailCountdown()
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

// 提交修改信息
async function submitEditInfo() {
  // 验证表单
  if (!editForm.value.username.trim()) {
    await showToast({
      title: '请输入用户名',
      icon: 'none',
    })
    return
  }

  // 获取原始邮箱
  const originalEmail = userInfo.value.email || ''
  const newEmail = editForm.value.email.trim()

  // 判断是否需要验证码：邮箱有变化（新旧不同，或者原来没有现在有）
  const needOtp = newEmail !== originalEmail || (!originalEmail && newEmail)

  // 如果需要验证码，验证验证码
  if (needOtp) {
    if (!editForm.value.emailOtp.trim()) {
      await showToast({
        title: '请输入邮箱验证码',
        icon: 'none',
      })
      return
    }

    // 验证码格式：6位数字
    const otpRegex = /^\d{6}$/
    if (!otpRegex.test(editForm.value.emailOtp)) {
      await showToast({
        title: '验证码为6位数字',
        icon: 'none',
      })
      return
    }
  }

  try {
    isUpdating.value = true

    // 准备请求数据
    const requestData = {
      username: editForm.value.username.trim(),
      email: newEmail,
    }

    // 如果需要验证码，添加验证码字段
    if (needOtp) {
      requestData.emailOtp = editForm.value.emailOtp.trim()
    }

    // 调用更新接口
    await putUserUpdate(requestData)

    // 更新本地用户信息
    await userStore.getUserData()

    await showToast({
      title: '修改成功',
      icon: 'success',
    })

    await sleep()

    // 返回上一页
    router.back()
  }
  catch (error) {
    console.error('修改信息失败:', error)

    // 尝试从错误对象中提取后端返回的message
    let errorMessage = '修改信息失败'

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
  initFormData()
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

        <!-- 用户名 -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-3 text-sm font-medium text-gray-700">
            用户名
          </view>
          <input
            v-model="editForm.username"
            type="text"
            placeholder="请输入用户名"
            class="w-full h-10 text-sm px-4 py-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </view>

        <!-- 邮箱 -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-3 text-sm font-medium text-gray-700">
            邮箱
          </view>
          <input
            v-model="editForm.email"
            type="email"
            placeholder="请输入邮箱"
            class="w-full h-10 text-sm px-4 py-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
          />
        </view>

        <!-- 邮箱验证码 -->
        <view class="bg-white rounded-xl px-5 py-4 shadow-sm">
          <view class="mb-3 text-sm font-medium text-gray-700">
            邮箱验证码
          </view>
          <view class="flex gap-2">
            <input
              v-model="editForm.emailOtp"
              type="text"
              placeholder="请输入6位验证码"
              maxlength="6"
              class="flex-1 h-10 text-sm px-4 py-3 border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <button
              :disabled="emailCountdown > 0"
              class="px-4 h-10 py-3 bg-primary-500 text-white font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
              @click="getEmailOtp"
            >
              {{ emailCountdown > 0 ? `${emailCountdown}秒后重试` : '获取验证码' }}
            </button>
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
        @click="submitEditInfo"
      >
        <view v-if="isUpdating" class="i-carbon-fade h-5 w-5 animate-spin mr-2"></view>
        <span>{{ isUpdating ? '保存中...' : '保存修改' }}</span>
      </button>
    </view>
  </view>
</template>
