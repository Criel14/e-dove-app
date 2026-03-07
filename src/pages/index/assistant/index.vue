<script setup>
import { onShow, onUnload } from '@dcloudio/uni-app'
import { showModal, showToast } from '@uni-helper/uni-promises'
import { computed, nextTick, ref } from 'vue'
import { getAssistantChatCreate } from '@/api/assistant/index.js'
import { refresh } from '@/api/user/index.js'
import { useUserStore } from '@/store/user/index.js'

const userStore = useUserStore()

const messages = ref([])
const inputMessage = ref('')
const memoryId = ref('')
const scrollIntoViewId = ref('')

const roundState = ref('idle')
const connectionState = ref('disconnected')

const socketTask = ref(null)
const connectingPromise = ref(null)
const heartbeatTimer = ref(null)
const reconnectTimer = ref(null)
const reconnectAttempt = ref(0)

const maxReconnectAttempts = 5
const heartbeatIntervalMs = 25000
const reconnectBaseDelayMs = 1000
const chatCacheKey = 'assistant_chat_session_v1'
const chatCacheTtlMs = 48 * 60 * 60 * 1000

const isSocketOpen = ref(false)
const manualClose = ref(false)
const lastSeq = ref(0)
const currentAssistantMessageId = ref('')
const pendingPrompt = ref('')
const refreshingToken = ref(false)
const newSessionLoading = ref(false)

function readCachedSession() {
  try {
    return uni.getStorageSync(chatCacheKey)
  }
  catch (error) {
    console.error('读取智能助手本地缓存失败', error)
    return null
  }
}

function clearCachedSession() {
  try {
    uni.removeStorageSync(chatCacheKey)
  }
  catch (error) {
    console.error('清理智能助手本地缓存失败', error)
  }
}

function normalizeCachedMessages(rawMessages) {
  if (!Array.isArray(rawMessages))
    return []

  return rawMessages
    .filter(item => item && typeof item === 'object')
    .map((item) => {
      const role = item.role === 'assistant' ? 'assistant' : 'user'
      return {
        id: String(item.id || `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`),
        role,
        content: String(item.content || ''),
        state: role === 'assistant'
          ? (['idle', 'waiting_ack', 'streaming', 'finished', 'failed'].includes(item.state) ? item.state : 'finished')
          : 'finished',
        error: String(item.error || ''),
        prompt: String(item.prompt || ''),
      }
    })
}

function resetRoundRuntime() {
  inputMessage.value = ''
  pendingPrompt.value = ''
  currentAssistantMessageId.value = ''
  lastSeq.value = 0
  scrollIntoViewId.value = ''
  roundState.value = 'idle'
}

function persistSession({ renew = false } = {}) {
  if (!memoryId.value || !Array.isArray(messages.value) || messages.value.length === 0)
    return

  const raw = readCachedSession()
  const previousSavedAt = Number(raw?.savedAt)
  const nextSavedAt = renew || !Number.isFinite(previousSavedAt) ? Date.now() : previousSavedAt
  const payload = {
    version: 1,
    memoryId: String(memoryId.value),
    savedAt: nextSavedAt,
    messages: messages.value.map(item => ({
      id: String(item.id || ''),
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || ''),
      state: String(item.state || ''),
      error: String(item.error || ''),
      prompt: String(item.prompt || ''),
    })),
  }

  try {
    uni.setStorageSync(chatCacheKey, payload)
  }
  catch (error) {
    console.error('保存智能助手本地缓存失败', error)
  }
}

function loadSessionFromCache() {
  const raw = readCachedSession()
  if (!raw || typeof raw !== 'object')
    return false

  const savedAt = Number(raw.savedAt)
  if (!Number.isFinite(savedAt) || Date.now() - savedAt > chatCacheTtlMs) {
    clearCachedSession()
    messages.value = []
    memoryId.value = ''
    resetRoundRuntime()
    return false
  }

  const cachedMemoryId = String(raw.memoryId || '').trim()
  const cachedMessages = normalizeCachedMessages(raw.messages)
  if (!cachedMemoryId || !cachedMessages.length) {
    clearCachedSession()
    return false
  }

  memoryId.value = cachedMemoryId
  messages.value = cachedMessages
  resetRoundRuntime()
  scrollToBottom()
  return true
}

