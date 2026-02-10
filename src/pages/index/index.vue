<script setup>
import { computed, ref } from 'vue'
import { getParcelUserInfo } from '@/api/parcel/index.js'

const router = useRouter()
const pagingRef = ref(null)
const dataList = ref([])
const isLoading = ref(false)

// 按门店分组的数据
const groupedByStore = computed(() => {
  const groups = {}

  dataList.value.forEach((item) => {
    const storeId = item.storeId || 'unknown'
    const storeName = item.storeName || '未知门店'

    if (!groups[storeId]) {
      groups[storeId] = {
        storeId,
        storeName,
        parcels: [],
      }
    }

    groups[storeId].parcels.push(item)
  })

  // 转换为数组并排序（可以按门店名称或其他逻辑排序）
  return Object.values(groups).sort((a, b) => {
    // 按门店名称排序
    return a.storeName.localeCompare(b.storeName)
  })
})

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

  for (const [prefix, info] of Object.entries(companyMap)) {
    if (trackingNumber.toUpperCase().startsWith(prefix)) {
      return info
    }
  }

  return { name: '未知快递', logo: '' }
}

// 跳转到包裹查询页面
function goToParcelQuery() {
  router.push({
    path: '/parcel/query',
  })
}

// 主查询函数，会被z-paging调用
async function onQuery(pageNo, pageSize = 10) {
  try {
    isLoading.value = true

    const params = {
      pageNum: pageNo,
      pageSize,
      status: 1,
    }

    const result = await getParcelUserInfo(params)

    if (result.status) {
      const list = result.data.list || []
      const total = result.data.total || 0

      const processedList = list.map((item) => {
        return {
          ...item,
          companyInfo: getCompanyInfo(item.trackingNumber),
        }
      })

      if (pageNo === 1) {
        dataList.value = processedList
      }
      else {
        dataList.value.push(...processedList)
      }

      pagingRef.value.complete(processedList)

      if (list.length > 0) {
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
  uni.showToast({
    title: `取件码: ${item.pickCode}`,
    icon: 'none',
  })
}
</script>

<template>
  <view class="h-full bg-gray-50 flex flex-col">
    <view class="h-[--safe-top]"></view>

    <!-- 用户的待取包裹信息 -->
    <view class="flex-1 overflow-hidden">
      <z-paging
        ref="pagingRef"
        v-model="dataList"
        class="h-full"
        :refresher-enabled="true"
        :refresher-threshold="80"
        refresher-default-text="下拉刷新"
        refresher-pulling-text="释放立即刷新"
        refresher-refreshing-text="正在刷新..."
        refresher-complete-text="刷新完成"
        :loading-more-enabled="true"
        :loading-more-text="[
          '点击加载更多',
          '正在加载...',
          '没有更多待取包裹',
        ]"
        empty-view-text="暂无待取包裹"
        :auto-show-back-to-top="true"
        :back-to-top-threshold="300"
        @query="onQuery"
        @on-refresh="onRefresh"
      >
        <!-- 把搜索栏放到 slot top -->
        <template #top>
          <view class="px-6 pt-2 pb-2 mt-16 bg-gray-50">
            <view
              class="flex items-center bg-white rounded-md px-4 py-3 border border-gray-300 active:scale-98 transition-transform duration-150"
              @click="goToParcelQuery"
            >
              <view class="i-carbon-search mr-3 h-5 w-5 text-gray-400"></view>
              <text class="text-gray-500 text-sm flex-1">
                点击这里快速查询包裹
              </text>
            </view>
            <!-- 待取包裹标题 -->
            <view class="mt-3 mb-1 flex items-center">
              <view class="i-carbon-product mr-1 mt-1 h-7 w-7 text-gray-800"></view>
              <text class="text-lg font-bold text-gray-800">
                待取包裹
              </text>
            </view>
          </view>
        </template>

        <!-- 下拉刷新自定义内容 -->
        <template #refresher>
          <view class="flex flex-col items-center justify-center bg-white/80 py-6 backdrop-blur-sm">
            <view class="mb-2 h-8 w-8 animate-spin border-3 border-blue-500 border-t-transparent rounded-full"></view>
            <text class="text-sm text-blue-600 font-medium">
              正在刷新...
            </text>
          </view>
        </template>

        <!-- 待取包裹列表 -->
        <view class="px-4 pt-3 border-t border-gray-200">
          <!-- 遍历门店分组 -->
          <view
            v-for="store in groupedByStore"
            :key="store.storeId"
            class="mb-6"
          >
            <!-- 门店标题 -->
            <view class="mb-3">
              <view class="flex items-center">
                <view class="i-carbon-store mr-2 h-5 w-5 text-blue-600"></view>
                <text class="text-lg font-semibold text-gray-900">
                  {{ store.storeName }}
                </text>
              </view>
            </view>

            <!-- 门店下的包裹列表 -->
            <view
              v-for="item in store.parcels"
              :key="item.id"
              class="bg-white rounded-xl mb-4 transition-all duration-200 active:bg-gray-50"
              @click="handleItemClick(item)"
            >
              <view class="p-4">
                <view class="flex items-start">
                  <!-- 快递公司Logo -->
                  <view class="flex-shrink-0">
                    <image
                      v-if="item.companyInfo.logo"
                      :src="item.companyInfo.logo"
                      class="h-18 w-18 rounded-lg"
                      mode="aspectFit"
                    />
                    <view
                      v-else
                      class="h-16 w-16 flex items-center justify-center rounded-lg bg-gray-100"
                    >
                      <text class="text-xs text-gray-400">
                        无Logo
                      </text>
                    </view>
                  </view>

                  <!-- 包裹信息 -->
                  <view class="min-w-0 flex-1 ml-4">
                    <!-- 取件码 - 大字体加粗 -->
                    <text class="text-xl text-gray-900 font-bold leading-tight block">
                      {{ item.pickCode || '无取件码' }}
                    </text>

                    <!-- 运单号 -->
                    <view class="mt-2">
                      <text class="text-sm text-gray-600">
                        {{ item.trackingNumber || '未知运单号' }}
                      </text>
                    </view>

                    <!-- 快递公司名称 -->
                    <view class="mt-1">
                      <text class="text-sm text-gray-900 font-medium">
                        {{ item.companyInfo.name }}
                      </text>
                    </view>
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
              没有更多待取包裹
            </text>
          </view>
        </template>

        <template #empty>
          <view class="flex flex-col items-center justify-center py-16">
            <view class="i-carbon-package mb-4 h-16 w-16 text-gray-300"></view>
            <text class="mb-2 text-base text-gray-500 font-medium">
              暂无待取包裹
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
