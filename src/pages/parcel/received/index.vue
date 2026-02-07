<script setup>
import { ref } from 'vue'
import { getParcelUserInfo } from '@/api/parcel/index.js'

const pagingRef = ref(null)
const dataList = ref([])
const isLoading = ref(false)

// 快递公司映射
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

// 根据运单号获取快递公司信息
function getCompanyInfo(trackingNumber) {
  if (!trackingNumber)
    return { name: '未知快递', logo: '' }

  // 遍历公司前缀
  for (const [prefix, info] of Object.entries(companyMap)) {
    if (trackingNumber.toUpperCase().startsWith(prefix)) {
      return info
    }
  }

  return { name: '未知快递', logo: '' }
}

// 格式化日期：将 "2024-01-15 16:20:00" 转为 "01-15 16:20"
function formatDateTime(dateTimeStr) {
  if (!dateTimeStr)
    return '时间未知'
  try {
    // 替换 '-' 为 '/' 以兼容iOS
    const date = new Date(dateTimeStr.replace(/-/g, '/'))
    // 检查日期是否有效
    if (Number.isNaN(date.getTime())) {
      return '时间未知'
    }
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${minutes}`
  }
  catch (error) {
    console.error('日期格式化错误:', error)
    return '时间未知'
  }
}

// 主查询函数，会被z-paging调用
async function onQuery(pageNo, pageSize = 10) {
  try {
    isLoading.value = true

    const params = {
      pageNum: pageNo,
      pageSize,
      status: 2, // 已签收
    }

    const result = await getParcelUserInfo(params)

    if (result.status) {
      const list = result.data.list || []
      const total = result.data.total || 0

      // 处理数据，添加公司信息和格式化时间
      const processedList = list.map((item) => {
        const formattedOutTime = formatDateTime(item.outTime)
        return {
          ...item,
          formattedOutTime,
          signedText: formattedOutTime === '时间未知' ? '签收时间未知' : `已于${formattedOutTime}签收`,
          companyInfo: getCompanyInfo(item.trackingNumber),
        }
      })

      // 更新dataList
      if (pageNo === 1) {
        dataList.value = processedList
      }
      else {
        dataList.value.push(...processedList)
      }

      // 传递给z-paging组件
      pagingRef.value.complete(processedList)

      // 判断是否还有更多数据
      // 只有当有数据时才判断，空数据不显示"没有更多数据"
      if (list.length > 0) {
        // 1. 如果当前页数据不足一页，说明没有更多数据了
        // 2. 或者已经达到总数上限
        const hasMoreData = list.length === pageSize && pageNo * pageSize < total

        if (!hasMoreData) {
          pagingRef.value.completeByNoMore(processedList)
        }
      }
    }
    else {
      throw new Error(result.message || '数据加载失败')
    }
  }
  catch (error) {
    console.error('数据加载失败:', error)

    uni.showToast({
      title: error.message || '加载失败',
      icon: 'none',
      duration: 2000,
    })

    pagingRef.value.complete(false)
  }
  finally {
    isLoading.value = false
  }
}

// 刷新函数
function onRefresh() {
  onQuery(1, 10)
}

// 点击项目
function handleItemClick(item) {
  // 可以跳转到详情页，暂时只显示提示
  uni.showToast({
    title: `运单号: ${item.trackingNumber}`,
    icon: 'none',
  })
}
</script>

<template>
  <view class="h-full bg-gray-50">
    <z-paging
      ref="pagingRef"
      v-model="dataList"
      class="flex-1"
      :refresher-enabled="true"
      :refresher-threshold="80"
      refresher-default-text="下拉刷新"
      refresher-pulling-text="释放立即刷新"
      refresher-refreshing-text="正在刷新..."
      refresher-complete-text="刷新完成"
      :loading-more-enabled="true"
      :loading-more-text="['点击加载更多', '正在加载...', '仅显示近30日包裹']"
      empty-view-text="暂无已签收包裹"
      :auto-show-back-to-top="true"
      :back-to-top-threshold="300"
      @query="onQuery"
      @on-refresh="onRefresh"
    >
      <template #refresher>
        <view class="flex flex-col items-center justify-center bg-white/80 py-6 backdrop-blur-sm">
          <view class="mb-2 h-8 w-8 animate-spin border-3 border-blue-500 border-t-transparent rounded-full"></view>
          <text class="text-sm text-blue-600 font-medium">
            正在刷新...
          </text>
        </view>
      </template>

      <view class="px-4 py-2 space-y-3">
        <view
          v-for="item in dataList"
          :key="item.id"
          class="overflow-hidden border border-gray-100 rounded-2xl bg-white shadow-sm transition-all duration-200 active:scale-98"
          @click="handleItemClick(item)"
        >
          <view class="p-4">
            <view class="flex items-start space-x-4">
              <!-- 快递公司Logo -->
              <view class="flex-shrink-0">
                <image
                  v-if="item.companyInfo.logo"
                  :src="item.companyInfo.logo"
                  class="h-16 w-16 rounded-lg"
                  mode="aspectFit"
                />
                <view
                  v-else
                  class="h-16 w-16 flex items-center justify-center rounded-lg bg-gray-100"
                >
                  <text class="text-xs text-gray-400">无Logo</text>
                </view>
              </view>

              <!-- 包裹信息 -->
              <view class="min-w-0 flex-1">
                <!-- 签收时间 -->
                <text class="text-base text-gray-900 font-semibold leading-tight">
                  {{ item.signedText }}
                </text>

                <!-- 运单号 -->
                <view class="mt-2">
                  <text class="text-xs text-gray-600">运单号: </text>
                  <text class="text-xs text-gray-900 font-medium">
                    {{ item.trackingNumber || '未知' }}
                  </text>
                </view>

                <!-- 快递公司 -->
                <view class="mt-1">
                  <text class="text-xs text-gray-600">快递公司: </text>
                  <text class="text-xs text-gray-900 font-medium">
                    {{ item.companyInfo.name }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <template #loadingMore>
        <view class="flex flex-col items-center justify-center py-8">
          <view class="mb-2 h-6 w-6 animate-spin border-2 border-gray-300 border-t-blue-500 rounded-full"></view>
          <text class="text-sm text-gray-500">
            正在加载更多...
          </text>
        </view>
      </template>

      <template #noMore>
        <view class="flex flex-col items-center justify-center py-8">
          <view class="i-carbon-checkmark-filled mb-2 h-8 w-8 text-green-500"></view>
          <text class="text-sm text-gray-500">
            仅显示近30日包裹
          </text>
        </view>
      </template>

      <template #empty>
        <view class="flex flex-col items-center justify-center py-16">
          <view class="i-carbon-package mb-4 h-16 w-16 text-gray-300"></view>
          <text class="mb-2 text-base text-gray-500 font-medium">
            暂无已签收包裹
          </text>
          <text class="mb-6 text-sm text-gray-400">
            下拉刷新试试看
          </text>
          <button
            class="rounded-lg bg-blue-500 px-6 py-2 text-sm text-white font-medium transition-transform active:scale-95"
            @click="onRefresh"
          >
            立即刷新
          </button>
        </view>
      </template>
    </z-paging>
  </view>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