const isGenerating = computed(() => ['waiting_ack', 'streaming'].includes(roundState.value))
const canSend = computed(() => !!inputMessage.value.trim() && !isGenerating.value)
const isConnected = computed(() => isSocketOpen.value && connectionState.value === 'connected')

const wsUrl = computed(() => {
  const origin = process.env.VITE_WS_ORIGIN || process.env.VITE_API_ORIGIN || ''
  if (!origin)
    return ''
  const normalizedOrigin = origin
    .replace(/^http:\/\//i, 'ws://')
    .replace(/^https:\/\//i, 'wss://')
    .replace(/\/+$/, '')
  return `${normalizedOrigin}/assistant/ws/user/chat`
})

function createMessage(role, content = '', extra = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    role,
    content,
    state: role === 'assistant' ? 'idle' : 'finished',
    error: '',
    prompt: '',
    ...extra,
  }
}

function parseBoldSegments(content) {
  const text = String(content || '')
  const segments = []
  const pattern = /\*\*([\s\S]+?)\*\*/g
  let lastIndex = 0
  let match = pattern.exec(text)

  while (match) {
    const start = match.index
    if (start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, start),
        bold: false,
      })
    }
    segments.push({
      text: match[1],
      bold: true,
    })
    lastIndex = start + match[0].length
    match = pattern.exec(text)
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      bold: false,
    })
  }

  if (!segments.length) {
    segments.push({
      text,
      bold: false,
    })
  }

  return segments
}

function scrollToBottom() {
  nextTick(() => {
    const lastMessage = messages.value[messages.value.length - 1]
    if (!lastMessage)
      return
    scrollIntoViewId.value = `msg-${lastMessage.id}`
  })
}

function upsertAssistantMessage(patch) {
  if (!currentAssistantMessageId.value)
    return
  const index = messages.value.findIndex(item => item.id === currentAssistantMessageId.value)
  if (index < 0)
    return
  messages.value[index] = {
    ...messages.value[index],
    ...patch,
  }
  persistSession()
  scrollToBottom()
}

function stopHeartbeat() {
  if (heartbeatTimer.value) {
    clearInterval(heartbeatTimer.value)
    heartbeatTimer.value = null
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer.value = setInterval(() => {
    if (!isSocketOpen.value || !socketTask.value)
      return
    socketTask.value.send({
      data: JSON.stringify({ type: 'ping' }),
    })
  }, heartbeatIntervalMs)
}

function clearReconnectTimer() {
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
    reconnectTimer.value = null
  }
}

function closeSocket(isManual = true) {
  manualClose.value = isManual
  stopHeartbeat()
  clearReconnectTimer()
  isSocketOpen.value = false
  connectionState.value = 'disconnected'
  connectingPromise.value = null

  if (socketTask.value) {
    try {
      socketTask.value.close({
        code: 1000,
        reason: isManual ? 'manual close' : 'close',
      })
    }
    catch (error) {
      console.error('关闭 WebSocket 失败', error)
    }
    socketTask.value = null
  }
}

async function refreshAccessTokenIfNeeded(message) {
  const isAuthIssue = /401|token|unauthor|auth|expired|过期|鉴权|认证/i.test(String(message || ''))
  if (!isAuthIssue || refreshingToken.value)
    return false

  const currentRefreshToken = userStore.refreshToken
  if (!currentRefreshToken)
    return false

  refreshingToken.value = true
  try {
    const result = await refresh({ refreshToken: currentRefreshToken })
    if (result?.status && result?.data?.accessToken && result?.data?.refreshToken) {
      userStore.token = result.data.accessToken
      userStore.refreshToken = result.data.refreshToken
      await showToast({
        title: '登录状态已刷新，请重试',
        icon: 'none',
      })
      return true
    }
  }
  catch (error) {
    console.error('刷新 token 失败', error)
  }
  finally {
    refreshingToken.value = false
  }

  return false
}

async function markRoundFailed(errorText, tryRefresh = true) {
  roundState.value = 'failed'
  upsertAssistantMessage({
    state: 'failed',
    error: errorText || '请求失败，请重试',
  })
  persistSession()

  if (tryRefresh) {
    await refreshAccessTokenIfNeeded(errorText)
  }
}

