<script setup>
import { showToast } from '@uni-helper/uni-promises'
import { onUnmounted } from 'vue'
import { postAuthOtp } from '@/api/user/index.js'
import { appDescription, appExtra, appName, appVersion } from '@/settings/index.mjs'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()
const webView = useWebView()
const richView = useRichView()

const agreed = ref(false)
const isLoading = ref(false)
const account = ref('')
const password = ref('')

// 登录模式：accountPassword-账号密码登录，phoneOtp-手机验证码登录
const loginMode = ref('accountPassword')
const phone = ref('')
const phoneOtp = ref('')
const countdown = ref(0)
const countdownTimer = ref(null)

// 验证手机号格式
function isValidPhone(phone) {
  const phoneRegex = /^1[3-9]\d{9}$/
  return phoneRegex.test(phone)
}

// 验证邮箱格式
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  return emailRegex.test(email)
}

// 验证密码长度
function isValidPassword(pwd) {
  return pwd.length >= 6
}

// 验证验证码格式（6位数字）
function isValidOtp(otp) {
  const otpRegex = /^\d{6}$/
  return otpRegex.test(otp)
}

// 开始倒计时
function startCountdown() {
  countdown.value = 60
  countdownTimer.value = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownTimer.value)
      countdownTimer.value = null
    }
  }, 1000)
}

// 获取验证码
async function getOtp() {
  // 验证手机号
  if (!phone.value.trim()) {
    await showToast({
      title: '请输入手机号',
      icon: 'none',
    })
    return
  }

  if (!isValidPhone(phone.value)) {
    await showToast({
      title: '请输入正确的手机号格式',
      icon: 'none',
    })
    return
  }

  // 防止重复点击
  if (countdown.value > 0) {
    return
  }

  try {
    await postAuthOtp({ phoneOrEmail: phone.value })
    await showToast({
      title: '验证码已发送',
      icon: 'success',
    })
    startCountdown()
  }
  catch (error) {
    await showToast({
      title: error.message || '获取验证码失败，请重试',
      icon: 'error',
    })
  }
}

// 验证输入
function validateInputs() {
  if (loginMode.value === 'accountPassword') {
    // 账号密码登录验证
    if (!account.value.trim()) {
      return '请输入手机号或邮箱'
    }

    if (!isValidPhone(account.value) && !isValidEmail(account.value)) {
      return '请输入正确的手机号或邮箱格式'
    }

    if (!password.value) {
      return '请输入密码'
    }

    if (!isValidPassword(password.value)) {
      return '密码长度不能少于6位'
    }
  }
  else {
    // 手机验证码登录验证
    if (!phone.value.trim()) {
      return '请输入手机号'
    }

    if (!isValidPhone(phone.value)) {
      return '请输入正确的手机号格式'
    }

    if (!phoneOtp.value.trim()) {
      return '请输入验证码'
    }

    if (!isValidOtp(phoneOtp.value)) {
      return '验证码格式错误，请输入6位数字'
    }
  }

  if (!agreed.value) {
    return '请先同意服务协议'
  }

  return null
}

async function onLoginClick() {
  // 验证输入
  const errorMsg = validateInputs()
  if (errorMsg) {
    await showToast({
      title: errorMsg,
      icon: 'none',
    })
    return
  }

  try {
    isLoading.value = true

    // 构建登录参数
    const credentials = {}

    if (loginMode.value === 'accountPassword') {
      // 账号密码登录
      credentials.password = password.value

      // 判断是手机号还是邮箱
      if (isValidPhone(account.value)) {
        credentials.phone = account.value
      }
      else {
        credentials.email = account.value
      }
    }
    else {
      // 手机验证码登录
      credentials.phone = phone.value
      credentials.phoneOtp = phoneOtp.value
    }

    await userStore.login(credentials)

    await showToast({
      title: '登录成功',
      icon: 'success',
    })

    await sleep(500)

    router.pushTab({
      path: '/pages/index/index',
    })
  }
  catch (error) {
    await showToast({
      title: error.message || '登录失败，请重试',
      icon: 'error',
    })
  }
  finally {
    isLoading.value = false
  }
}

