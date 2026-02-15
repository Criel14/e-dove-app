<script setup>
import { onHide, onUnload } from '@dcloudio/uni-app'
import jsbarcode from 'jsbarcode'
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { getUserBarcode } from '@/api/user/index.js'
import { useUserStore } from '@/store/user/index.js'

const userStore = useUserStore()
const barcodeData = ref('')
const loading = ref(false)
const isFullscreen = ref(false)
const instance = getCurrentInstance()
const screenInfo = uni.getSystemInfoSync()

const viewportWidth = screenInfo.windowWidth || screenInfo.screenWidth || 375
const viewportHeight = screenInfo.windowHeight || screenInfo.screenHeight || 667

const fullscreenCanvasStyle = computed(() => {
  // 保持全屏条码画布比例为 2:1，避免旋转后被拉胖
  const maxRotatedWidth = viewportWidth
  const maxRotatedHeight = viewportHeight
  const canvasHeight = Math.floor(Math.min(maxRotatedWidth, maxRotatedHeight / 2))
  const canvasWidth = Math.floor(canvasHeight * 2)
  return `width:${canvasWidth}px;height:${canvasHeight}px;transform: rotate(90deg);transform-origin: center center;`
})

// 格式化手机号
const formattedPhone = computed(() => {
  const phone = userStore.userInfo?.phone || userStore.userInfo?.mobile || ''
  if (phone.length === 11) {
    return `${phone.substring(0, 3)}****${phone.substring(7)}`
  }
  return phone
})

// 获取条形码数据
async function fetchBarcode() {
  loading.value = true
  try {
    const res = await getUserBarcode()
    if (res.status && res.data) {
      barcodeData.value = res.data.barcode || ''
      await nextTick()
      renderBarcode()
    }
  }
  catch (e) {
    console.error('获取条码失败', e)
    uni.showToast({ title: '获取条码失败', icon: 'error' })
  }
  finally {
    loading.value = false
  }
}

function renderBarcodeBySelector(selector, isFullscreenCanvas = false) {
  const query = uni.createSelectorQuery().in(instance)
  query.select(selector)
    .fields({ node: true, size: true })
    .exec((res) => {
      const r = res && res[0]
      if (!r || !r.node || !r.width || !r.height)
        return

      const canvas = r.node
      const ctx = canvas.getContext('2d')
      const dpr = screenInfo.pixelRatio || 1

      canvas.width = Math.floor(r.width * dpr)
      canvas.height = Math.floor(r.height * dpr)

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // 统一使用 CSS 像素系绘制，避免高分屏下条码比例失真
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const moduleCount = Math.max(90, (barcodeData.value?.length || 0) * 11 + 35)
      // 全屏时长度优先铺满（允许轻微超出后由 canvas 自然裁切）
      const idealBarWidth = Math.ceil((r.width * 0.995) / moduleCount)
      const fullBarWidth = Math.max(1, idealBarWidth)
      // 厚度不要跟着画布无限放大，否则会“变胖”
      const fullBarHeight = Math.max(72, Math.min(Math.floor(r.height * 0.42), 168))
      const fullVerticalMargin = Math.max(0, Math.floor((r.height - fullBarHeight) / 2))

      jsbarcode(canvas, barcodeData.value, {
        format: 'CODE128',
        lineColor: '#000',
        width: isFullscreenCanvas ? fullBarWidth : 2,
        height: isFullscreenCanvas ? fullBarHeight : 100,
        margin: isFullscreenCanvas ? 0 : 10,
        marginTop: isFullscreenCanvas ? fullVerticalMargin : 0,
        marginBottom: isFullscreenCanvas ? fullVerticalMargin : 0,
        displayValue: false,
      })
    })
}

// 渲染条形码到 canvas
function renderBarcode() {
  if (!barcodeData.value)
    return

  renderBarcodeBySelector('.barcode-canvas')
  if (isFullscreen.value) {
    renderBarcodeBySelector('.barcode-canvas-full', true)
  }
}

function refreshBarcode() {
  fetchBarcode()
}