function handleSocketMessage(rawData) {
  let payload = rawData
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    }
    catch (error) {
      console.error('WebSocket 消息解析失败', error, rawData)
      return
    }
  }

  if (!payload || typeof payload !== 'object')
    return

  const { type } = payload

  if (type === 'ack') {
    if (payload.memoryId && memoryId.value && payload.memoryId !== memoryId.value) {
      console.warn('ack memoryId 不匹配', payload.memoryId, memoryId.value)
      return
    }
    if (roundState.value === 'waiting_ack') {
      roundState.value = 'streaming'
      upsertAssistantMessage({ state: 'streaming', error: '' })
    }
    return
  }

  if (type === 'token') {
    if (payload.memoryId && memoryId.value && payload.memoryId !== memoryId.value) {
      console.warn('token memoryId 不匹配', payload.memoryId, memoryId.value)
      return
    }
    if (roundState.value === 'waiting_ack')
      roundState.value = 'streaming'

    const seq = Number(payload.seq)
    if (Number.isFinite(seq)) {
      if (lastSeq.value > 0 && seq <= lastSeq.value) {
        console.warn('token seq 异常', { previous: lastSeq.value, current: seq })
      }
      lastSeq.value = seq
    }

    const chunk = typeof payload.content === 'string' ? payload.content : ''
    const currentMessage = messages.value.find(item => item.id === currentAssistantMessageId.value)
    if (!currentMessage)
      return
    currentMessage.content = `${currentMessage.content || ''}${chunk}`
    currentMessage.state = 'streaming'
    currentMessage.error = ''
    persistSession()
    scrollToBottom()
    return
  }

  if (type === 'done') {
    if (payload.memoryId && memoryId.value && payload.memoryId !== memoryId.value) {
      console.warn('done memoryId 不匹配', payload.memoryId, memoryId.value)
      return
    }
    roundState.value = 'finished'
    upsertAssistantMessage({
      state: 'finished',
      error: '',
    })
    pendingPrompt.value = ''
    persistSession()
    return
  }

  if (type === 'error') {
    const errorText = payload.error || '服务端返回错误'
    markRoundFailed(errorText)
  }
}

function scheduleReconnect() {
  if (manualClose.value || !isGenerating.value)
    return
  if (reconnectAttempt.value >= maxReconnectAttempts) {
    markRoundFailed('连接中断且重连失败，请点击重试', false)
    return
  }

  reconnectAttempt.value += 1
  const delay = reconnectBaseDelayMs * (2 ** (reconnectAttempt.value - 1))
  clearReconnectTimer()
  reconnectTimer.value = setTimeout(async () => {
    try {
      await connectSocket()
      await showToast({
        title: '连接已恢复，请手动重试',
        icon: 'none',
      })
      if (isGenerating.value) {
        await markRoundFailed('连接已恢复，请点击重试', false)
      }
    }
    catch (error) {
      console.error('重连失败', error)
      scheduleReconnect()
    }
  }, delay)
}

async function connectSocket() {
  if (isSocketOpen.value && socketTask.value)
    return
  if (connectingPromise.value)
    return connectingPromise.value
  if (!userStore.token)
    throw new Error('请先登录后使用智能助手')
  if (!wsUrl.value)
    throw new Error('未配置后端地址')

  manualClose.value = false
  connectionState.value = 'connecting'

  connectingPromise.value = new Promise((resolve, reject) => {
    let settled = false
    const task = uni.connectSocket({
      url: wsUrl.value,
      header: {
        Authorization: `Bearer ${userStore.token}`,
      },
      success: () => {},
      fail: (error) => {
        if (!settled) {
          settled = true
          reject(error || new Error('WebSocket 连接失败'))
        }
      },
    })

    socketTask.value = task

    task.onOpen(() => {
      isSocketOpen.value = true
      connectionState.value = 'connected'
      reconnectAttempt.value = 0
      startHeartbeat()
      if (!settled) {
        settled = true
        resolve()
      }
    })

    task.onMessage((event) => {
      handleSocketMessage(event.data)
    })

    task.onError((error) => {
      console.error('WebSocket 连接错误', error)
      connectionState.value = 'error'
      if (!settled) {
        settled = true
        reject(error || new Error('WebSocket 连接错误'))
      }
    })

    task.onClose(() => {
      stopHeartbeat()
      isSocketOpen.value = false
      connectionState.value = 'disconnected'
      connectingPromise.value = null
      if (!manualClose.value) {
        scheduleReconnect()
      }
    })
  }).finally(() => {
    connectingPromise.value = null
  })

  return connectingPromise.value
}

