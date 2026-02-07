<script setup>
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'

const list = ref([])

onShow(() => {
  // TODO: 加载已签收包裹列表
})
</script>

<template>
  <view class="p-4">
    <text class="text-lg">已签收包裹页面</text>
    <text class="block mt-4 text-gray-500">具体内容后续实现</text>
  </view>
</template>