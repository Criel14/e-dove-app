<script setup>
import { showToast } from '@uni-helper/uni-promises'
import { computed, ref } from 'vue'
import { getParcelByTrackingNumber } from '@/api/parcel/index.js'

const trackingNumber = ref('')
const isLoading = ref(false)
const parcelData = ref(null)
const errorMessage = ref('')

// 快递公司映射（参考received/index.vue）
const companyMap = {
  SF: { name: '顺丰速运', logo: '/static/images/company/SF.png' },
  YT: { name: '圆通速递', logo: '/static/images/company/YT.png' },
  ZTO: { name: '中通快递', logo: '/static/images/company/ZTO.png' },
  STO: { name: '申通快递', logo: '/static/images/company/STO.png' },
  YD: { name: '韵达快递', logo: '/static/images/company/YD.png' },
  JD: { name: '京东物流', logo: '/static/images/company/JD.png' },
  DBL: { name: '德邦物流', logo: '/static/images/company/DBL.png' },
  EMS: { name: '中国邮政速递物流', logo: '/static/images/company/EMS.png' },
  JT: { name: '极兔速递', logo: '/static/images/company/JT.png' },
}

// 快递公司中文名列表
const companyChineseNames = computed(() => {
  return Object.values(companyMap).map(item => item.name).join('、')
})

// 根据运单号获取快递公司信息
function getCompanyInfo(trackingNumber) {
  if (!trackingNumber) {
    return { name: '未知快递', logo: '' }
  }

  // 遍历公司前缀
  for (const [prefix, info] of Object.entries(companyMap)) {
    if (trackingNumber.toUpperCase().startsWith(prefix)) {
      return info
    }
  }

  return { name: '未知快递', logo: '' }
}