async function ensureMemoryId() {
  if (memoryId.value)
    return memoryId.value

  const res = await getAssistantChatCreate()
  const createdMemoryId = res?.data?.memoryId
  if (!createdMemoryId)
    throw new Error('创建会话失败，请稍后重试')
  memoryId.value = String(createdMemoryId)
  return memoryId.value
}

function sendSocketData(payload) {
  return new Promise((resolve, reject) => {
    if (!socketTask.value || !isSocketOpen.value) {
      reject(new Error('连接未建立'))
      return
    }
    socketTask.value.send({
      data: JSON.stringify(payload),
      success: () => resolve(),
      fail: error => reject(error || new Error('发送失败')),
    })
  })
}

async function sendMessage(promptText, options = {}) {
  const text = String(promptText || '').trim()
  if (!text) {
    await showToast({
      title: '请输入问题',
      icon: 'none',
    })
    return
  }
  if (isGenerating.value) {
    await showToast({
      title: '请等待当前回答结束',
      icon: 'none',
    })
    return
  }

  const userMsg = createMessage('user', text)
  messages.value.push(userMsg)

  const assistantMsg = createMessage('assistant', '', {
    state: 'waiting_ack',
    prompt: text,
  })
  messages.value.push(assistantMsg)
  scrollToBottom()

  inputMessage.value = ''
  roundState.value = 'waiting_ack'
  pendingPrompt.value = text
  currentAssistantMessageId.value = assistantMsg.id
  lastSeq.value = 0

  try {
    await ensureMemoryId()
    persistSession({ renew: true })
    await connectSocket()
    await sendSocketData({
      type: 'chat',
      memoryId: memoryId.value,
      message: text,
    })
  }
  catch (error) {
    const fallbackMsg = options.fromRetry ? '重试失败，请稍后再试' : '发送失败，请重试'
    await markRoundFailed(error?.message || fallbackMsg)
  }
}

async function handleSend() {
  await sendMessage(inputMessage.value)
}

async function retryMessage(message) {
  const text = (message?.prompt || pendingPrompt.value || '').trim()
  if (!text) {
    await showToast({
      title: '没有可重试的问题',
      icon: 'none',
    })
    return
  }
  await sendMessage(text, { fromRetry: true })
}

async function stopGenerating() {
  if (!isGenerating.value)
    return
  await markRoundFailed('已停止生成', false)
  closeSocket(true)
}

async function createNewSession() {
  if (newSessionLoading.value)
    return
  if (isGenerating.value) {
    await showToast({
      title: '请先停止当前回答',
      icon: 'none',
    })
    return
  }

  if (messages.value.length > 0) {
    const result = await showModal({
      title: '提示',
      content: '新建会话将会清空你现有的聊天内容，是否继续？',
      showCancel: true,
      confirmText: '继续',
      cancelText: '取消',
    })
    if (!result.confirm)
      return
  }

  newSessionLoading.value = true
  closeSocket(true)
  messages.value = []
  clearCachedSession()
  memoryId.value = ''
  resetRoundRuntime()

  try {
    await ensureMemoryId()
    await showToast({
      title: '已创建新会话',
      icon: 'none',
    })
  }
  catch (error) {
    await showToast({
      title: error?.message || '新会话创建失败',
      icon: 'none',
    })
  }
  finally {
    newSessionLoading.value = false
  }
}

onUnload(() => {
  closeSocket(true)
})

onShow(() => {
  if (!isGenerating.value) {
    loadSessionFromCache()
  }
})
</script>