function toggleAgreement() {
  agreed.value = !agreed.value
}

function onAgreementClick() {
  richView.open({
    title: '产品服务协议',
    content: `
      <div style="padding: 20px; line-height: 1.6; color: #333;">
        <h3 style="color: #1a1a1a; margin-bottom: 16px;">MIT 开源协议</h3>
        <p style="margin-bottom: 16px;">
          本项目已签署 MIT 协议，保障用户的使用权益。
        </p>
        
        <h4 style="color: #1a1a1a; margin: 20px 0 12px 0;">使用条款</h4>
        <p style="margin-bottom: 16px;">
          使用本项目的用户需要遵守如下条款：
        </p>
        
        <p style="margin-bottom: 16px;">
          特此授权，免费得以任何目的的使用、复制、修改、合并、出版、发行、散布、再授权及贩售软件及软件的副本，及授予前述权利的许可，无论是否为商业目的。
        </p>
        
        <h4 style="color: #1a1a1a; margin: 20px 0 12px 0;">免责声明</h4>
        <p style="margin-bottom: 16px;">
          上述软件是按「原样」提供，作者不作任何明示或暗示的保证，包括但不限于对适销性和特定目的的适用性的保证。在任何情况下，无论是在合同诉讼、侵权行为或其它方面，作者都不对因使用本软件或其中所包含的内容所产生的任何直接、间接、偶然、特殊及后果性损害承担责任。
        </p>
      </div>
    `,
  })
}

function onProjectClick() {
  webView.open({
    src: appExtra.url,
  })
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
})
</script>