async function enterFullscreen() {
  isFullscreen.value = true
  await nextTick()
  renderBarcode()
}

function exitFullscreen() {
  isFullscreen.value = false
}

onHide(() => {
  exitFullscreen()
})

onUnload(() => {
  exitFullscreen()
})

onMounted(async () => {
  if (!userStore.userInfo?.phone && !userStore.userInfo?.mobile) {
    await userStore.getUserData()
  }
  await fetchBarcode()
})
</script>

<template>
  <view class="flex flex-col items-center p-[40rpx] min-h-screen mt-[120rpx]">
    <view class="w-full max-w-[700rpx] bg-white rounded-xl shadow-sm p-[30rpx]">
      <view class="w-full text-center mb-[30rpx]">
        <text class="text-[36rpx] font-bold">
          {{ formattedPhone }}
        </text>
      </view>
      <view class="flex flex-col items-center mb-[30rpx] w-full">
        <canvas
          class="barcode-canvas border border-solid border-[#eee] bg-white rounded-[12rpx]"
          canvas-id="barcodeCanvas"
          type="2d"
          style="width:600rpx;height:300rpx;"
        ></canvas>
        <view class="mt-[20rpx] py-[10rpx] px-[20rpx] bg-[#ffffff] rounded-[8rpx] text-[28rpx] text-[#666]">
          <text>{{ barcodeData }}</text>
        </view>
      </view>
      <view class="flex gap-[24rpx] justify-center">
        <button class="action-btn action-btn--gray" :loading="loading" @click="refreshBarcode">
          刷新
        </button>
        <button class="action-btn action-btn--primary" :disabled="!barcodeData" @click="enterFullscreen">
          放大
        </button>
      </view>
    </view>
    <view class="w-full max-w-[700rpx] mt-[50rpx] flex flex-col gap-[20rpx]">
      <view class="flex items-start gap-[10rpx]">
        <view class="i-carbon-security text-[24rpx] text-primary-500 mt-[2rpx]"></view>
        <text class="text-[24rpx] text-gray-400 flex-1">
          为了您的信息安全，请勿将身份码截图分享给他人
        </text>
      </view>
      <view class="flex items-start gap-[10rpx]">
        <view class="i-carbon-information text-[24rpx] text-primary-500 mt-[2rpx]"></view>
        <text class="text-[24rpx] text-gray-400 flex-1">
          请将身份码与包裹条形码一同展示给驿站机器
        </text>
      </view>
    </view>

    <view v-if="isFullscreen" class="barcode-fullscreen">
      <view class="barcode-fullscreen__content">
        <view class="barcode-fullscreen__canvas-wrap">
          <canvas
            class="barcode-canvas-full"
            canvas-id="barcodeCanvasFull"
            type="2d"
            :style="fullscreenCanvasStyle"
          ></canvas>
        </view>

        <view class="barcode-fullscreen__value">
          <text>{{ barcodeData }}</text>
        </view>

        <view class="barcode-fullscreen__actions">
          <button class="action-btn action-btn--gray" :loading="loading" @click="refreshBarcode">
            刷新
          </button>
          <button class="action-btn action-btn--danger" @click="exitFullscreen">
            缩小
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.action-btn {
  border: none;
  border-radius: 18rpx;
  padding: 18rpx 56rpx;
  font-size: 30rpx;
  line-height: 1;
}

.action-btn--gray {
  background: #f3f4f6;
  color: #111827;
}

.action-btn--primary {
  background: #2563eb;
  color: #fff;
}

.action-btn--danger {
  background: #111827;
  color: #fff;
}

.barcode-fullscreen {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #fff;
  padding: 0;
  box-sizing: border-box;
}

.barcode-fullscreen__content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.barcode-fullscreen__canvas-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.barcode-canvas-full {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12rpx;
}

.barcode-fullscreen__value {
  position: absolute;
  top: calc(24rpx + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  background: #f9fafb;
  font-size: 30rpx;
  color: #4b5563;
  z-index: 2;
}

.barcode-fullscreen__actions {
  position: absolute;
  left: 0;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 24rpx;
  z-index: 2;
}
</style>