<template>
  <view class="h-screen flex flex-col bg-[#f7f8fa]">
    <view class="h-[--safe-top] bg-white"></view>
    <view class="h-[108rpx] bg-white"></view>

    <view class="bg-white border-b border-solid border-[#eceff4] px-[28rpx] pt-[20rpx] pb-[18rpx]">
      <view class="flex items-center justify-between">
        <view class="flex items-center">
          <view class="i-carbon-chat-bot text-[34rpx] text-[#2563eb] mr-[10rpx]"></view>
          <view class="text-[32rpx] text-[#111827] font-bold">智能助手</view>
        </view>
      </view>
      <view class="mt-[8rpx] flex items-center justify-between">
        <view>
          <view class="text-[22rpx] text-[#6b7280] mt-[8rpx]">
            可帮你查包裹进度，也能解答系统功能问题
          </view>
        </view>
        <button
          class="h-[62rpx] leading-[62rpx] px-[20rpx] text-[24rpx] rounded-[14rpx] bg-[#eef2ff] text-[#374151] border-none"
          :disabled="isGenerating || newSessionLoading"
          :loading="newSessionLoading"
          @click="createNewSession"
        >
          新会话
        </button>
      </view>
    </view>

    <scroll-view
      class="flex-1 px-[24rpx] py-[20rpx]"
      scroll-y
      :scroll-into-view="scrollIntoViewId"
      :scroll-with-animation="true"
    >
      <view v-if="!messages.length" class="text-center text-[24rpx] text-[#9ca3af] mt-[80rpx]">
        智能助手可以帮你查询包裹信息，并解答系统功能答疑
      </view>

      <view
        v-for="message in messages"
        :id="`msg-${message.id}`"
        :key="message.id"
        class="mb-[20rpx] flex flex-col"
        :class="message.role === 'user' ? 'items-end' : 'items-start'"
      >
        <view
          class="text-[22rpx] text-[#9ca3af] mb-[8rpx]"
          :class="message.role === 'user' ? 'text-right pr-[4rpx]' : 'text-left pl-[4rpx]'"
        >
          {{ message.role === 'user' ? '我' : '智能助手' }}
        </view>
        <view v-if="message.role === 'user'" class="max-w-[78%] rounded-[18rpx] px-[22rpx] py-[18rpx] text-[28rpx] leading-[1.6] break-words whitespace-pre-wrap shadow-sm bg-[#2563eb] text-white">
          <text>{{ message.content }}</text>
        </view>
        <view
          v-else
          class="max-w-[78%] rounded-[18rpx] px-[22rpx] py-[18rpx] text-[28rpx] leading-[1.6] break-words whitespace-pre-wrap shadow-sm bg-white text-[#111827]"
        >
          <template v-if="message.content">
            <text
              v-for="(segment, index) in parseBoldSegments(message.content)"
              :key="`${message.id}-${index}`"
              :class="segment.bold ? 'font-bold' : ''"
            >
              {{ segment.text }}
            </text>
          </template>
          <view v-else-if="['waiting_ack', 'streaming'].includes(message.state)" class="px-[22rpx] py-[18rpx] text-[28rpx] text-[#9ca3af]">
            思考中...
          </view>
        </view>

        <view v-if="message.role === 'assistant' && message.state === 'failed'" class="mr-[120rpx] mt-[10rpx]">
          <view class="text-[22rpx] text-[#dc2626]">{{ message.error || '请求失败' }}</view>
          <button
            class="mt-[10rpx] h-[58rpx] leading-[58rpx] px-[20rpx] text-[24rpx] rounded-[12rpx] bg-[#fee2e2] text-[#991b1b] border-none inline-flex"
            @click="retryMessage(message)"
          >
            重试
          </button>
        </view>
      </view>
    </scroll-view>

    <view class="bg-white border-t border-solid border-[#eceff4] px-[20rpx] pt-[16rpx] pb-[calc(16rpx+env(safe-area-inset-bottom))]">
      <view class="flex items-end gap-[16rpx]">
        <textarea
          v-model="inputMessage"
          class="flex-1 min-h-[76rpx] max-h-[180rpx] bg-[#f3f4f6] rounded-[14rpx] px-[18rpx] py-[14rpx] text-[28rpx]"
          placeholder="输入你的问题..."
          confirm-type="send"
          auto-height
          maxlength="-1"
          @confirm="handleSend"
        />
        <button
          v-if="isGenerating"
          class="h-[76rpx] leading-[76rpx] px-[22rpx] text-[26rpx] rounded-[14rpx] bg-[#111827] text-white border-none"
          @click="stopGenerating"
        >
          停止生成
        </button>
        <button
          v-else
          class="h-[76rpx] leading-[76rpx] px-[28rpx] text-[26rpx] rounded-[14rpx] bg-[#2563eb] text-white border-none"
          :disabled="!canSend || !isConnected && !userStore.token"
          @click="handleSend"
        >
          发送
        </button>
      </view>
    </view>
  </view>
</template>
