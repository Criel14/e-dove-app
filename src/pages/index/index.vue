<script setup>
const router = useRouter()

// 跳转到包裹查询页面
function goToParcelQuery() {
  router.push({
    path: '/parcel/query',
  })
}
</script>

<template>
  <view class="h-full bg-gray-50">
    <view class="h-[--safe-top] mt-4"></view>

    <!-- 第一部分：顶部搜索框 -->
    <view class="px-4 pt-8 pb-6">
      <view
        class="flex items-center bg-white rounded-md px-4 py-3 border-1 border-gray-300 active:scale-98 transition-transform duration-150"
        @click="goToParcelQuery"
      >
        <!-- 放大镜搜索图标 -->
        <view class="i-carbon-search mr-3 h-5 w-5 text-gray-400"></view>

        <!-- 提示文字 -->
        <text class="text-gray-500 text-sm flex-1">点击这里快速查询包裹</text>
      </view>
    </view>

    <!-- 第二部分：用户的待取包裹（占比较大） -->
    <view class="flex-1 px-4">
      <!-- 待取包裹内容待开发 -->
      <view class="bg-white rounded-2xl p-6 text-center">
        <text class="text-gray-400">待取包裹区域</text>
      </view>
    </view>

    <!-- 第三部分：底部预留区域 -->
    <view class="px-4 py-6">
      <view class="bg-white rounded-2xl p-6 text-center">
        <text class="text-gray-400">底部预留区域</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 可以添加自定义样式 */
</style>