<template>
  <view class="relative min-h-screen overflow-hidden from-primary-50 to-primary-100/70 bg-gradient-to-br">
    <view class="absolute left-0 top-0 h-full w-full opacity-5">
      <view class="absolute right-10 top-20 h-32 w-32 rounded-full bg-primary-400 blur-3xl"></view>
      <view class="absolute bottom-40 left-10 h-24 w-24 rounded-full bg-primary-400 blur-2xl"></view>
    </view>

    <view class="relative z-10 min-h-screen flex flex-col">
      <view class="flex flex-1 flex-col justify-center px-6 py-12">
        <view class="mb-12 text-center">
          <view class="relative mb-6 inline-block">
            <view class="mx-auto h-24 w-24 flex items-center justify-center rounded-3xl bg-white shadow-lg">
              <image
                src="/static/images/logo.png"
                alt="App Logo"
                class="h-16 w-16 rounded-2xl"
              />
            </view>
            <view class="absolute rounded-3xl from-primary-400 to-primary-400 bg-gradient-to-r opacity-20 blur-lg -inset-2"></view>
          </view>

          <view class="space-y-2">
            <text class="block text-3xl text-gray-900 font-bold">
              {{ appName }}
            </text>
            <text class="block text-base text-gray-600">
              {{ appDescription }}
            </text>
          </view>
        </view>

        <view class="space-y-4">
          <!-- 登录方式切换 -->
          <view class="flex rounded-2xl">
            <view
              class="flex-1 rounded-xl py-3 text-center text-sm font-medium transition-all duration-200"
              :class="loginMode === 'accountPassword' ? 'bg-primary-500 text-white shadow' : 'text-gray-600 active:bg-gray-100'"
              @click="loginMode = 'accountPassword'"
            >
              账号密码登录
            </view>
            <view
              class="flex-1 rounded-xl py-3 text-center text-sm font-medium transition-all duration-200"
              :class="loginMode === 'phoneOtp' ? 'bg-primary-500 text-white shadow' : 'text-gray-600 active:bg-gray-100'"
              @click="loginMode = 'phoneOtp'"
            >
              手机验证码登录
            </view>
          </view>
          <view class="space-y-4">
            <!-- 账号密码登录 -->
            <view v-if="loginMode === 'accountPassword'" class="space-y-4">
              <view class="overflow-hidden rounded-2xl bg-white shadow-lg">
                <input
                  v-model="account"
                  type="text"
                  placeholder="请输入手机号或邮箱"
                  class="h-12 w-full border-0 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  :disabled="isLoading"
                />
              </view>

              <view class="overflow-hidden rounded-2xl bg-white shadow-lg">
                <input
                  v-model="password"
                  type="safe-password"
                  placeholder="请输入密码（至少6位）"
                  class="h-12 w-full border-0 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  :disabled="isLoading"
                />
              </view>
            </view>

            <!-- 手机验证码登录 -->
            <view v-else class="space-y-4">
              <view class="overflow-hidden rounded-2xl bg-white shadow-lg">
                <input
                  v-model="phone"
                  type="text"
                  inputmode="numeric"
                  maxlength="11"
                  placeholder="请输入手机号"
                  class="h-12 w-full border-0 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  :disabled="isLoading"
                />
              </view>

              <view class="overflow-hidden rounded-2xl bg-white shadow-lg flex">
                <input
                  v-model="phoneOtp"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="请输入验证码"
                  class="h-12 flex-1 border-0 px-5 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  :disabled="isLoading"
                />
                <button
                  class="flex items-center justify-center px-4 text-sm font-medium text-primary-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                  :disabled="countdown > 0 || isLoading"
                  @click="getOtp"
                >
                  {{ countdown > 0 ? `${countdown}秒后重新获取` : '获取验证码' }}
                </button>
              </view>
            </view>
          </view>

          <view class="">
            <button
              class="relative w-full overflow-hidden rounded-2xl from-primary-500 to-primary-400 bg-gradient-to-r px-6 py-4 font-semibold shadow-lg transition-all duration-200 active:scale-98 disabled:cursor-not-allowed !text-white disabled:opacity-70"
              :class="{ 'shadow-xl': !isLoading }"
              :disabled="isLoading"
              @click="onLoginClick"
            >
              <view class="flex items-center justify-center space-x-3">
                <view v-if="isLoading" class="i-carbon-fade h-5 w-5 animate-spin bg-white"></view>
                <view v-else class="i-carbon-login h-5 w-5"></view>
                <text>{{ isLoading ? '登录中...' : '登录' }}</text>
              </view>

              <view class="absolute inset-0 from-transparent via-white to-transparent bg-gradient-to-r opacity-0 transition-all duration-500 -translate-x-full group-active:translate-x-full group-active:opacity-20"></view>
            </button>
          </view>

          <view class="flex items-center px-2 space-x-2">
            <view
              class="h-5 w-5 flex flex-shrink-0 items-center justify-center border-2 border-gray-300 rounded transition-all duration-200 active:scale-95"
              :class="agreed ? 'bg-primary-500 border-primary-500' : 'bg-white'"
              @click="toggleAgreement"
            >
              <view v-if="agreed" class="i-carbon-checkmark h-3 w-3 text-white"></view>
            </view>

            <view class="mt-[1px] flex-1 leading-relaxed">
              <text class="text-sm text-gray-600">
                我已阅读并同意
                <text
                  class="text-primary-600 font-medium transition-colors duration-200 active:text-primary-700"
                  @click.stop="onAgreementClick"
                >
                  《产品服务协议》
                </text>
              </text>
            </view>
          </view>
        </view>
      </view>

      <view class="px-6 pb-8">
        <view class="text-center space-y-3">
          <view class="flex items-center justify-center space-x-2">
            <text class="text-sm text-gray-500">
              Powered by
            </text>
            <view
              class="inline-flex items-center text-sm text-primary-600 font-medium transition-colors duration-200 space-x-1 active:text-primary-700"
              @click="onProjectClick"
            >
              <view>{{ appExtra.name }}</view>
              <view class="i-carbon-launch size-3"></view>
            </view>
          </view>

          <view class="flex items-center justify-center text-xs text-gray-400 space-x-2">
            <view class="i-carbon-information h-3 w-3"></view>
            <text>版本 v{{ appVersion }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
