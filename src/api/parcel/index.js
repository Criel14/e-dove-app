import alova from '@/api/index.js'

export function getParcelUserCount() {
  return alova.Get('/parcel/user/count')
}

export function getParcelUserInfo(params) {
  return alova.Get('/parcel/user/info', {
    params,
  })
}