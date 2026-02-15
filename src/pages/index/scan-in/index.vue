<script setup>
import { onMounted, ref } from 'vue'
import { parcelIn } from '@/api/parcel/index.js'

const isScanning = ref(false)
const isSubmitting = ref(false)
const trackingNumber = ref('')
const submitError = ref('')
const hasAutoTriggered = ref(false)

async function handleScanIn() {
  if (isScanning.value || isSubmitting.value) {
    return
  }

  submitError.value = ''
  isScanning.value = true

  try {
    const scanResult = await uni.scanCode({
      onlyFromCamera: true,
      scanType: ['barCode'],
    })

    const scannedTrackingNumber = (scanResult?.result || '').trim()
    if (!scannedTrackingNumber) {
      submitError.value = '未识别到有效运单号'
      await uni.showToast({
        title: submitError.value,
        icon: 'none',
      })
      return
    }

    trackingNumber.value = scannedTrackingNumber

    isSubmitting.value = true
    await parcelIn({
      trackingNumber: scannedTrackingNumber,
    })

    await uni.showToast({
      title: '入库成功',
      icon: 'success',
    })
  }
  catch (error) {
    const isCancel = error?.errMsg && error.errMsg.includes('cancel')
    if (isCancel) {
      return
    }

    submitError.value = error?.message || '入库失败，请重试'
    await uni.showToast({
      title: submitError.value,
      icon: 'none',
    })
  }
  finally {
    isScanning.value = false
    isSubmitting.value = false
  }
}

onMounted(() => {
  if (!hasAutoTriggered.value) {
    hasAutoTriggered.value = true
    handleScanIn()
  }
})
</script>

<template>
  <view class="h-full bg-gray-50 p-[32rpx]">
    <view class="mt-[24rpx] rounded-[20rpx] bg-white p-[32rpx]">
      <view class="text-[34rpx] font-semibold text-[#111827]">
        包裹入库
      </view>
      <view class="mt-[16rpx] text-[26rpx] leading-[40rpx] text-[#6B7280]">
        点击下方按钮后会打开摄像头扫描运单号条形码，识别成功后自动调用入库接口。
      </view>

      <view class="mt-[36rpx] rounded-[12rpx] bg-[#F9FAFB] p-[24rpx]">
        <view class="text-[24rpx] text-[#6B7280]">
          最近识别运单号
        </view>
        <view class="mt-[10rpx] break-all text-[30rpx] font-medium text-[#111827]">
          {{ trackingNumber || '-' }}
        </view>
      </view>

      <view v-if="submitError" class="mt-[20rpx] text-[24rpx] text-[#DC2626]">
        {{ submitError }}
      </view>

      <button
        class="mt-[36rpx] rounded-[12rpx] bg-[#2563EB] py-[22rpx] text-[30rpx] text-white border-none"
        :loading="isScanning || isSubmitting"
        :disabled="isScanning || isSubmitting"
        @click="handleScanIn"
      >
        {{ isScanning ? '扫码中...' : (isSubmitting ? '入库中...' : '扫码入库') }}
      </button>
    </view>
  </view>
</template>
