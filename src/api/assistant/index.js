import alova from '@/api/index.js'

export function getAssistantChatCreate() {
  return alova.Get('/assistant/chat/create')
}
