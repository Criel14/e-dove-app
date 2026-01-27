<script setup>
import jsbarcode from 'jsbarcode'
import { computed, getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { getUserBarcode } from '@/api/user/index.js'
import { useUserStore } from '@/store/user/index.js'

const userStore = useUserStore()
const barcodeData = ref('')
const loading = ref(false)
const instance = getCurrentInstance()
const screenInfo = uni.getSystemInfoSync() // 获取屏幕尺寸

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

// 渲染条形码到 canvas
function renderBarcode() {
  if (!barcodeData.value)
    return

  const query = uni.createSelectorQuery().in(instance)
  const selector = '.barcode-canvas'
  query.select(selector)
    .fields({ node: true, size: true })
    .exec((res) => {
      const r = res && res[0]
      if (!r || !r.node)
        return

      const canvas = r.node
      const ctx = canvas.getContext('2d')

      // 设置真实画布尺寸 px
      canvas.width = r.width * screenInfo.pixelRatio
      canvas.height = r.height * screenInfo.pixelRatio

      // 清空
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      jsbarcode(canvas, barcodeData.value, {
        format: 'CODE128',
        lineColor: '#000',
        width: 2,
        height: 100,
        displayValue: false,
      })
    })
}

function refreshBarcode() {
  fetchBarcode()
}

onMounted(async () => {
  if (!userStore.userInfo?.phone && !userStore.userInfo?.mobile) {
    await userStore.getUserData()
  }
  await fetchBarcode()
})
</script>

<template>
  <view class="flex flex-col items-center p-[40rpx] min-h-screen mt-[100rpx]">
    <view class="w-full text-center mb-[40rpx]">
      <text class="text-[36rpx] font-bold">
        {{ formattedPhone }}
      </text>
    </view>
    <view class="flex flex-col items-center mb-[60rpx] w-[90vw]">
      <canvas
        class="barcode-canvas border border-solid border-[#eee] bg-white"
        canvas-id="barcodeCanvas"
        type="2d"
        style="width:600rpx;height:300rpx;"
      ></canvas>
      <view class="mt-[20rpx] py-[10rpx] px-[20rpx] bg-[#f5f5f5] rounded-[8rpx] text-[28rpx] text-[#666]">
        <text>{{ barcodeData }}</text>
      </view>
    </view>
    <view class="flex gap-[40rpx] justify-center">
      <button class="py-[20rpx] px-[60rpx] rounded-[20rpx] text-[32rpx] border-none bg-[#f0f0f0] text-[#333]" :loading="loading" @click="refreshBarcode">
        刷新
      </button>
    </view>
  </view>
</template>