// 格式化日期
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr)
    return ''

  try {
    const date = new Date(dateTimeStr.replace(/-/g, '/'))
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`
  }
  catch (error) {
    console.error('日期格式化错误:', error)
    return ''
  }
}

// 根据状态获取显示文本
function getStatusText(status, pickCode, outTime) {
  switch (status) {
    case 0:
      return '包裹运输中'
    case 1:
      return `取件码 ${pickCode || '未知'}`
    case 2:
    { const formattedTime = formatDateTime(outTime)
      return `已签收 ${formattedTime}` }
    case 3:
      return '包裹滞留，请联系驿站工作人员'
    case 4:
      return '包裹已退回'
    default:
      return '状态未知'
  }
}

// 格式化电话号码：13800138000 -> 138****8000
function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return '未知'
  }

  // 移除所有非数字字符
  const digits = phone.replace(/\D/g, '')

  // 如果是11位手机号，格式化成138****8000
  if (digits.length === 11) {
    return `${digits.substring(0, 3)}****${digits.substring(7)}`
  }

  // 如果是其他长度，显示前3位和最后4位
  if (digits.length >= 7) {
    return `${digits.substring(0, 3)}****${digits.substring(digits.length - 4)}`
  }

  // 太短的号码，显示原始号码
  return phone
}

// 查询包裹
async function searchParcel() {
  const number = trackingNumber.value.trim()
  if (!number) {
    await showToast({
      title: '请输入运单号',
      icon: 'none',
    })
    return
  }

  try {
    isLoading.value = true
    parcelData.value = null
    errorMessage.value = ''

    const result = await getParcelByTrackingNumber(number)

    if (result.status) {
      parcelData.value = result.data
      await showToast({
        title: '查询成功',
        icon: 'success',
      })
    }
    else {
      // 处理查询失败的情况
      if (result.code === '5001') {
        // 包裹信息不存在
        errorMessage.value = '包裹信息不存在，请检查订单号是否正确'
        await showToast({
          title: '包裹信息不存在',
          icon: 'none',
        })
      }
      else {
        throw new Error(result.message || '查询失败')
      }
    }
  }
  catch (error) {
    console.error('查询失败:', error)
    await showToast({
      title: error.message || '查询失败，请检查运单号',
      icon: 'error',
    })
    parcelData.value = null
    errorMessage.value = ''
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <view class="h-full bg-gray-50">
    <view class="h-[--safe-top]"></view>

    <!-- 顶部真正的输入框 -->
    <view class="px-4 pt-2 pb-6">
      <view class="flex items-center space-x-3">
        <!-- 输入框 -->
        <view class="flex-1">
          <input
            v-model="trackingNumber"
            class="w-full h-12 bg-white rounded-sm rounded-2xl px-5 py-4 text-base border-1 border-gray-300 focus:border-blue-500 focus:outline-none leading-none"
            placeholder="输入运单号查询包裹"
            placeholder-class="text-gray-400"
            :disabled="isLoading"
            @confirm="searchParcel"
          />
        </view>

        <!-- 查询按钮 -->
        <button
          class="rounded-2xl h-12 ml-1 rounded-sm bg-blue-500 px-5 py-4 text-base text-white font-medium border-2 border-blue-500 leading-none active:scale-95 transition-transform disabled:opacity-50"
          :disabled="isLoading"
          @click="searchParcel"
        >
          {{ isLoading ? '查询中...' : '查询' }}
        </button>
      </view>
    </view>

    <!-- 包裹信息显示区域 -->
    <view v-if="parcelData" class="px-4 pb-8">
      <view class="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
        <!-- 包裹信息卡片 -->
        <view class="p-5">
          <view class="flex items-start space-x-4">
            <!-- 快递公司Logo -->
            <view class="flex-shrink-0">
              <image
                v-if="getCompanyInfo(parcelData.trackingNumber).logo"
                :src="getCompanyInfo(parcelData.trackingNumber).logo"
                class="h-20 w-20 rounded-lg"
                mode="aspectFit"
              />
              <view
                v-else
                class="h-20 w-20 flex items-center justify-center rounded-lg bg-gray-100"
              >
                <text class="text-xs text-gray-400">无Logo</text>
              </view>
            </view>

            <!-- 包裹详细信息 -->
            <view class="min-w-0 flex-1">
              <!-- 第一行：状态/取件码（字体稍大） -->
              <text class="text-lg text-gray-900 font-semibold leading-tight block">
                {{ getStatusText(parcelData.status, parcelData.pickCode, parcelData.outTime) }}
              </text>

              <!-- 第二行：运单号（颜色灰色较浅） -->
              <view class="mt-2">
                <text class="text-sm text-gray-400">
                  {{ parcelData.trackingNumber || '未知运单号' }}
                </text>
              </view>

              <!-- 快递公司名称 -->
              <view class="mt-2 pt-2 border-t border-gray-100">
                <text class="text-xs text-gray-500">快递公司：</text>
                <text class="text-xs text-gray-700 font-medium">
                  {{ getCompanyInfo(parcelData.trackingNumber).name }}
                </text>
              </view>
            </view>
          </view>

          <!-- 包裹详细信息 -->
          <view class="mt-5 pt-5 border-t border-gray-100 space-y-4">
            <!-- 收件人电话（单独一行） -->
            <view class="flex flex-col">
              <text class="text-xs text-gray-500 mb-1">收件人电话：</text>
              <text class="text-sm text-gray-700 font-medium">
                {{ formatPhoneNumber(parcelData.recipientPhone) }}
              </text>
            </view>

            <!-- 地址（单独一行） -->
            <view class="flex flex-col">
              <text class="text-xs text-gray-500 mb-1">地址：</text>
              <text class="text-sm text-gray-700 font-medium">
                {{ parcelData.recipientAddrProvince || '' }}{{ parcelData.recipientAddrCity || '' }}{{ parcelData.recipientAddrDistrict || '' }}
              </text>
            </view>
          </view>

        </view>
      </view>
    </view>

    <!-- 错误信息提示 -->
    <view v-else-if="errorMessage" class="px-4 py-16 flex flex-col items-center justify-center">
      <view class="i-carbon-warning-alt mb-4 h-16 w-16 text-amber-500"></view>
      <text class="mb-2 text-base text-gray-700 font-medium">
        {{ errorMessage }}
      </text>
      <text class="text-sm text-gray-400 text-center">
        请检查订单号是否正确，或稍后重试
      </text>
    </view>

    <!-- 空状态提示 -->
    <view v-else class="px-4 py-16 flex flex-col items-center justify-center">
      <view class="i-carbon-delivery-parcel mb-4 h-16 w-16 text-gray-300"></view>
      <text class="mb-2 text-base text-gray-500 font-medium">
        请输入运单号查询包裹
      </text>
      <text class="text-sm text-gray-400 text-center">
        支持{{ companyChineseNames }}等快递公司
      </text>
    </view>
  </view>
</template>

<style scoped>
/* 可以添加自定义样式 */
</style>
